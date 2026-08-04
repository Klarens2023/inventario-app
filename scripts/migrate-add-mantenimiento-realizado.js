#!/usr/bin/env node
/**
 * Agrega la columna `realizado` a equipos_mantenimientos para poder registrar
 * si un mantenimiento programado sí se hizo o no (módulo de Mantenimientos TI).
 *
 * Correr UNA SOLA VEZ.
 * Uso: DATABASE_URL="..." node scripts/migrate-add-mantenimiento-realizado.js
 */

const { neon } = require('@neondatabase/serverless')

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }

  const sql = neon(DATABASE_URL)

  await sql`ALTER TABLE equipos_mantenimientos ADD COLUMN IF NOT EXISTS realizado BOOLEAN NOT NULL DEFAULT TRUE`

  console.log('✅ Columna realizado agregada a equipos_mantenimientos')
}

main().catch(e => { console.error(e); process.exit(1) })
