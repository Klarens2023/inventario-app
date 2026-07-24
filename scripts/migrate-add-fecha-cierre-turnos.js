#!/usr/bin/env node
/**
 * Agrega a pvn_turnos la columna `fecha_cierre`: el día (hora Bogotá) en que
 * el turno se cerró realmente, separado de `fecha` (el día al que pertenece
 * el turno). Necesario porque un turno abierto un día puede cerrarse tarde,
 * al día siguiente — `fecha` debe seguir siendo la del turno, no la del cierre.
 *
 * Los turnos ya cerrados antes de esta migración quedan con fecha_cierre en
 * NULL (no se puede reconstruir con certeza la fecha Bogotá del cierre a
 * partir de un TIMESTAMP sin zona horaria); el código trata NULL como
 * "mismo día del turno" vía COALESCE(fecha_cierre, fecha).
 *
 * Correr UNA SOLA VEZ.
 * Uso: DATABASE_URL="..." node scripts/migrate-add-fecha-cierre-turnos.js
 */

const { neon } = require('@neondatabase/serverless')

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }

  const sql = neon(DATABASE_URL)

  await sql`ALTER TABLE pvn_turnos ADD COLUMN IF NOT EXISTS fecha_cierre DATE`

  console.log('✅ Columna fecha_cierre agregada a pvn_turnos')
}

main().catch(e => { console.error(e); process.exit(1) })
