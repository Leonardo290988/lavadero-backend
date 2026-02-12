const pool = require("../db");
console.log("🔥 RETIROS CONTROLLER CARGADO 🔥");
const generarTicketRetiro = require("../utils/generarTicketRetiro");
const generarTicketProvisorio = require("../utils/generarTicketProvisorio");
const  obtenerZonaCliente  = require("../helpers/zonaCliente");



// ===============================
// CREAR RETIRO PRE-PAGO (cliente)
// ===============================
const crearRetiroPrePago = async (req, res) => {

  console.log("🔥 HEADERS:", req.headers);
  console.log("🚀 ENTRO A crearRetiroPrePago", req.body);

  try {
    const { cliente_id, direccion, tipo } = req.body;

    if (!cliente_id || !direccion || !tipo) {
      return res.status(400).json({ error: "Faltan datos" });
    }

    // 1️⃣ Buscar cliente (lat/lng)
    const clienteRes = await pool.query(
      "SELECT lat, lng FROM clientes WHERE id = $1",
      [cliente_id]
    );

    if (clienteRes.rows.length === 0) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    const { lat, lng } = clienteRes.rows[0];

    if (lat == null || lng == null) {
      throw new Error("Cliente sin lat/lng configurados");
    }

    // 2️⃣ Calcular zona y precio
    const zonaInfo = obtenerZonaCliente(lat, lng);

    console.log("🧪 zonaInfo:", zonaInfo);

    if (!zonaInfo || !zonaInfo.zona || !zonaInfo.precio) {
      throw new Error("zonaInfo inválido: " + JSON.stringify(zonaInfo));
    }

    // 0️⃣ Verificar si ya hay retiro esperando_pago
const existente = await pool.query(`
  SELECT *
  FROM retiros
  WHERE cliente_id = $1
  AND estado = 'esperando_pago'
  ORDER BY id DESC
  LIMIT 1
`, [cliente_id]);

if (existente.rows.length > 0) {
  return res.json({
    ok: true,
    retiro: existente.rows[0]
  });
}

    // 3️⃣ Insertar retiro
    const result = await pool.query(
      `
      INSERT INTO retiros
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
      retiro: result.rows[0]
    });

  } catch (error) {
    console.error("❌ ERROR crearRetiroPrePago");
    console.error(error);
    console.error("STACK:", error.stack);

    res.status(500).json({
      error: "Error creando retiro",
      detalle: error.message,
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
      c.nombre AS cliente
    FROM retiros r
    JOIN clientes c ON c.id = r.cliente_id
    WHERE r.estado = 'pendiente'
    ORDER BY r.creado_en ASC
  `);

  res.json(r.rows);
};

// ===============================
// ACEPTAR RETIRO
// ===============================
const aceptarRetiro = async (req, res) => {
  const { id } = req.params;

  try {

    // 1️⃣ Traer retiro + cliente
    const retiroRes = await pool.query(`
      SELECT r.*, c.nombre AS cliente, c.telefono
      FROM retiros r
      JOIN clientes c ON c.id = r.cliente_id
      WHERE r.id = $1
        AND r.estado = 'pendiente'
    `,[id]);

    if (retiroRes.rows.length === 0) {
      return res.status(404).json({ error:"Retiro no encontrado o ya procesado" });
    }

    const retiro = retiroRes.rows[0];

    // 2️⃣ Ver si ya existe envío pendiente sin orden
    const envioRes = await pool.query(`
      SELECT id
      FROM envios
      WHERE cliente_id = $1
        AND estado = 'pendiente'
        AND orden_id IS NULL
      LIMIT 1
    `,[retiro.cliente_id]);

    const tieneEnvio = envioRes.rows.length > 0;

    // 3️⃣ Actualizar estado del retiro
    await pool.query(`
      UPDATE retiros
      SET estado = 'aceptado'
      WHERE id = $1
    `,[id]);

    // 4️⃣ Generar ticket provisorio
    const nombreArchivo = await generarTicketProvisorio({
      id: retiro.id,
      cliente: retiro.cliente,
      telefono: retiro.telefono,
      direccion: retiro.direccion,
      tiene_envio: tieneEnvio
    });

    // 5️⃣ Responder
    res.json({
      ok:true,
      retiro_id: retiro.id,
      tiene_envio: tieneEnvio,
      pdf: `/pdf/provisorios/${nombreArchivo}`
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error:"Error aceptando retiro" });
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

    res.json({ok:true});

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

    res.json({ok:true});

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

    // 1️⃣ Buscar cliente
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

    // 2️⃣ Calcular zona y precio
    const zonaInfo = obtenerZonaCliente(cliente.lat, cliente.lng);

    // 3️⃣ Responder preview
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
const marcarRetirado = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1️⃣ Buscar retiro
    const retiroRes = await client.query(
      `SELECT * FROM retiros WHERE id=$1`,
      [id]
    );

    if (retiroRes.rows.length === 0) {
      return res.status(404).json({ error: "Retiro no encontrado" });
    }

    const retiro = retiroRes.rows[0];

    if (retiro.estado !== "en_camino") {
      return res.status(400).json({ error: "El retiro no está en camino" });
    }

    // 2️⃣ Crear orden recién ahora
    const ordenRes = await client.query(
      `
      INSERT INTO ordenes
      (cliente_id, estado, fecha_ingreso, tiene_envio)
      VALUES ($1,'ingresado', NOW(), false)
      RETURNING *
      `,
      [retiro.cliente_id]
    );

    const orden = ordenRes.rows[0];

    let tieneEnvio = false;

    // 3️⃣ Ver si existe envío pendiente del mismo cliente
    const envioRes = await client.query(
      `
      SELECT id
      FROM envios
      WHERE cliente_id=$1
        AND estado='pendiente'
        AND orden_id IS NULL
      LIMIT 1
      `,
      [retiro.cliente_id]
    );

    if (envioRes.rows.length > 0) {
      tieneEnvio = true;

      await client.query(
        `UPDATE ordenes SET tiene_envio=true WHERE id=$1`,
        [orden.id]
      );

      await client.query(
        `UPDATE envios SET orden_id=$1 WHERE id=$2`,
        [orden.id, envioRes.rows[0].id]
      );
    }

    // 4️⃣ Actualizar retiro a retirado
    await client.query(
      `
      UPDATE retiros
      SET estado='retirado',
          orden_id=$1
      WHERE id=$2
      `,
      [orden.id, id]
    );

    await client.query("COMMIT");

    res.json({
      ok: true,
      orden_id: orden.id,
      tiene_envio: tieneEnvio
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Error marcando retiro como retirado" });
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
  obtenerPreviewRetiro,
  marcarRetirado,
  marcarEnCamino
};