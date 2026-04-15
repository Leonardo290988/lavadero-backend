const pool = require("../db");

// ======================================
// OBTENER PUNTOS DE UN CLIENTE
// ======================================
const getPuntosCliente = async (req, res) => {
  const { clienteId } = req.params;

  try {
    const r = await pool.query(`
      SELECT 
        p.puntos_acumulados,
        p.puntos_canjeados,
        p.total_gastado,
        c.nombre
      FROM puntos_clientes p
      JOIN clientes c ON c.id = p.cliente_id
      WHERE p.cliente_id = $1
    `, [clienteId]);

    if (r.rows.length === 0) {
      return res.json({
        puntos_acumulados: 0,
        puntos_canjeados: 0,
        total_gastado: 0,
        descuento_disponible: null
      });
    }

    const p = r.rows[0];
    const puntos = Number(p.puntos_acumulados);

    // Calcular qué descuento tiene disponible
    let descuento_disponible = null;
    if (puntos >= 200) {
      descuento_disponible = { puntos: 200, porcentaje: 20 };
    } else if (puntos >= 150) {
      descuento_disponible = { puntos: 150, porcentaje: 15 };
    } else if (puntos >= 100) {
      descuento_disponible = { puntos: 100, porcentaje: 10 };
    }

    // Calcular cuánto falta para el próximo nivel
    let proximo_nivel = null;
    if (puntos < 100) {
      proximo_nivel = { puntos_necesarios: 100, porcentaje: 10, faltan: 100 - puntos };
    } else if (puntos < 150) {
      proximo_nivel = { puntos_necesarios: 150, porcentaje: 15, faltan: 150 - puntos };
    } else if (puntos < 200) {
      proximo_nivel = { puntos_necesarios: 200, porcentaje: 20, faltan: 200 - puntos };
    }

    res.json({
      puntos_acumulados: puntos,
      puntos_canjeados: Number(p.puntos_canjeados),
      total_gastado: Number(p.total_gastado),
      descuento_disponible,
      proximo_nivel
    });

  } catch (error) {
    console.error("ERROR getPuntosCliente:", error);
    res.status(500).json({ error: "Error obteniendo puntos" });
  }
};

// ======================================
// SUMAR PUNTOS AL RETIRAR UNA ORDEN
// Se llama desde retirarOrden
// ======================================
const sumarPuntos = async (clienteId, montoGastado, db) => {
  try {
    const puntosNuevos = Math.floor(Number(montoGastado) / 1000);
    if (puntosNuevos <= 0) return;

    await db.query(`
      INSERT INTO puntos_clientes (cliente_id, puntos_acumulados, total_gastado, ultima_actualizacion)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (cliente_id) DO UPDATE
        SET puntos_acumulados = puntos_clientes.puntos_acumulados + $2,
            total_gastado = puntos_clientes.total_gastado + $3,
            ultima_actualizacion = NOW()
    `, [clienteId, puntosNuevos, montoGastado]);

    console.log(`✅ Sumados ${puntosNuevos} puntos al cliente ${clienteId}`);
  } catch (error) {
    console.error("ERROR sumarPuntos:", error);
  }
};

// ======================================
// CANJEAR DESCUENTO
// Se llama al crear la orden si el cliente acepta
// ======================================
const canjearDescuento = async (req, res) => {
  const { clienteId } = req.body;

  try {
    const r = await pool.query(`
      SELECT puntos_acumulados FROM puntos_clientes WHERE cliente_id = $1
    `, [clienteId]);

    if (r.rows.length === 0) {
      return res.status(400).json({ error: "El cliente no tiene puntos" });
    }

    const puntos = Number(r.rows[0].puntos_acumulados);

    let porcentaje = 0;
    let puntosUsados = 0;

    if (puntos >= 200) {
      porcentaje = 20;
      puntosUsados = 200;
    } else if (puntos >= 150) {
      porcentaje = 15;
      puntosUsados = 150;
    } else if (puntos >= 100) {
      porcentaje = 10;
      puntosUsados = 100;
    } else {
      return res.status(400).json({ error: "No tiene puntos suficientes para canjear" });
    }

    // Descontar los puntos usados
    await pool.query(`
      UPDATE puntos_clientes
      SET puntos_acumulados = puntos_acumulados - $1,
          puntos_canjeados = puntos_canjeados + $1,
          ultima_actualizacion = NOW()
      WHERE cliente_id = $2
    `, [puntosUsados, clienteId]);

    res.json({
      ok: true,
      porcentaje,
      puntos_usados: puntosUsados,
      mensaje: `Descuento del ${porcentaje}% aplicado`
    });

  } catch (error) {
    console.error("ERROR canjearDescuento:", error);
    res.status(500).json({ error: "Error canjeando descuento" });
  }
};

// ======================================
// OBTENER TODOS LOS CLIENTES CON PUNTOS
// ======================================
const getTodosLosPuntos = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT 
        c.id,
        c.nombre,
        COALESCE(p.puntos_acumulados, 0) AS puntos_acumulados,
        COALESCE(p.puntos_canjeados, 0) AS puntos_canjeados,
        COALESCE(p.total_gastado, 0) AS total_gastado
      FROM clientes c
      LEFT JOIN puntos_clientes p ON p.cliente_id = c.id
      ORDER BY puntos_acumulados DESC, c.nombre ASC
    `);
    res.json(r.rows);
  } catch (error) {
    console.error("ERROR getTodosLosPuntos:", error);
    res.status(500).json({ error: "Error obteniendo puntos" });
  }
};

module.exports = { getPuntosCliente, sumarPuntos, canjearDescuento, getTodosLosPuntos };
