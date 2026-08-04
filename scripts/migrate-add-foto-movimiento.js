#!/usr/bin/env node
/**
 * Agrega la columna para la foto del formato de movimiento ya firmado y
 * autorizado (se sube después de imprimir y firmar físicamente).
 *
 * Correr UNA SOLA VEZ.
 * Uso: DATABASE_URL="..." node scripts/migrate-add-foto-movimiento.js
 */

const { neon } = require('@neondatabase/serverless')

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }

  const sql = neon(DATABASE_URL)

  await sql`ALTER TABLE tic_movimientos ADD COLUMN IF NOT EXISTS foto_autorizacion_url TEXT`

  console.log('✅ Columna foto_autorizacion_url agregada a tic_movimientos')
}

main().catch(e => { console.error(e); process.exit(1) })
