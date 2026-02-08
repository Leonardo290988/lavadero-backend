const pool = require('../db');
const enviarWhatsApp = require('../helpers/enviarWhatsApp');
const generarTicketOrden = require("../utils/generarTicketOrden");
const imprimirTicket = require("../utils/imprimirTicket");
const generarTicketRetiro = require("../utils/generarTicketRetiro");
const { exec } = require("child_process");
// GET /ordenes
const getOrdenes = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        o.id,
        o.cliente_id,
        c.nombre AS cliente,
        o.estado,
        to_char(
  o.fecha_ingreso AT TIME ZONE 'America/Argentina/Buenos_Aires',
  'DD/MM/YYYY HH24:MI:SS'
)AS fecha_ingreso,
        to_char(
  o.fecha_retiro AT TIME ZONE 'America/Argentina/Buenos_Aires',
  'DD/MM/YYYY HH24:MI:SS'
)AS fecha_retiro,
        o.senia
      FROM ordenes o
      JOIN clientes c ON c.id = o.cliente_id
      ORDER BY o.id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('❌ ERROR GET ORDENES:', error.message);
    res.status(500).json({ error: 'Error al obtener órdenes' });
  }
};

// POST /ordenes
const crearOrden = async (req, res) => {

  const client = await pool.connect();

  try {

    await client.query("BEGIN");

    const {
      cliente_id,
      estado,
      fecha_retiro,
      senia = 0,
      usuario_id
    } = req.body;


     // 2️⃣ Buscar caja abierta
    const cajaResult = await client.query(`
      SELECT id
      FROM turnos_caja
      WHERE estado = 'abierta'
      ORDER BY id DESC
      LIMIT 1
    `);

    if (cajaResult.rows.length === 0) {
      await client.query("ROLLBACK");
      console.log("NO HAY CAJA ABIERTA");
      return res.status(400).json({ error:"Debe abrir caja antes de crear órdenes"
    });
  }
    const caja_id = cajaResult.rows[0].id;

    // 1️⃣ Crear orden

const fechaRetiroFinal = fecha_retiro || null;

    const result = await client.query(`
      INSERT INTO ordenes 
      (cliente_id, estado, fecha_ingreso, fecha_retiro, senia, usuario_id)
      VALUES ($1,$2,(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires'),$3,$4,$5)
      RETURNING *
    `,
      [cliente_id, estado, fechaRetiroFinal, senia, usuario_id]
    );

    const orden = result.rows[0];

   
    console.log("SEÑA RECIBIDA:", senia);

    // 3️⃣ Impactar seña en caja
    if (Number(senia) > 0) {
      await client.query(`
        INSERT INTO caja_movimientos
        (caja_id, tipo, descripcion, monto, forma_pago)
        VALUES ($1,'ingreso',$2,$3,'Efectivo')
      `,
        [
          caja_id,
          `Seña orden #${orden.id}`,
          Number(senia)
        ]
      );
    }

    await client.query("COMMIT");


    res.status(201).json(orden);

  } catch (error) {

    await client.query("ROLLBACK");
    console.error("❌ ERROR CREAR ORDEN:", error.message);
    res.status(500).json({ error: "Error al crear orden" });

  } finally {
    client.release();
  }
};

// POST /ordenes/:id/servicios
const agregarServicioAOrden = async (req, res) => {
  const { id } = req.params;
  const { servicio_id, cantidad } = req.body;

  if (!servicio_id || !cantidad) {
    return res.status(400).json({
      error: 'servicio_id y cantidad son obligatorios'
    });
  }

  try {
    const servicio = await pool.query(
      'SELECT precio FROM servicios WHERE id = $1',
      [servicio_id]
    );

    if (servicio.rows.length === 0) {
      return res.status(404).json({ error: 'Servicio no existe' });
    }

    const precio = servicio.rows[0].precio;

    await pool.query(
      `
      INSERT INTO orden_servicios 
      (orden_id, servicio_id, cantidad, precio_unitario)
      VALUES ($1, $2, $3, $4)
      `,
      [id, servicio_id, cantidad, precio]
    );

    res.status(201).json({ ok: 'Servicio agregado a la orden' });

  } catch (error) {
    console.error('❌ ERROR ORDEN_SERVICIO:', error.message);
    res.status(500).json({ error: 'Error al agregar servicio' });
  }
};

// GET /ordenes/:id/servicios
const getServiciosDeOrden = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(`
      SELECT
        os.id,
        s.nombre,
        os.cantidad,
        os.precio_unitario,
        (os.cantidad * os.precio_unitario) AS total
      FROM orden_servicios os
      JOIN servicios s ON s.id = os.servicio_id
      WHERE os.orden_id = $1
    `, [id]);

    res.json(result.rows);
  } catch (error) {
    console.error('❌ ERROR GET SERVICIOS ORDEN:', error.message);
    res.status(500).json({ error: 'Error al obtener servicios de la orden' });
  }
};

// GET /ordenes/abiertas
const getOrdenesAbiertas = async (req, res) => {
  try {
    const ordenesResult = await pool.query(`
      SELECT
        o.id,
        to_char(
  o.fecha_ingreso AT TIME ZONE 'America/Argentina/Buenos_Aires',
  'DD/MM/YYYY HH24:MI:SS'
) AS fecha_ingreso,
        o.estado,
        o.senia,
        c.nombre AS cliente,
        o.tiene_envio
      FROM ordenes o
      JOIN clientes c ON c.id = o.cliente_id
      WHERE o.estado IN ('ingresado' , 'confirmada')
      ORDER BY o.fecha_ingreso DESC
    `);

    const ordenes = [];

    for (const o of ordenesResult.rows) {
      const serviciosResult = await pool.query(`
        SELECT
          s.nombre,
          os.cantidad,
          os.precio_unitario
        FROM orden_servicios os
        JOIN servicios s ON s.id = os.servicio_id
        WHERE os.orden_id = $1
      `, [o.id]);

      let total = 0;
      let acolchados = [];

      for (const s of serviciosResult.rows) {
        if (s.nombre.toLowerCase().includes('acolchado')) {
          for (let i = 0; i < s.cantidad; i++) {
            acolchados.push(Number(s.precio_unitario));
          }
        } else {
          total += Number(s.cantidad) * Number(s.precio_unitario);
        }
      }

      // Promo 3x2 acolchados
      acolchados.sort((a, b) => b - a);
      acolchados.forEach((precio, index) => {
        if ((index + 1) % 3 !== 0) {
          total += precio;
        }
      });

      // Descontar seña
      total -= Number(o.senia) || 0;
      if (total < 0) total = 0;

      ordenes.push({
        id: o.id,
        fecha_ingreso: o.fecha_ingreso,
        estado: o.estado,
        cliente: o.cliente,
        total,
        tiene_envio: o.tiene_envio   // ✅ ESTA LINEA
      });
    }

    res.json(ordenes);

  } catch (error) {
    console.error('❌ ERROR GET ORDENES ABIERTAS:', error.message);
    res.status(500).json({ error: 'Error al obtener órdenes abiertas' });
  }
};



// PUT /ordenes/:id/cerrar
//const { enviarWhatsApp } = require('../services/whatsappService');

const cerrarOrden = async (req, res) => {
  console.log(">>> USANDO CERRAR ORDEN NUEVO");
  const { id } = req.params;

  try {

    // 🔒 Verificar caja abierta
    const cajaResult = await pool.query(`
      SELECT id
      FROM turnos_caja
      WHERE estado = 'abierta'
      ORDER BY id DESC
      LIMIT 1
    `);

    if (cajaResult.rows.length === 0) {
      return res.status(400).json({
        error: "Debe abrir caja antes de cerrar órdenes"
      });
    }

    // 1️⃣ Traer servicios de la orden
    const serviciosResult = await pool.query(`
      SELECT
        s.nombre,
        os.cantidad,
        os.precio_unitario
      FROM orden_servicios os
      JOIN servicios s ON s.id = os.servicio_id
      WHERE os.orden_id = $1
    `, [id]);

    let total = 0;
    let acolchados = [];

    for (const s of serviciosResult.rows) {

      if (s.nombre.toLowerCase().includes('acolchado')) {
        for (let i = 0; i < s.cantidad; i++) {
          acolchados.push(Number(s.precio_unitario));
        }
      } else {
        total += Number(s.cantidad) * Number(s.precio_unitario);
      }
    }

    // 2️⃣ Promo 3x2 en acolchados
    acolchados.sort((a, b) => b - a);

    acolchados.forEach((precio, index) => {
      if ((index + 1) % 3 !== 0) {
        total += precio;
      }
    });

    // 3️⃣ Guardar total REAL
    const ordenResult = await pool.query(`
      UPDATE ordenes
      SET total = $1,
          estado = 'lista'
      WHERE id = $2
      RETURNING total, senia, cliente_id, tiene_envio
    `, [total, id]);

    if (ordenResult.rows.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    // ===============================
    // 🚚 VINCULAR ENVÍO PREPAGO
    // ===============================
    if (ordenResult.rows[0].tiene_envio === true) {

      await pool.query(`
  UPDATE envios
  SET orden_id = $1
  WHERE id = (
    SELECT id
    FROM envios
    WHERE cliente_id = $2
      AND estado = 'pendiente'
      AND orden_id IS NULL
    ORDER BY id DESC
    LIMIT 1
  )
`, [id, ordenResult.rows[0].cliente_id]);

      console.log("🚚 Envío vinculado a la orden");
    }

    // ===============================

    res.json({
      ok: true,
      orden_id: id,
      total,
      senia: ordenResult.rows[0].senia,
      estado: 'lista'
    });

  } catch (error) {
    console.error('❌ ERROR CERRAR ORDEN:', error.message);
    res.status(500).json({ error: 'Error al cerrar la orden' });
  }
};

// GET /ordenes/listas
const getOrdenesListasParaRetiro = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        o.id,
        c.nombre AS cliente,
        to_char(
  o.fecha_ingreso AT TIME ZONE 'America/Argentina/Buenos_Aires',
  'DD/MM/YYYY HH24:MI:SS'
)AS fecha_ingreso,
        o.total,
        o.senia,
        (o.total - COALESCE(o.senia,0)) AS total_a_pagar
      FROM ordenes o
      JOIN clientes c ON c.id = o.cliente_id
      WHERE o.estado = 'lista'
        AND (o.tiene_envio = false OR o.tiene_envio IS NULL)
      ORDER BY o.fecha_ingreso ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("❌ ERROR ORDENES LISTAS:", error.message);
    res.status(500).json({ error: "Error al obtener órdenes listas" });
  }
};
// GET /ordenes/:id/detalle
const getDetalleOrden = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(`
      SELECT
        o.id AS orden_id,
        o.estado,
        to_char(
  o.fecha_ingreso AT TIME ZONE 'America/Argentina/Buenos_Aires',
  'DD/MM/YYYY HH24:MI:SS'
)AS fecha_ingreso,
        to_char(
  o.fecha_retiro AT TIME ZONE 'America/Argentina/Buenos_Aires',
  'DD/MM/YYYY HH24:MI:SS'
)AS fecha_retiro,
        o.senia,
        o.total,
        c.nombre AS cliente,
        u.nombre AS usuario,
        s.nombre AS servicio,
        os.cantidad,
        os.precio_unitario,
        (os.cantidad * os.precio_unitario) AS subtotal
      FROM ordenes o
JOIN clientes c ON c.id = o.cliente_id
LEFT JOIN usuarios u ON u.id = o.usuario_id
LEFT JOIN orden_servicios os ON os.orden_id = o.id
LEFT JOIN servicios s ON s.id = os.servicio_id
WHERE o.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    // Armamos estructura limpia para el frontend
    const base = result.rows[0];

    const detalle = {
      orden_id: base.orden_id,
      cliente: base.cliente,
      usuario: base.usuario,
      estado: base.estado,
      fecha_ingreso: base.fecha_ingreso,
      fecha_retiro: base.fecha_retiro,
      senia: base.senia,
      total: base.total,
      servicios: result.rows
        .filter(r => r.servicio)
        .map(r => ({
          nombre: r.servicio,
          cantidad: r.cantidad,
          precio_unitario: r.precio_unitario,
          subtotal: r.subtotal
        }))
    };

    res.json(detalle);

  } catch (error) {
    console.error('❌ ERROR DETALLE ORDEN:', error.message);
    res.status(500).json({ error: 'Error al obtener detalle de la orden' });
  
  }
};

// GET /ordenes/retiros-hoy
// GET /ordenes/retiros-hoy
const getRetirosHoy = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        o.id,
        o.fecha_retiro,
        c.nombre AS cliente,
        o.total
      FROM ordenes o
      JOIN clientes c ON c.id = o.cliente_id
      WHERE o.estado = 'retirada'
        AND DATE(o.fecha_retiro) = CURRENT_DATE
      ORDER BY o.fecha_retiro DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('❌ ERROR RETIROS HOY:', error.message);
    res.status(500).json({ error: 'Error al obtener retiros del día' });
  }
};

// PUT /ordenes/:id/retirar
const retirarOrden = async (req, res) => {
  const { id } = req.params;
  const { metodo_pago='Efectivo', usuario_id } = req.body;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const ord = await client.query(`
     SELECT o.total,
       o.senia,
       c.nombre AS cliente
FROM ordenes o
JOIN clientes c ON c.id = o.cliente_id
WHERE o.id=$1
    `, [id]);


    if (ord.rows.length === 0) {
      throw new Error("Orden no encontrada");
    }

    const orden = ord.rows[0];

    const total = Number(ord.rows[0].total);
    const senia = Number(ord.rows[0].senia) || 0;
    const restante = total - senia;

    const caja = await client.query(`
      SELECT id
      FROM turnos_caja
      WHERE estado = 'abierta'
      ORDER BY id DESC
      LIMIT 1
    `);

    if (caja.rows.length === 0) {
      return res.status(400).json({
  error: "Debe abrir caja antes de retirar órdenes"
});
    }

    // 🔽🔽🔽 AGREGADO
    let formaPagoDB = 'Efectivo';

    if (metodo_pago !== 'Efectivo') {
      formaPagoDB = 'Transferencia/MercadoPago';
    }
    // 🔼🔼🔼

    await client.query(`
      UPDATE ordenes
      SET estado='retirada',
          fecha_retiro = (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires'),
          usuario_retiro_id = $2
      WHERE id=$1
    `,[id, usuario_id]);

    if (restante > 0) {
      await client.query(`
        INSERT INTO caja_movimientos
        (caja_id,tipo,descripcion,monto,forma_pago,creado_en)
        VALUES ($1,'ingreso',$2,$3,$4,(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires'))
      `,[
        caja.rows[0].id,
        'Retiro orden #' + id,
        restante,
        formaPagoDB   // 👈 cambiado
      ]);
    }

    await client.query("COMMIT");

 const itemsRes = await pool.query(`
  SELECT s.nombre AS descripcion,
         os.cantidad,
         os.precio_unitario AS precio
  FROM orden_servicios os
  JOIN servicios s ON s.id = os.servicio_id
  WHERE os.orden_id = $1
`, [id]);

const items = itemsRes.rows;

let totalItems = 0;
let acolchados = [];

for (const i of items) {

  if (i.descripcion.toLowerCase().includes("acolchado")) {
    for (let x = 0; x < i.cantidad; x++) {
      acolchados.push(Number(i.precio));
    }
  } else {
    totalItems += Number(i.precio) * Number(i.cantidad);
  }
}

// Promo 3x2
acolchados.sort((a,b)=>b-a);
acolchados.forEach((p,idx)=>{
  if ((idx+1)%3 !== 0) totalItems += p;
});

// Descontar seña
totalItems -= Number(senia || 0);
if (totalItems < 0) totalItems = 0;

const archivoPDF = generarTicketRetiro({
  id,
  cliente: ord.rows[0].cliente,
  items,
  subtotal: totalItems + senia,
  senia,
  total: totalItems
});

// ❌ NO abrir PDF en servidor
// exec(start "" "${archivoPDF}");

res.json({
  ok: true,
  total: totalItems,
  senia,
  restante,
  pdf: `/pdf/retiros/retiro_${id}.pdf`
});

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// ===============================
// RESUMEN DE CAJA POR TURNO
// ===============================
const getResumenTurno = async (req, res) => {
  const { caja_id } = req.params;

  try {
    // 1. Obtener datos del turno
    const turnoResult = await pool.query(`
      SELECT id, fecha, turno, inicio_caja
      FROM turnos_caja
      WHERE id = $1
    `, [caja_id]);

    if (turnoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }

    const turno = turnoResult.rows[0];

    // 2. Movimientos del turno
    const movimientosResult = await pool.query(`
      SELECT tipo, monto, forma_pago
      FROM caja_movimientos
      WHERE caja_id = $1
    `, [caja_id]);

    let ingresos_efectivo = 0;
    let transferencias = 0;
    let gastos = 0;
    let guardado = 0;

    for (const m of movimientosResult.rows) {
      if (m.tipo === 'ingreso') {
        if (m.forma_pago === 'Efectivo') {
          ingresos_efectivo += Number(m.monto);
        } else {
          transferencias += Number(m.monto);
        }
      }

      if (m.tipo === 'gasto') {
        gastos += Number(m.monto);
      }

      if (m.tipo === 'guardado') {
        guardado += Number(m.monto);
      }
    }

    const efectivo_final =
      Number(turno.inicio_caja) +
      ingresos_efectivo -
      gastos -
      guardado;

    const total_ventas = ingresos_efectivo + transferencias;

    res.json({
      caja_id: turno.id,
      fecha: turno.fecha,
      turno: turno.turno,
      inicio_caja: Number(turno.inicio_caja),
      ingresos_efectivo,
      transferencias,
      gastos,
      guardado,
      efectivo_final,
      total_ventas
    });

  } catch (error) {
    console.error('❌ ERROR RESUMEN TURNO:', error.message);
    res.status(500).json({ error: 'Error al obtener resumen del turno' });
  }
};

// PUT /ordenes/:id/senia
const actualizarSenia = async (req, res) => {
  const { id } = req.params;
  const { senia } = req.body;

  const client = await pool.connect();

  try {

    await client.query("BEGIN");

    // 1) Actualizar seña en orden
    await client.query(`
      UPDATE ordenes
      SET senia = $1
      WHERE id = $2
    `, [senia, id]);

    // 2) Ver si ya existe movimiento de seña
    const existe = await client.query(`
      SELECT id
      FROM caja_movimientos
      WHERE descripcion = $1
    `, [`Seña orden #${id}`]);

    // 3) Buscar caja abierta
    const cajaResult = await client.query(
    `SELECT id
     FROM turnos_caja
     WHERE estado = 'abierta'
     ORDER BY id DESC
     LIMIT 1
    `);

    if (cajaResult.rows.length === 0) {
      throw new Error("Debe abrir caja antes de registrar seña");
    }

    const caja_id = cajaResult.rows[0].id;

    // 4) Si existe → actualizar monto
    if (existe.rows.length > 0) {

      await client.query(`
        UPDATE caja_movimientos
        SET monto = $1
        WHERE descripcion = $2`
      , [Number(senia), `Seña orden #${id}`]);

    } 
    // 5) Si no existe y senia > 0 → insertar
    else if (Number(senia) > 0) {

      await client.query(`
        INSERT INTO caja_movimientos
        (caja_id, tipo, descripcion, monto, forma_pago)
        VALUES ($1,'ingreso',$2,$3,'Efectivo')
      `, [
        caja_id,
        `Seña orden #${id}`,
        Number(senia)
      ]);
    }

    await client.query("COMMIT");

    res.json({ ok: true, senia });

  } catch (error) {

    await client.query("ROLLBACK");
    console.error('❌ ERROR ACTUALIZAR SEÑA:', error.message);
    res.status(500).json({ error: 'Error al actualizar seña' });

  } finally {
    client.release();
  }
};

//===============================
// ORDENES RETIRADAS
//================================

const getOrdenesRetiradas = async (req, res) => {
  try {
    const { q } = req.query;

    let sql = `
      SELECT
        o.id,
        c.nombre AS cliente,
        c.telefono,
        o.total,
        o.fecha_retiro,
        u.nombre AS usuario
        FROM ordenes o
JOIN clientes c ON o.cliente_id = c.id
LEFT JOIN usuarios u ON u.id = o.usuario_retiro_id
WHERE o.estado = 'retirada'
    `;

    const params = [];

    if (q) {
      sql += `
        AND (
          c.nombre ILIKE $1
          OR c.telefono ILIKE $1
          OR CAST(o.id AS TEXT) ILIKE $1
        )
      `;
      params.push(`%${q}%`);
    }

    sql += `
      ORDER BY o.fecha_retiro DESC
    `;

    const result = await pool.query(sql, params);
    res.json(result.rows);

  } catch (error) {
    console.error("ERROR RETIROS:", error.message);
    res.status(500).json({ error: "Error obteniendo retiros" });
  }
};
//=========================
//SERVICIOS DE ORDEN RETIRADA
//===========================
const getServiciosOrden = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(`
      SELECT s.nombre, os.cantidad, os.precio_unitario AS precio
      FROM orden_servicios os
      JOIN servicios s ON os.servicio_id = s.id
      WHERE os.orden_id = $1
    `, [id]);

    res.json(result.rows);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error obteniendo servicios" });
  }
};

//====================


const confirmarOrden = async (req, res) => {
  const { id } = req.params;

  try {

    console.log("👉 ENTRO A CONFIRMAR ORDEN", id);

    // Traer orden con cliente
  const ordenRes = await pool.query(`
  SELECT 
    o.*, 
    c.nombre AS cliente,
    c.telefono
  FROM ordenes o
  JOIN clientes c ON c.id = o.cliente_id
  WHERE o.id = $1
`, [id]);

    if (ordenRes.rows.length === 0) {
      return res.status(404).json({ error: "Orden no encontrada" });
    }

    const orden = ordenRes.rows[0];

    // Traer items
    const itemsRes = await pool.query(`
      SELECT s.nombre AS descripcion,
             os.cantidad,
             os.precio_unitario AS precio
      FROM orden_servicios os
      JOIN servicios s ON s.id = os.servicio_id
      WHERE os.orden_id = $1
    `, [id]);

    const items = itemsRes.rows;

   
    // Calcular subtotal servicios
let subtotalReal = 0;
let acolchados = [];

// Separar acolchados
for (const s of items) {

  if (s.descripcion.toLowerCase().includes("acolchado")) {
    for (let i = 0; i < s.cantidad; i++) {
      acolchados.push(Number(s.precio));
    }
    subtotalReal += Number(s.precio) * Number(s.cantidad);
  } else {
    const linea = Number(s.precio) * Number(s.cantidad);
    subtotalReal += linea;
  }
}

// ===== PROMO 3x2 =====
acolchados.sort((a, b) => b - a);

let promoDescuento = 0;

acolchados.forEach((precio, index) => {
  if ((index + 1) % 3 === 0) {
    promoDescuento += precio;   // gratis
  }
});

let total = subtotalReal - promoDescuento;

// ===== SEÑA =====
const senia = Number(orden.senia || 0);
total -= senia;

if (total < 0) total = 0;

    // Actualizar orden
    await pool.query(`
      UPDATE ordenes
      SET estado='confirmada', total=$1
      WHERE id=$2
    `, [total, id]);

    // Generar ticket PDF
await generarTicketOrden({
  id: orden.id,
  cliente_id: orden.cliente_id,
  cliente: orden.cliente,
  telefono: orden.telefono,
  items,
  subtotal: subtotalReal,
  promoDescuento,
  senia,
  total,
  tiene_envio: orden.tiene_envio
});

await imprimirTicket({
  id: orden.id,
  cliente_id: orden.cliente_id,
  cliente: orden.cliente,
  telefono: orden.telefono,
  items,
  subtotal: subtotalReal,
  promoDescuento,
  senia,
  total,
  tiene_envio: orden.tiene_envio
});


    console.log("✅ TICKET GENERADO");

    res.json({ ok: true });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al confirmar orden" });
  }
};





module.exports = {
  imprimirTicket,
  getOrdenesRetiradas,
  getServiciosOrden,
  getOrdenes,
  retirarOrden,
  getResumenTurno,
  getRetirosHoy,
  getDetalleOrden,
  getOrdenesListasParaRetiro,
  crearOrden,
  agregarServicioAOrden,
  getServiciosDeOrden,
  actualizarSenia,
  cerrarOrden,
  getOrdenesAbiertas,
  confirmarOrden
};
