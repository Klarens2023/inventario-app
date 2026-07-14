#!/usr/bin/env node
/**
 * Agrega turno_id a pvn_pagos_qr para poder filtrar "mis pagos" por turno
 * específico (una compañera puede abrir más de un turno el mismo día).
 * Correr UNA SOLA VEZ.
 *
 * Uso: DATABASE_URL="..." node scripts/migrate-add-turno-id-pagos.js
 */

const { neon } = require('@neondatabase/serverless')

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }

  const sql = neon(DATABASE_URL)

  await sql`ALTER TABLE pvn_pagos_qr ADD COLUMN IF NOT EXISTS turno_id INTEGER REFERENCES pvn_turnos(id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_pagos_qr_turno ON pvn_pagos_qr(turno_id)`

  console.log('✅ Columna turno_id agregada a pvn_pagos_qr')
}

main().catch(e => { console.error(e); process.exit(1) })
