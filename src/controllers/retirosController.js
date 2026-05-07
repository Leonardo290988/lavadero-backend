const pool = require("../db");
console.log("🔥 RETIROS CONTROLLER CARGADO 🔥");
const generarTicketRetiro = require("../utils/generarTicketRetiro");
const generarTicketProvisorio = require("../utils/generarTicketProvisorio");
const obtenerZonaCliente = require("../helpers/zonaCliente");
const enviarPushNotification = require("../helpers/enviarPushNotification");
const enviarWhatsApp = require("../helpers/enviarWhatsApp");
const notificarCliente = require("../helpers/notificarCliente"); // 🆕



// ===============================
// CREAR RETIRO PRE-PAGO (cliente)
// ===============================
const crearRetiroPrePago = async (req, res) => {

  try {
    const { cliente_id, direccion, tipo, quiere_envio } = req.body;

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

    // 🔹 Crear retiro
    const retiroRes = await pool.query(
      `
      INSERT INTO retiros
      (cliente_id, zona, direccion, precio, estado, tipo)
      VALUES ($1,$2,$3,$4,'esperando_pago','retiro')
      RETURNING *
      `,
      [
        cliente_id,
        zonaInfo.zona,
        direccion,
        zonaInfo.precio
      ]
    );

    let envioCreado = null;

    // 🔹 Si pidió envío también lo creamos
    if (quiere_envio) {

      const envioRes = await pool.query(
        `
        INSERT INTO envios
        (cliente_id, zona, direccion, precio, estado)
        VALUES ($1,$2,$3,$4,'pendiente')
        RETURNING *
        `,
        [
          cliente_id,
          zonaInfo.zona,
          direccion,
          zonaInfo.precio
        ]
      );

      envioCreado = envioRes.rows[0];
    }

    res.json({
      ok: true,
      retiro: retiroRes.rows[0],
      envio: envioCreado
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error creando retiro"
    });
  }
};



// ===============================
// LISTAR PENDIENTES
// ===============================
const getRetirosPendientes = async (req, res) => {
  const r = await pool.query(`
    SELECT
      r.id,
      r.tipo,
      r.zona,
      r.direccion,
      r.precio,
      r.estado,
      r.intentos,
      c.nombre AS cliente,
      EXISTS (
        SELECT 1 FROM envios e
        WHERE e.cliente_id = r.cliente_id
          AND e.orden_id IS NULL
          AND e.estado IN ('pendiente','aceptado','esperando_pago')
      ) AS quiere_envio
    FROM retiros r
    JOIN clientes c ON c.id = r.cliente_id
    WHERE r.estado IN ('pendiente', 'aceptado', 'en_camino')
    ORDER BY r.creado_en ASC
  `);

  res.json(r.rows);
};

// ===============================
// 🆕 LISTAR RETIROS DE UN CLIENTE
// (para la pantalla "Mis órdenes" de la app)
// ===============================
const getRetirosCliente = async (req, res) => {
  const { id } = req.params;

  try {
    const r = await pool.query(`
      SELECT
        id,
        cliente_id,
        zona,
        direccion,
        precio,
        estado,
        tipo,
        intentos,
        creado_en AS created_at
      FROM retiros
      WHERE cliente_id = $1
        AND estado IN ('pendiente','aceptado','en_camino')
      ORDER BY creado_en DESC
    `, [id]);

    // Sumamos info de envío si existe (para mostrar "Incluye envío")
    const enriched = await Promise.all(r.rows.map(async (ret) => {
      const envio = await pool.query(`
        SELECT id FROM envios
        WHERE cliente_id = $1
          AND orden_id IS NULL
          AND estado IN ('pendiente','aceptado','esperando_pago')
        LIMIT 1
      `, [ret.cliente_id]);

      return {
        ...ret,
        quiere_envio: envio.rows.length > 0,
      };
    }));

    res.json(enriched);
  } catch (error) {
    console.error("ERROR getRetirosCliente:", error);
    res.status(500).json([]);
  }
};

// ===============================
// ACEPTAR RETIRO
// ===============================
const aceptarRetiro = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1️⃣ Traer retiro + cliente
    const retiroRes = await client.query(`
      SELECT r.*, c.nombre, c.telefono
      FROM retiros r
      JOIN clientes c ON c.id = r.cliente_id
      WHERE r.id=$1
    `,[id]);

    if (retiroRes.rows.length === 0) {
      return res.status(404).json({ error: "Retiro no encontrado" });
    }

    const retiro = retiroRes.rows[0];

    if (retiro.estado !== "pendiente") {
      return res.status(400).json({ error: "Retiro ya procesado" });
    }

    // 2️⃣ SOLO cambiar estado a aceptado
    await client.query(`
      UPDATE retiros
      SET estado='aceptado'
      WHERE id=$1
    `,[id]);

    await client.query("COMMIT");

    // 3️⃣ Generar ticket provisorio (sin orden todavía)
    const nombreArchivo = await generarTicketProvisorio({
      id: retiro.id,
      cliente: retiro.nombre,
      telefono: retiro.telefono,
      direccion: retiro.direccion,
      tiene_envio: false
    });

    res.json({
      ok: true,
      pdf: `/pdf/provisorios/${nombreArchivo}`
    });

    // 4️⃣ Calcular si es hoy o mañana
    const horaArgentina = new Date().toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      hour: "numeric", hour12: false
    });
    const horaActual = parseInt(horaArgentina);
    const esHoy = horaActual < 15;
    const diaRetiro = esHoy ? "hoy" : "mañana";

    // 5️⃣ 🔔 PUSH a la app del cliente
    notificarCliente(
      retiro.cliente_id,
      "✅ Retiro aceptado",
      `Pasaremos ${diaRetiro} entre las 16 y 18 hs por tu domicilio.`,
      { tipo: "retiro_aceptado", retiro_id: retiro.id }
    );

    // 6️⃣ WhatsApp al cliente
    if (retiro.telefono) {
      const mensaje = `🧺 *Lavaderos Moreno*

Hola ${retiro.nombre}! 👋
Tu solicitud de retiro fue *aceptada* ✅

🚚 Pasaremos a retirar tu ropa *${diaRetiro}* entre las *16 y 18hs*.
📍 ${retiro.direccion}

📌 *Importante:* Si no podés estar en ese horario, avisanos con anticipación.
En caso de no encontrar a nadie en el domicilio al momento del retiro, perderás el retiro y deberás volver a solicitarlo y abonarlo.

Cualquier consulta escribinos 😊`.trim();

      try {
        await enviarWhatsApp({ telefono: retiro.telefono, mensaje });
      } catch (e) {
        console.error("Error enviando WhatsApp retiro aceptado:", e.message);
      }
    }

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Error aceptando retiro" });
  } finally {
    client.release();
  }
};

// ===============================
// RECHAZAR RETIRO (local)
// ===============================
const rechazarRetiro = async (req,res)=>{
  const { id } = req.params;

  try {

    const r = await pool.query(`
      UPDATE retiros
      SET estado='rechazado'
      WHERE id=$1 AND estado='pendiente'
      RETURNING *
    `,[id]);

    if(r.rows.length === 0){
      return res.status(404).json({error:"Retiro no encontrado"});
    }

    const retiro = r.rows[0];

    res.json({ok:true});

    // 🔔 Notificar al cliente del rechazo
    notificarCliente(
      retiro.cliente_id,
      "❌ Retiro rechazado",
      "Lamentamos informarte que tu solicitud de retiro no pudo ser aceptada. Comunicate con nosotros para más info.",
      { tipo: "retiro_rechazado", retiro_id: retiro.id }
    );

  } catch(error){
    console.error(error);
    res.status(500).json({error:"Error rechazando retiro"});
  }
};

// ===============================
// CANCELAR RETIRO CLIENTE
// ===============================
const cancelarRetiroCliente = async (req,res)=>{
  const { id } = req.params;

  try {

    const r = await pool.query(`
      UPDATE retiros
      SET estado='cancelado_cliente'
      WHERE id=$1 AND estado='pendiente'
      RETURNING *
    `,[id]);

    if(r.rows.length === 0){
      return res.status(404).json({error:"Retiro no encontrado"});
    }

    res.json({ok:true});

  } catch(error){
    console.error(error);
    res.status(500).json({error:"Error cancelando retiro"});
  }
};


// ===============================
// 🆕 MARCAR RETIRO FALLIDO (no se encontró nadie en el domicilio)
// ===============================
// - Si es SOLO retiro y falla el 1er intento → cancelado directo
// - Si es retiro + envío y falla el 1er intento → retiro vuelve a "aceptado"
//   y el envío se anula
// - 2do intento fallido (cualquier caso) → cancelado definitivo
const marcarRetiroFallido = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1️⃣ Traer retiro + cliente
    const retiroRes = await client.query(`
      SELECT r.*, c.nombre, c.telefono
      FROM retiros r
      JOIN clientes c ON c.id = r.cliente_id
      WHERE r.id = $1
        AND r.estado = 'en_camino'
    `, [id]);

    if (retiroRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: "Retiro no encontrado o no está en camino"
      });
    }

    const retiro = retiroRes.rows[0];
    const intentosPrevios = retiro.intentos || 0;
    const nuevoIntento = intentosPrevios + 1;

    // 2️⃣ ¿Tenía envío asociado?
    const envioRes = await client.query(`
      SELECT id
      FROM envios
      WHERE cliente_id = $1
        AND orden_id IS NULL
        AND estado IN ('pendiente','aceptado','esperando_pago')
      LIMIT 1
    `, [retiro.cliente_id]);

    const teniaEnvio = envioRes.rows.length > 0;
    const envioId = teniaEnvio ? envioRes.rows[0].id : null;

    // 3️⃣ Decidir qué hacer según el caso
    let accion = ""; // "reprogramado" | "cancelado"

    if (nuevoIntento >= 2) {
      // 2do intento fallido → cancelado definitivo
      accion = "cancelado";
    } else if (teniaEnvio) {
      // 1er intento fallido + tenía envío → reprogramar (sin envío)
      accion = "reprogramado";
    } else {
      // 1er intento fallido + sin envío → cancelado directo
      accion = "cancelado";
    }

    // 4️⃣ Aplicar cambios
    if (accion === "reprogramado") {
      await client.query(`
        UPDATE retiros
        SET estado = 'aceptado',
            intentos = $1
        WHERE id = $2
      `, [nuevoIntento, id]);

      // Cancelar el envío
      if (envioId) {
        await client.query(`
          UPDATE envios
          SET estado = 'cancelado'
          WHERE id = $1
        `, [envioId]);
      }
    } else {
      // Cancelado
      await client.query(`
        UPDATE retiros
        SET estado = 'fallido',
            intentos = $1
        WHERE id = $2
      `, [nuevoIntento, id]);

      // Si tenía envío, también cancelarlo
      if (envioId) {
        await client.query(`
          UPDATE envios
          SET estado = 'cancelado'
          WHERE id = $1
        `, [envioId]);
      }
    }

    await client.query("COMMIT");

    res.json({
      ok: true,
      accion,
      intentos: nuevoIntento,
      tenia_envio: teniaEnvio
    });

    // 5️⃣ 🔔 Notificación push + WhatsApp según el caso
    if (accion === "reprogramado") {
      // Reprogramado: 1er intento fallido + tenía envío
      notificarCliente(
        retiro.cliente_id,
        "⚠️ No pudimos retirar tu ropa",
        "Pasamos por tu domicilio y no había nadie. Reprogramamos para el día siguiente. Tu envío fue anulado: si querés envío deberás abonarlo nuevamente.",
        { tipo: "retiro_fallido_reprogramado", retiro_id: retiro.id }
      );

      if (retiro.telefono) {
        const mensaje = `🧺 *Lavaderos Moreno*

Hola ${retiro.nombre} 👋

Pasamos por tu domicilio para retirar tu ropa pero *no había nadie* 🏚️

🔄 *Reprogramamos el retiro para el día siguiente*, en el mismo horario (16 a 18hs).

⚠️ *Importante:* tu envío a domicilio quedó *anulado*. Si querés que volvamos a entregarte la ropa en tu domicilio cuando esté lista, deberás abonar el envío nuevamente desde la app.

📌 Por favor, asegurate de estar presente en el próximo intento. Si vuelve a fallar, deberás solicitar y abonar el retiro nuevamente.

Cualquier consulta escribinos 😊`.trim();

        try {
          await enviarWhatsApp({ telefono: retiro.telefono, mensaje });
        } catch (e) {
          console.error("Error enviando WhatsApp retiro fallido reprogramado:", e.message);
        }
      }
    } else {
      // Cancelado definitivo (1er intento sin envío, o 2do intento)
      const esSegundoIntento = nuevoIntento >= 2;

      notificarCliente(
        retiro.cliente_id,
        "❌ Retiro cancelado",
        esSegundoIntento
          ? "Pasamos por segunda vez y no pudimos retirar tu ropa. Para volver a solicitar el servicio deberás abonar nuevamente desde la app."
          : "Pasamos por tu domicilio y no había nadie. Para volver a solicitar el retiro deberás abonarlo nuevamente desde la app.",
        { tipo: "retiro_cancelado", retiro_id: retiro.id }
      );

      if (retiro.telefono) {
        const mensaje = esSegundoIntento
          ? `🧺 *Lavaderos Moreno*

Hola ${retiro.nombre} 👋

Pasamos por *segunda vez* a retirar tu ropa pero nuevamente *no había nadie* en el domicilio 🏚️

❌ Por este motivo el pedido de retiro queda *cancelado*.

🔄 Si querés volver a solicitar el servicio, deberás *abonarlo nuevamente* desde la app.

Cualquier consulta escribinos 😊`.trim()
          : `🧺 *Lavaderos Moreno*

Hola ${retiro.nombre} 👋

Pasamos por tu domicilio para retirar tu ropa pero *no había nadie* 🏚️

❌ Por este motivo el pedido queda *cancelado*.

🔄 Si querés volver a solicitar el retiro, deberás *abonarlo nuevamente* desde la app.

Cualquier consulta escribinos 😊`.trim();

        try {
          await enviarWhatsApp({ telefono: retiro.telefono, mensaje });
        } catch (e) {
          console.error("Error enviando WhatsApp retiro cancelado:", e.message);
        }
      }
    }

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error marcarRetiroFallido:", error);
    res.status(500).json({ error: "Error marcando retiro fallido" });
  } finally {
    client.release();
  }
};


// ===============================
// MARCAR EN CAMINO
// ===============================
const marcarEnCamino = async (req,res)=>{
  const { id } = req.params;

  try {
    const r = await pool.query(`
      UPDATE retiros
      SET estado='en_camino'
      WHERE id=$1 AND estado='aceptado'
      RETURNING *
    `,[id]);

    if(r.rows.length === 0){
      return res.status(404).json({error:"Retiro no encontrado"});
    }

    const retiro = r.rows[0];

    res.json({ ok: true, estado: "en_camino" });

    // 🔔 Push a la app del cliente
    notificarCliente(
      retiro.cliente_id,
      "🚚 Vamos en camino",
      "Salimos a retirar tu ropa. Estate atento al timbre 🛎️",
      { tipo: "retiro_en_camino", retiro_id: retiro.id }
    );

    // WhatsApp al cliente
    const clienteRes = await pool.query(
      `SELECT nombre, telefono FROM clientes WHERE id = $1`,
      [retiro.cliente_id]
    );

    if (clienteRes.rows.length > 0 && clienteRes.rows[0].telefono) {
      const { nombre, telefono } = clienteRes.rows[0];

      const mensaje = `🧺 *Lavaderos Moreno*

Hola ${nombre}! 👋
Ya estamos *en camino* a retirar tu ropa 🚚

📍 ${retiro.direccion}

📌 *Importante:* En caso de no encontrar a nadie en el domicilio al momento del retiro, perderás el retiro y deberás volver a solicitarlo y abonarlo.

Cualquier consulta escribinos 😊`.trim();

      try {
        await enviarWhatsApp({ telefono, mensaje });
      } catch (e) {
        console.error("Error enviando WhatsApp en camino:", e.message);
      }
    }

  } catch(error){
    console.error(error);
    res.status(500).json({error:"Error marcando en camino"});
  }
};

// ===============================
// PREVIEW RETIRO (APP CLIENTE)
// ===============================
const obtenerPreviewRetiro = async (req, res) => {
  try {
    const { clienteId } = req.query;

    if (!clienteId) {
      return res.status(400).json({ error: "clienteId requerido" });
    }

    const clienteRes = await pool.query(
      `
      SELECT direccion, lat, lng
      FROM clientes
      WHERE id = $1
      `,
      [clienteId]
    );

    if (clienteRes.rows.length === 0) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    const cliente = clienteRes.rows[0];

    const zonaInfo = await obtenerZonaCliente(cliente.lat, cliente.lng);

    res.json({
      ok: true,
      direccion: cliente.direccion,
      zona: `Zona ${zonaInfo.zona}`,
      precio: zonaInfo.precio,
      distanciaKm: zonaInfo.distanciaKm,
    });

  } catch (error) {
    console.error("❌ PREVIEW RETIRO ERROR:", error);
    res.status(500).json({ error: "Error calculando retiro" });
  }
};

// ===============================
// RETIRO ACTIVO POR CLIENTE
// ===============================
const getRetiroActivoCliente = async (req, res) => {
  try {
    const { clienteId } = req.query;

    const r = await pool.query(`
      SELECT *
      FROM retiros
      WHERE cliente_id = $1
        AND estado IN ('pendiente','aceptado','en_camino')
      ORDER BY creado_en DESC
      LIMIT 1
    `,[clienteId]);

    if(r.rows.length === 0){
      return res.json({ activo:false });
    }

    res.json({
      activo:true,
      retiro:r.rows[0]
    });

  } catch(error){
    console.error(error);
    res.status(500).json({error:"Error consultando retiro activo"});
  }
};

// ===============================
// MARCAR COMO RETIRADO
// ===============================
const marcarRetirado = async (req,res)=>{
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const retiroRes = await client.query(`
      SELECT *
      FROM retiros
      WHERE id=$1 AND estado='en_camino'
    `,[id]);

    if(retiroRes.rows.length === 0){
      return res.status(404).json({error:"Retiro no encontrado"});
    }

    const retiro = retiroRes.rows[0];

    const ordenRes = await client.query(`
      INSERT INTO ordenes
      (cliente_id, estado, fecha_ingreso, tiene_envio)
      VALUES ($1,'ingresado',(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires'),false)
      RETURNING *
    `,[retiro.cliente_id]);

    const orden = ordenRes.rows[0];

    let tieneEnvio = false;

    const envioRes = await client.query(`
      SELECT id
      FROM envios
      WHERE cliente_id=$1
        AND estado IN ('pendiente','aceptado')
        AND orden_id IS NULL
      LIMIT 1
    `,[retiro.cliente_id]);

    if(envioRes.rows.length > 0){

      tieneEnvio = true;

      await client.query(`
        UPDATE ordenes
        SET tiene_envio=true
        WHERE id=$1
      `,[orden.id]);

      await client.query(`
        UPDATE envios
        SET orden_id=$1
        WHERE id=$2
      `,[orden.id, envioRes.rows[0].id]);

      // 🆕 Registrar también en la tabla N:N
      await client.query(`
        INSERT INTO envio_ordenes (envio_id, orden_id)
        VALUES ($1, $2)
        ON CONFLICT (envio_id, orden_id) DO NOTHING
      `, [envioRes.rows[0].id, orden.id]);
    }

    await client.query(`
      UPDATE retiros
      SET estado='retirado',
          orden_id=$1
      WHERE id=$2
    `,[orden.id, id]);

    await client.query("COMMIT");

    res.json({
      ok:true,
      orden_id: orden.id,
      tiene_envio: tieneEnvio
    });

    // 🔔 Push: ya pasamos a retirar tu ropa
    notificarCliente(
      retiro.cliente_id,
      "📦 Ropa retirada",
      `Tu ropa fue retirada con éxito. Te avisaremos cuando esté lista (orden #${orden.id}).`,
      { tipo: "retiro_completado", orden_id: orden.id }
    );

  } catch(error){
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({error:"Error marcando retirado"});
  } finally {
    client.release();
  }
};


module.exports = {
  getRetiroActivoCliente,
  crearRetiroPrePago,
  aceptarRetiro,
  rechazarRetiro,
  cancelarRetiroCliente,
  getRetirosPendientes,
  getRetirosCliente,
  obtenerPreviewRetiro,
  marcarRetirado,
  marcarEnCamino,
  marcarRetiroFallido
};
