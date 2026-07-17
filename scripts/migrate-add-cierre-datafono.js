#!/usr/bin/env node
/**
 * Agrega a pvn_turnos los campos obligatorios de cierre para PVV: foto del
 * cierre del datafono y número de recogida del cuadre de caja.
 * Correr UNA SOLA VEZ.
 *
 * Uso: DATABASE_URL="..." node scripts/migrate-add-cierre-datafono.js
 */

const { neon } = require('@neondatabase/serverless')

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }

  const sql = neon(DATABASE_URL)

  await sql`ALTER TABLE pvn_turnos ADD COLUMN IF NOT EXISTS foto_datafono_url TEXT`
  await sql`ALTER TABLE pvn_turnos ADD COLUMN IF NOT EXISTS numero_recogida VARCHAR(20)`

  console.log('✅ Columnas foto_datafono_url y numero_recogida agregadas a pvn_turnos')
}

main().catch(e => { console.error(e); process.exit(1) })
