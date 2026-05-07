const pool = require("../db");
const obtenerZonaCliente = require("../helpers/zonaCliente");
const enviarWhatsApp = require("../helpers/enviarWhatsApp");
const notificarCliente = require("../helpers/notificarCliente");

// ===============================
// CREAR ENVIO PREPAGO
// ===============================
const crearEnvioPrePago = async (req, res) => {
  try {
    const { cliente_id, direccion, tipo } = req.body;

    if (!cliente_id || !direccion || !tipo) {
      return res.status(400).json({ error: "Faltan datos" });
    }

    const clienteRes = await pool.query(
      "SELECT lat, lng FROM clientes WHERE id = $1",
      [cliente_id]
    );

    if (clienteRes.rows.length === 0) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    const { lat, lng } = clienteRes.rows[0];

    const zonaInfo = await obtenerZonaCliente(lat, lng);


    // 0️⃣ Verificar si ya hay envio esperando_pago
const existente = await pool.query(`
  SELECT *
  FROM envios
  WHERE cliente_id = $1
  AND estado = 'esperando_pago'
  ORDER BY id DESC
  LIMIT 1
`, [cliente_id]);

if (existente.rows.length > 0) {
  return res.json({
    ok: true,
    envio: existente.rows[0]
  });
}

    const result = await pool.query(
      `
      INSERT INTO envios
      (cliente_id, zona, direccion, precio, estado, tipo)
      VALUES ($1,$2,$3,$4,'esperando_pago',$5)
      RETURNING *
      `,
      [
        cliente_id,
        zonaInfo.zona,
        direccion,
        zonaInfo.precio,
        tipo
      ]
    );

    res.json({
      ok: true,
      envio: result.rows[0]
    });

  } catch (error) {
    console.error("❌ crearEnvioPrePago:", error);
    res.status(500).json({ error: "Error creando envío" });
  }
};

// ===============================
// LISTAR ENVIOS PENDIENTES (SOLO CON ORDEN)
// ===============================
const getEnviosPendientes = async (req,res)=>{
  const r = await pool.query(`
    SELECT 
      e.id,
      e.tipo,
      e.zona,
      e.direccion,
      e.precio,
      e.estado,
      c.nombre as cliente,
      o.id as orden_id
    FROM envios e
    JOIN ordenes o ON o.id = e.orden_id
    JOIN clientes c ON c.id = e.cliente_id
    WHERE e.estado IN ('pendiente','en_camino')
      AND e.orden_id IS NOT NULL
      AND o.estado = 'lista'
    ORDER BY e.id ASC
  `);

  res.json(r.rows);
};

// ===============================
// MARCAR ENVIO ENTREGADO
// ===============================
const marcarEnvioEntregado = async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(`
      UPDATE envios
      SET estado = 'entregado'
      WHERE id = $1
    `, [id]);

    res.json({ ok: true });

    // 🔔 Notificar al cliente que su pedido fue entregado
    try {
      const r = await pool.query(`
        SELECT e.orden_id, o.cliente_id
        FROM envios e
        JOIN ordenes o ON o.id = e.orden_id
        WHERE e.id = $1
      `, [id]);
      if (r.rows.length > 0) {
        notificarCliente(
          r.rows[0].cliente_id,
          "📦 Pedido entregado",
          `Tu orden #${r.rows[0].orden_id} fue entregada en tu domicilio. ¡Gracias por elegirnos!`,
          { tipo: "envio_entregado", orden_id: r.rows[0].orden_id }
        );
      }
    } catch (e) {
      console.error("Error notificando entrega:", e.message);
    }
  } catch (error) {
    console.error("marcarEnvioEntregado:", error);
    res.status(500).json({ error: "Error marcando envío" });
  }
};

// ===============================
// 🆕 MARCAR ENVIO EN CAMINO
// (cuando el repartidor sale a entregar)
// ===============================
const marcarEnvioEnCamino = async (req, res) => {
  const { id } = req.params;

  try {
    const r = await pool.query(`
      UPDATE envios
      SET estado = 'en_camino'
      WHERE id = $1
        AND estado = 'pendiente'
      RETURNING orden_id, cliente_id, direccion
    `, [id]);

    if (r.rows.length === 0) {
      return res.status(404).json({ error: "Envío no encontrado o no está pendiente" });
    }

    const envio = r.rows[0];

    res.json({ ok: true, estado: "en_camino" });

    // 🔔 Notificar al cliente que el repartidor está en camino
    notificarCliente(
      envio.cliente_id,
      "🚚 Tu pedido está en camino",
      `Tu orden #${envio.orden_id} ya está en camino a tu domicilio. Estate atento al timbre 🛎️`,
      { tipo: "envio_en_camino", orden_id: envio.orden_id, envio_id: id }
    );

    // WhatsApp al cliente
    try {
      const clienteRes = await pool.query(
        `SELECT nombre, telefono FROM clientes WHERE id = $1`,
        [envio.cliente_id]
      );

      if (clienteRes.rows.length > 0 && clienteRes.rows[0].telefono) {
        const { nombre, telefono } = clienteRes.rows[0];

        const mensaje = `🧺 *Lavaderos Moreno*

Hola ${nombre}! 👋
Tu pedido ya está *en camino* a tu domicilio 🚚

📍 ${envio.direccion}

📌 *Importante:* Estate atento al timbre 🛎️
En caso de no encontrar a nadie en el domicilio, deberás abonar nuevamente el envío para que volvamos a intentarlo.

Cualquier consulta escribinos 😊`.trim();

        await enviarWhatsApp({ telefono, mensaje });
      }
    } catch (e) {
      console.error("Error enviando WhatsApp envío en camino:", e.message);
    }

  } catch (error) {
    console.error("marcarEnvioEnCamino:", error);
    res.status(500).json({ error: "Error marcando envío en camino" });
  }
};

// ===============================
// ENTREGAR ENVIO (app movil)
// ===============================
const entregarEnvio = async (req, res) => {
  const { id } = req.params;
  const { metodo_pago = "Efectivo" } = req.body;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Buscar envio + total sumado de TODAS las órdenes asociadas
    const envioRes = await client.query(`
      SELECT
        e.id,
        e.orden_id,
        e.cliente_id,
        COALESCE(SUM(o.total), 0) AS total_sum,
        COALESCE(SUM(o.senia), 0) AS senia_sum,
        ARRAY_AGG(o.id) AS ordenes_asociadas
      FROM envios e
      JOIN envio_ordenes eo ON eo.envio_id = e.id
      JOIN ordenes o ON o.id = eo.orden_id
      WHERE e.id = $1
        AND e.estado IN ('pendiente','en_camino')
      GROUP BY e.id, e.orden_id, e.cliente_id
    `, [id]);

    if (envioRes.rows.length === 0) {
      // Fallback: envío viejo sin registro en envio_ordenes
      const fallbackRes = await client.query(`
        SELECT e.id, e.orden_id, e.cliente_id, o.total AS total_sum, o.senia AS senia_sum,
               ARRAY[o.id] AS ordenes_asociadas
        FROM envios e
        JOIN ordenes o ON o.id = e.orden_id
        WHERE e.id = $1
          AND e.estado IN ('pendiente','en_camino')
      `, [id]);

      if (fallbackRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Envío no encontrado" });
      }
      envioRes.rows = fallbackRes.rows;
    }

    const envio = envioRes.rows[0];
    const ordenesAsociadas = envio.ordenes_asociadas || [envio.orden_id];

    // Buscar caja abierta
    const cajaRes = await client.query(`
      SELECT id
      FROM turnos_caja
      WHERE estado='abierta'
      ORDER BY id DESC
      LIMIT 1
    `);

    if (cajaRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "No hay caja abierta" });
    }

    const caja_id = cajaRes.rows[0].id;

    // Calcular restante
    const total = Number(envio.total_sum);
    const senia = Number(envio.senia_sum) || 0;
    const restante = total - senia;

    // Marcar envio entregado
    await client.query(`
      UPDATE envios
      SET estado='entregado'
      WHERE id=$1
    `, [id]);

    // 🔥 Marcar TODAS las órdenes asociadas como entregadas
    await client.query(`
      UPDATE ordenes
      SET estado='entregada'
      WHERE id = ANY($1::int[])
    `, [ordenesAsociadas]);

    // Registrar ingreso
    if (restante > 0) {
      await client.query(`
        INSERT INTO caja_movimientos
        (caja_id,tipo,descripcion,monto,forma_pago,creado_en)
        VALUES ($1,'ingreso',$2,$3,$4,(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires'))
      `, [
        caja_id,
        ordenesAsociadas.length > 1
          ? `Cobro envío órdenes #${ordenesAsociadas.join(', #')}`
          : `Cobro envío orden #${envio.orden_id}`,
        restante,
        metodo_pago === "Efectivo"
          ? "Efectivo"
          : "Transferencia/MercadoPago"
      ]);
    }

    await client.query("COMMIT");

    res.json({ ok: true, ordenes_entregadas: ordenesAsociadas });

    // 🔔 Notificar al cliente que su pedido fue entregado en su domicilio
    try {
      const clienteRes = await pool.query(
        "SELECT cliente_id FROM ordenes WHERE id = $1",
        [envio.orden_id]
      );
      if (clienteRes.rows.length > 0) {
        const detalleOrdenes = ordenesAsociadas.length > 1
          ? `tus órdenes #${ordenesAsociadas.join(', #')} fueron entregadas`
          : `tu orden #${envio.orden_id} fue entregada`;
        notificarCliente(
          clienteRes.rows[0].cliente_id,
          "📦 Pedido entregado",
          `${detalleOrdenes} en tu domicilio. ¡Gracias por elegirnos!`,
          { tipo: "envio_entregado", orden_id: envio.orden_id }
        );
      }
    } catch (e) {
      console.error("Error notificando entrega:", e.message);
    }

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Error entregando envío" });
  } finally {
    client.release();
  }
};

// ===============================
// LISTAR ENVIOS ENTREGADOS
// ===============================
const getEnviosEntregados = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT 
        e.id,
        e.direccion,
        e.zona,
        e.estado,
        c.nombre AS cliente,
        o.id AS orden_id,
        o.total,
        o.fecha_retiro
      FROM envios e
      JOIN clientes c ON c.id = e.cliente_id
      JOIN ordenes o ON o.id = e.orden_id
      WHERE e.estado = 'entregado'
      ORDER BY e.id DESC
    `);

    res.json(r.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error obteniendo envíos entregados" });
  }
};

// ===============================
// ENVIO ACTIVO POR CLIENTE
// ===============================
const getEnvioActivo = async (req, res) => {
  try {
    const { clienteId } = req.query;

    if (!clienteId) {
      return res.status(400).json({ error: "clienteId requerido" });
    }

    const r = await pool.query(`
      SELECT *
      FROM envios
      WHERE cliente_id = $1
        AND estado IN ('pendiente','aceptado','en_camino')
      ORDER BY id DESC
      LIMIT 1
    `, [clienteId]);

    if (r.rows.length === 0) {
      return res.json({ activo: false });
    }

    res.json({
      activo: true,
      envio: r.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error obteniendo envío activo" });
  }
};

// POST /envios/desde-orden
// Acepta:
//   { orden_id: 123 }                    → un envío para 1 orden
//   { orden_ids: [123, 124, 125] }       → un envío para varias órdenes
const crearEnvioDesdeOrden = async (req, res) => {
  let { orden_id, orden_ids } = req.body;

  // Normalizar entrada: siempre trabajamos con array
  if (!orden_ids && orden_id) {
    orden_ids = [orden_id];
  }
  if (!Array.isArray(orden_ids) || orden_ids.length === 0) {
    return res.status(400).json({ error: "Falta orden_id u orden_ids" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Validar que todas las órdenes sean del mismo cliente, estén listas y sin envío
    const ordenesRes = await client.query(`
      SELECT o.id, o.cliente_id, c.lat, c.lng, c.direccion
      FROM ordenes o
      JOIN clientes c ON c.id = o.cliente_id
      WHERE o.id = ANY($1::int[])
        AND o.estado = 'lista'
        AND (o.tiene_envio = false OR o.tiene_envio IS NULL)
    `, [orden_ids]);

    if (ordenesRes.rows.length !== orden_ids.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Una o más órdenes no son válidas (deben estar listas y sin envío)"
      });
    }

    const clienteIds = [...new Set(ordenesRes.rows.map(o => o.cliente_id))];
    if (clienteIds.length > 1) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Las órdenes pertenecen a clientes distintos"
      });
    }

    const { cliente_id, lat, lng, direccion } = ordenesRes.rows[0];
    const zonaInfo = await obtenerZonaCliente(lat, lng);

    // Creamos UN solo envío (orden_id = la primera orden, como referencia principal)
    // Pero asociamos TODAS las órdenes en envio_ordenes
    const ordenPrincipal = orden_ids[0];

    const result = await client.query(`
      INSERT INTO envios
      (cliente_id, orden_id, zona, direccion, precio, estado, tipo)
      VALUES ($1,$2,$3,$4,$5,'esperando_pago','envio')
      RETURNING *
    `, [
      cliente_id,
      ordenPrincipal,
      zonaInfo.zona,
      direccion,
      zonaInfo.precio
    ]);

    const envio = result.rows[0];

    // Insertar la relación N:N en envio_ordenes
    for (const oid of orden_ids) {
      await client.query(`
        INSERT INTO envio_ordenes (envio_id, orden_id)
        VALUES ($1, $2)
        ON CONFLICT (envio_id, orden_id) DO NOTHING
      `, [envio.id, oid]);
    }

    await client.query("COMMIT");

    res.json({
      ok: true,
      envio,
      ordenes_asociadas: orden_ids
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creando envío desde orden:", error);
    res.status(500).json({ error: "Error creando envío" });
  } finally {
    client.release();
  }
};

module.exports = {
  crearEnvioDesdeOrden,
  getEnvioActivo,
  entregarEnvio,
  getEnviosEntregados,
  marcarEnvioEntregado,
  marcarEnvioEnCamino,
  crearEnvioPrePago,
  getEnviosPendientes,
  envioFallido
};

// ======================================
// ENVÍO FALLIDO — pasar orden a lista para retirar
// ======================================
async function envioFallido(req, res) {
  const { id } = req.params; // id del envío
  try {
    // Obtener el envío y su orden
    const envioRes = await pool.query(
      `SELECT e.id, e.orden_id, c.nombre, c.telefono
       FROM envios e
       JOIN clientes c ON c.id = e.cliente_id
       WHERE e.id = $1`, [id]
    );

    if (envioRes.rows.length === 0) {
      return res.status(404).json({ error: "Envío no encontrado" });
    }

    const envio = envioRes.rows[0];

    if (!envio.orden_id) {
      return res.status(400).json({ error: "El envío no tiene orden asociada" });
    }

    // Marcar envío como fallido (estado cancelado)
    await pool.query(
      `UPDATE envios SET estado = 'cancelado' WHERE id = $1`, [id]
    );

    // Pasar la orden a estado lista sin envío
    await pool.query(
      `UPDATE ordenes SET tiene_envio = false WHERE id = $1`, [envio.orden_id]
    );

    // 🔔 Notificar al cliente que el envío falló
    try {
      const ordRes = await pool.query(
        "SELECT cliente_id FROM ordenes WHERE id = $1",
        [envio.orden_id]
      );
      if (ordRes.rows.length > 0) {
        notificarCliente(
          ordRes.rows[0].cliente_id,
          "⚠️ No pudimos entregar tu pedido",
          `Pasamos por tu domicilio pero no había nadie. Tu orden #${envio.orden_id} quedó lista para retirar en el local o podés solicitar un nuevo envío desde la app.`,
          { tipo: "envio_fallido", orden_id: envio.orden_id }
        );
      }
    } catch (e) {
      console.error("Error notificando envío fallido:", e.message);
    }

    // Generar WhatsApp avisando que debe abonar nuevo envío
    let whatsapp_url = null;
    if (envio.telefono) {
      const telefono = envio.telefono.replace(/\D/g, "");
      const mensaje = `🧺 *Lavaderos Moreno*

Hola ${envio.nombre}! 👋
Intentamos entregar tu orden pero no encontramos a nadie en el domicilio 😕

Tu ropa quedó guardada en el local lista para retirar.

Si querés que te lo enviemos nuevamente, podés coordinarlo desde nuestra app:
📱 Abrí *Lavaderos Moreno* → *Mis órdenes* → seleccioná tu orden → tocá *Solicitar envío a domicilio* → abonás el envío y listo ✅

También podés pasarte a retirarla personalmente:
📍 Hipólito Yrigoyen 1471, Moreno
🕐 Lunes a Sábados de 9 a 18hs

Cualquier consulta escribinos por acá 😊`.trim();

      const result = await enviarWhatsApp({ telefono, mensaje });
      if (!result.automatico) {
        whatsapp_url = result.whatsapp_url;
      }
    }

    res.json({ ok: true, whatsapp_url });

  } catch (error) {
    console.error("ERROR envioFallido:", error);
    res.status(500).json({ error: "Error procesando envío fallido" });
  }
}