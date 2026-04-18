const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgresql://postgres:yeSmDUOoFbjOftXEDRZNQwtDJIunOMxT@postgres.railway.internal:5432/railway",
  ssl: { rejectUnauthorized: false }
});

pool.query('SELECT 1')
  .then(() => console.log('✅ PostgreSQL conectado correctamente'))
  .catch(err => console.error('❌ PostgreSQL error:', err));

// Crear tabla push_tokens si no existe
pool.query(`
  CREATE TABLE IF NOT EXISTS push_tokens (
    clave VARCHAR(50) PRIMARY KEY,
    token TEXT NOT NULL,
    actualizado_en TIMESTAMP DEFAULT NOW()
  )
`).catch(err => console.error('❌ Error creando push_tokens:', err));

// Crear tabla clientes_contactados si no existe
pool.query(`
  CREATE TABLE IF NOT EXISTS clientes_contactados (
    cliente_id INTEGER PRIMARY KEY,
    ultimo_contacto TIMESTAMP DEFAULT NOW()
  )
`).catch(err => console.error('❌ Error creando clientes_contactados:', err));

// Crear tabla recordatorios_retiro si no existe
pool.query(`
  CREATE TABLE IF NOT EXISTS recordatorios_retiro (
    orden_id INTEGER PRIMARY KEY,
    ultimo_recordatorio TIMESTAMP DEFAULT NOW()
  )
`).catch(err => console.error('❌ Error creando recordatorios_retiro:', err));

// Crear tabla contabilidad si no existe
pool.query(`
  CREATE TABLE IF NOT EXISTS contabilidad (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(20) NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    descripcion TEXT,
    monto NUMERIC NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    creado_en TIMESTAMP DEFAULT NOW()
  )
`).catch(err => console.error('❌ Error creando contabilidad:', err));

// Crear tabla club_valets si no existe
pool.query(`
  CREATE TABLE IF NOT EXISTS club_valets (
    id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL,
    cantidad INTEGER NOT NULL,
    precio_unitario NUMERIC NOT NULL DEFAULT 8000,
    observacion TEXT,
    facturado BOOLEAN DEFAULT false,
    numero_factura VARCHAR(50),
    fecha_factura DATE,
    creado_en TIMESTAMP DEFAULT NOW()
  )
`).catch(err => console.error('❌ Error creando club_valets:', err));

module.exports = pool;