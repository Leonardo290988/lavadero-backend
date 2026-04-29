const axios = require("axios");
const pool = require("../db");
const enviarPushNotification = require("../helpers/enviarPushNotification");

const webhookMercadoPago = async (req, res) => {
  try {

    const paymentId = req.body?.data?.id;
    console.log("🔔 Webhook MP:", paymentId);

    if (!paymentId) return res.sendStatus(200);

    // ===========================
    // EVITAR DUPLICADOS
    // ===========================
    const existe = await pool.query(
      "SELECT id FROM pagos_mp WHERE payment_id = $1",
      [paymentId]
    );

    if (existe.rows.length > 0) {
      console.log("⚠ Pago duplicado ignorado");
      return res.sendStatus(200);
    }

    // ===========================
    // CONSULTAR MP
    // ===========================
    const response = await axios.get(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        },
      }
    );

    const pago = response.data;

    if (pago.status !== "approved") {
      console.log("⏳ Pago no aprobado");
      return res.sendStatus(200);
    }

    const { tipo, retiro_id, envio_id } = pago.metadata || {};
    const monto = pago.transaction_details?.total_paid_amount || 0;

    console.log("✅ Pago aprobado:", tipo, retiro_id, envio_id);

    // ===========================
    // PROCESAR RETIRO
    // ===========================
    if (tipo === "retiro" && retiro_id) {

      await pool.query(`
        UPDATE retiros
        SET estado = 'pendiente'
        WHERE id = $1
      `, [retiro_id]);

      console.log("🧺 Retiro habilitado:", retiro_id);

      // 🔔 Notificar al local ahora que el pago fue confirmado
      try {
        const retiroInfo = await pool.query(`
          SELECT r.zona, r.precio, c.nombre, c.id AS cliente_id
          FROM retiros r
          JOIN clientes c ON c.id = r.cliente_id
          WHERE r.id = $1
        `, [retiro_id]);

        if (retiroInfo.rows.length > 0) {
          const { nombre, zona, precio } = retiroInfo.rows[0];
          const tokenRes = await pool.query(
            "SELECT token FROM push_tokens WHERE clave = 'local_owner'"
          );
          if (tokenRes.rows.length > 0) {
            const tipoTexto = tipo === "retiro" ? "Retiro" : "Retiro + Envío";
            await enviarPushNotification(
              tokenRes.rows[0].token,
              `🧺 Nueva solicitud — ${tipoTexto}`,
              `${nombre} · Zona ${zona} · $${precio}`,
              { tipo: "nueva_solicitud", retiro_id }
            );
          }
        }
      } catch (pushErr) {
        console.error("⚠️ Error enviando push:", pushErr.message);
      }
    }

    // ===========================
    // PROCESAR ENVÍO
    // ===========================
    if (tipo === "envio" && envio_id) {

      // 1️⃣ Pasar envío a pendiente
      await pool.query(`
        UPDATE envios
        SET estado = 'pendiente'
        WHERE id = $1
      `, [envio_id]);

      console.log("🚚 Envío habilitado:", envio_id);

      // 2️⃣ Obtener el envío para ver si tiene orden_id
      const envioRes = await pool.query(`
        SELECT orden_id, cliente_id FROM envios WHERE id = $1
      `, [envio_id]);

      let orden_id_final = envioRes.rows[0]?.orden_id;

      // 3️⃣ Si no tiene orden_id, buscar la orden lista del cliente
      if (!orden_id_final) {
        const ordenRes = await pool.query(`
          SELECT id FROM ordenes
          WHERE cliente_id = $1
            AND estado = 'lista'
            AND (tiene_envio = false OR tiene_envio IS NULL)
          ORDER BY id DESC
          LIMIT 1
        `, [envioRes.rows[0]?.cliente_id]);

        if (ordenRes.rows.length > 0) {
          orden_id_final = ordenRes.rows[0].id;

          // Vincular el envío con la orden
          await pool.query(`
            UPDATE envios SET orden_id = $1 WHERE id = $2
          `, [orden_id_final, envio_id]);

          console.log("🔗 Envío vinculado a orden:", orden_id_final);
        }
      }

      // 4️⃣ Marcar orden como tiene_envio = true
      if (orden_id_final) {
        await pool.query(`
          UPDATE ordenes SET tiene_envio = true WHERE id = $1
        `, [orden_id_final]);

        console.log("📦 Orden actualizada con envío:", orden_id_final);
      }
    }

    // ===========================
    // IMPACTAR EN CAJA
    // ===========================
    const cajaRes = await pool.query(`
      SELECT id
      FROM turnos_caja
      WHERE estado = 'abierta'
      ORDER BY id DESC
      LIMIT 1
    `);

    let descripcion = "Pago MercadoPago";
    if (tipo === "retiro") descripcion = `Pago retiro #${retiro_id}`;
    if (tipo === "envio")  descripcion = `Pago envío #${envio_id}`;

    if (cajaRes.rows.length > 0) {
      // Hay caja abierta → impactar directamente
      const caja_id = cajaRes.rows[0].id;

      await pool.query(
        `INSERT INTO caja_movimientos
         (caja_id, tipo, descripcion, monto, forma_pago, creado_en)
         VALUES ($1,'ingreso',$2,$3,'Transferencia/MercadoPago',
                 (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires'))`,
        [caja_id, descripcion, monto]
      );

      console.log("💰 Impactado en caja:", descripcion);

    } else {
      // No hay caja abierta → guardar como pendiente para la próxima apertura
      await pool.query(
        `INSERT INTO movimientos_pendientes_caja
         (tipo, descripcion, monto, forma_pago, creado_en)
         VALUES ('ingreso',$1,$2,'Transferencia/MercadoPago',
                 (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires'))`,
        [descripcion, monto]
      );

      console.log("⏳ Sin caja abierta — guardado como pendiente:", descripcion);
    }

    // ===========================
    // REGISTRAR PAGO
    // ===========================
    await pool.query(
      `
      INSERT INTO pagos_mp
      (payment_id, tipo, referencia_id, monto, estado)
      VALUES ($1,$2,$3,$4,$5)
      `,
      [
        paymentId,
        tipo,
        retiro_id || envio_id,
        monto,
        pago.status
      ]
    );

    console.log("✅ Webhook procesado completo");
    res.sendStatus(200);

  } catch (error) {
    console.error("❌ Webhook error:", error);
    res.sendStatus(500);
  }
};

module.exports = { webhookMercadoPago };