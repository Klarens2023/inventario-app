#!/usr/bin/env node
/**
 * Agrega columnas para un segundo adaptador de red opcional (ej. Ethernet +
 * WiFi) en equipos_tecnologicos. El primer adaptador sigue usando las
 * columnas existentes (ip_asignada, mac_address, etc.); estas son solo para
 * el segundo, cuando el equipo tiene más de uno.
 *
 * Correr UNA SOLA VEZ.
 * Uso: DATABASE_URL="..." node scripts/migrate-add-segundo-adaptador-red.js
 */

const { neon } = require('@neondatabase/serverless')

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }

  const sql = neon(DATABASE_URL)

  await sql`ALTER TABLE equipos_tecnologicos ADD COLUMN IF NOT EXISTS ip_asignada_2 VARCHAR(50)`
  await sql`ALTER TABLE equipos_tecnologicos ADD COLUMN IF NOT EXISTS mascara_subred_2 VARCHAR(50)`
  await sql`ALTER TABLE equipos_tecnologicos ADD COLUMN IF NOT EXISTS gateway_2 VARCHAR(50)`
  await sql`ALTER TABLE equipos_tecnologicos ADD COLUMN IF NOT EXISTS dns_primario_2 VARCHAR(50)`
  await sql`ALTER TABLE equipos_tecnologicos ADD COLUMN IF NOT EXISTS mac_address_2 VARCHAR(50)`
  await sql`ALTER TABLE equipos_tecnologicos ADD COLUMN IF NOT EXISTS tipo_conexion_2 VARCHAR(50)`

  console.log('✅ Columnas del segundo adaptador de red agregadas a equipos_tecnologicos')
}

main().catch(e => { console.error(e); process.exit(1) })
