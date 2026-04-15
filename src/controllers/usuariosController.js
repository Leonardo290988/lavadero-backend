const pool = require("../db");
const bcrypt = require("bcrypt");

// ======================================
// LOGIN
// ======================================
const login = async (req, res) => {
  const { usuario, password } = req.body;

  try {
    // Traer usuario con password_hash (y password viejo por compatibilidad)
    const result = await pool.query(
      `SELECT id, usuario, nombre, rol, password, password_hash
       FROM usuarios
       WHERE usuario = $1
         AND activo = true`,
      [usuario]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const user = result.rows[0];
    let passwordOk = false;

    if (user.password_hash) {
      // Contraseña ya hasheada — comparar con bcrypt
      passwordOk = await bcrypt.compare(password, user.password_hash);
    } else {
      // Contraseña vieja en texto plano — comparar directo y migrar al vuelo
      passwordOk = (user.password === password);

      if (passwordOk) {
        // Migrar automáticamente a hash
        const hash = await bcrypt.hash(password, 10);
        await pool.query(
          `UPDATE usuarios SET password_hash = $1, password = NULL WHERE id = $2`,
          [hash, user.id]
        );
        console.log(`✅ Contraseña migrada a hash para usuario: ${user.usuario}`);
      }
    }

    if (!passwordOk) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    res.json({
      id: user.id,
      usuario: user.usuario,
      nombre: user.nombre,
      rol: user.rol
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({ error: "Error servidor" });
  }
};

// ======================================
// CAMBIAR CONTRASEÑA
// ======================================
const cambiarPassword = async (req, res) => {
  const { usuario_id, password_actual, password_nueva } = req.body;

  if (!usuario_id || !password_actual || !password_nueva) {
    return res.status(400).json({ error: "Faltan datos" });
  }

  if (password_nueva.length < 4) {
    return res.status(400).json({ error: "La contraseña nueva debe tener al menos 4 caracteres" });
  }

  try {
    const result = await pool.query(
      `SELECT password, password_hash FROM usuarios WHERE id = $1 AND activo = true`,
      [usuario_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const user = result.rows[0];
    let passwordOk = false;

    if (user.password_hash) {
      passwordOk = await bcrypt.compare(password_actual, user.password_hash);
    } else {
      passwordOk = (user.password === password_actual);
    }

    if (!passwordOk) {
      return res.status(401).json({ error: "Contraseña actual incorrecta" });
    }

    const nuevoHash = await bcrypt.hash(password_nueva, 10);

    await pool.query(
      `UPDATE usuarios SET password_hash = $1, password = NULL WHERE id = $2`,
      [nuevoHash, usuario_id]
    );

    res.json({ ok: true, mensaje: "Contraseña actualizada correctamente" });

  } catch (error) {
    console.error("CAMBIAR PASSWORD ERROR:", error);
    res.status(500).json({ error: "Error servidor" });
  }
};

module.exports = {
  login,
  cambiarPassword
};
