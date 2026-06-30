#!/usr/bin/env node
/**
 * Crea la tabla pvn_turnos para control de apertura/cierre de turno.
 * Correr UNA SOLA VEZ.
 *
 * Uso: DATABASE_URL="..." node scripts/migrate-add-turnos.js
 */

const { neon } = require('@neondatabase/serverless')

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }

  const sql = neon(DATABASE_URL)

  await sql`
    CREATE TABLE IF NOT EXISTS pvn_turnos (
      id                  SERIAL PRIMARY KEY,
      usuario_id          INTEGER NOT NULL REFERENCES usuarios(id),
      usuario_nombre      VARCHAR(100) NOT NULL,
      punto_venta_id      INTEGER NOT NULL REFERENCES pvn_puntos_venta(id),
      punto_venta_nombre  VARCHAR(100) NOT NULL,
      fecha               DATE NOT NULL,
      abierto_at          TIMESTAMP DEFAULT NOW(),
      cerrado_at          TIMESTAMP,
      activo              BOOLEAN DEFAULT TRUE
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_turnos_usuario ON pvn_turnos(usuario_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_turnos_fecha   ON pvn_turnos(fecha)`

  console.log('✅ Tabla pvn_turnos creada correctamente')
}

main().catch(e => { console.error(e); process.exit(1) })
