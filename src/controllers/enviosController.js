const pool = require("../db");
const obtenerZonaCliente = require("../helpers/zonaCliente");

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

    const zonaInfo = obtenerZonaCliente(lat, lng);


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
    WHERE e.estado='pendiente'
      AND e.orden_id IS NOT NULL
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
  } catch (error) {
    console.error("marcarEnvioEntregado:", error);
    res.status(500).json({ error: "Error marcando envío" });
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

    // Buscar envio
    const envioRes = await client.query(`
      SELECT e.id, e.orden_id, o.total, o.senia
      FROM envios e
      JOIN ordenes o ON o.id = e.orden_id
      WHERE e.id = $1
        AND e.estado = 'pendiente'
    `, [id]);

    if (envioRes.rows.length === 0) {
      return res.status(404).json({ error: "Envío no encontrado" });
    }

    const envio = envioRes.rows[0];

    // Buscar caja abierta
    const cajaRes = await client.query(`
      SELECT id
      FROM turnos_caja
      WHERE estado='abierta'
      ORDER BY id DESC
      LIMIT 1
    `);

    if (cajaRes.rows.length === 0) {
      return res.status(400).json({ error: "No hay caja abierta" });
    }

    const caja_id = cajaRes.rows[0].id;

    // Calcular restante
    const total = Number(envio.total);
    const senia = Number(envio.senia) || 0;
    const restante = total - senia;

    // Marcar envio entregado
    await client.query(`
      UPDATE envios
      SET estado='entregado'
      WHERE id=$1
    `, [id]);

// 🔥 NUEVO: Marcar orden como entregada
await client.query(`
  UPDATE ordenes
  SET estado='entregada'
  WHERE id=$1
`, [envio.orden_id]);

    // Registrar ingreso
    if (restante > 0) {
      await client.query(`
        INSERT INTO caja_movimientos
        (caja_id,tipo,descripcion,monto,forma_pago)
        VALUES ($1,'ingreso',$2,$3,$4)
      `, [
        caja_id,
        `Cobro envío orden #${envio.orden_id}`,
        restante,
        metodo_pago === "Efectivo"
          ? "Efectivo"
          : "Transferencia/MercadoPago"
      ]);
    }

    await client.query("COMMIT");

    res.json({ ok: true });

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
const crearEnvioDesdeOrden = async (req, res) => {
  const { orden_id } = req.body;

  try {

    const ordenRes = await pool.query(`
      SELECT o.cliente_id, c.lat, c.lng, c.direccion
      FROM ordenes o
      JOIN clientes c ON c.id = o.cliente_id
      WHERE o.id = $1
        AND o.estado = 'lista'
        AND (o.tiene_envio = false OR o.tiene_envio IS NULL)
    `, [orden_id]);

    if (ordenRes.rows.length === 0) {
      return res.status(400).json({ error: "Orden no válida para envío" });
    }

    const { cliente_id, lat, lng, direccion } = ordenRes.rows[0];

    const zonaInfo = obtenerZonaCliente(lat, lng);

    const result = await pool.query(`
      INSERT INTO envios
      (cliente_id, orden_id, zona, direccion, precio, estado, tipo)
      VALUES ($1,$2,$3,$4,$5,'esperando_pago','envio')
      RETURNING *
    `, [
      cliente_id,
      orden_id,
      zonaInfo.zona,
      direccion,
      zonaInfo.precio
    ]);

    res.json({
      ok: true,
      envio: result.rows[0]
    });

  } catch (error) {
    console.error("Error creando envío desde orden:", error);
    res.status(500).json({ error: "Error creando envío" });
  }
};

module.exports = {
  crearEnvioDesdeOrden,
  getEnvioActivo,
  entregarEnvio,
  getEnviosEntregados,
  marcarEnvioEntregado,
  crearEnvioPrePago,
  getEnviosPendientes
};