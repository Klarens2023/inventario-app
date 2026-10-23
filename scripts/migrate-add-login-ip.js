#!/usr/bin/env node
/**
 * Tabla para limitar los intentos de login fallidos por dirección IP.
 *
 * El bloqueo por usuario (migrate-add-bloqueo-login.js) frena a quien prueba
 * muchas contraseñas contra UNA cuenta, pero no a quien prueba UNA contraseña
 * común contra MUCHAS cuentas ("password spraying"): cada cuenta solo acumula
 * un fallo y nunca se bloquea. Esta tabla cuenta los fallos por IP en una
 * ventana de tiempo; la lógica está en lib/loginBruteForce.ts.
 *
 *   ip               dirección del cliente (la que reporta Vercel)
 *   intentos         fallos dentro de la ventana actual
 *   ventana_desde    inicio de la ventana; al vencer, el conteo vuelve a 1
 *   bloqueado_hasta  si tiene fecha futura, esa IP no puede intentar login
 *
 * No toca datos existentes. Se puede correr varias veces.
 * Mientras no se corra, el login sigue funcionando (el límite por IP queda
 * desactivado y se registra un aviso en los logs).
 *
 * Uso: DATABASE_URL="..." node scripts/migrate-add-login-ip.js
 */

const { neon } = require('@neondatabase/serverless')

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  const sql = neon(DATABASE_URL)

  await sql`
    CREATE TABLE IF NOT EXISTS login_intentos_ip (
      ip              TEXT PRIMARY KEY,
      intentos        INTEGER     NOT NULL DEFAULT 0,
      ventana_desde   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      bloqueado_hasta TIMESTAMPTZ
    )
  `
  console.log('✅ login_intentos_ip')
}

main().catch(e => { console.error(e); process.exit(1) })
