#!/usr/bin/env node
/**
 * Agrega protección contra fuerza bruta en el login: cuenta los intentos
 * fallidos consecutivos por usuario y bloquea temporalmente la cuenta tras
 * demasiados intentos seguidos (ver lib/loginBruteForce.ts).
 *
 * Correr UNA SOLA VEZ.
 * Uso: DATABASE_URL="..." node scripts/migrate-add-bloqueo-login.js
 */

const { neon } = require('@neondatabase/serverless')

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }

  const sql = neon(DATABASE_URL)

  await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS intentos_fallidos INTEGER NOT NULL DEFAULT 0`
  await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMP`

  console.log('✅ Columnas intentos_fallidos y bloqueado_hasta agregadas a usuarios')
}

main().catch(e => { console.error(e); process.exit(1) })
