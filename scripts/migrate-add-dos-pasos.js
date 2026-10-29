#!/usr/bin/env node
/**
 * Verificación en dos pasos (2FA) para administradores (lib/dosPasos.ts):
 *
 *   usuarios.totp_clave        clave TOTP de la persona, CIFRADA con TOTP_CLAVE
 *   usuarios.totp_pendiente    clave generada mientras escanea el QR, aún sin confirmar
 *   usuarios.totp_activo       true cuando confirmó el primer código
 *   usuarios.totp_activado_en  cuándo la activó
 *   usuarios.totp_ultimo_paso  último código aceptado (evita reusar el mismo código)
 *   usuario_codigos_recuperacion  huellas de los 10 códigos de un solo uso
 *
 * Correr ANTES de desplegar el código que la usa. No toca datos existentes; se
 * puede correr varias veces. El rol de la app (app_operaciones) recibe permisos
 * sobre la tabla nueva por ALTER DEFAULT PRIVILEGES (scripts/crear-rol-app.sql).
 *
 * Uso (con el DUEÑO de la base): DATABASE_URL="..." node scripts/migrate-add-dos-pasos.js
 */

const { neon } = require('@neondatabase/serverless')

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL?.match(/postgres(?:ql)?:\/\/[^\s'"]+/)?.[0]
  if (!DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  const sql = neon(DATABASE_URL)

  await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS totp_clave TEXT`
  await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS totp_pendiente TEXT`
  await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS totp_activo BOOLEAN NOT NULL DEFAULT FALSE`
  await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS totp_activado_en TIMESTAMPTZ`
  await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS totp_ultimo_paso BIGINT`
  console.log('✅ columnas totp_* en usuarios')

  await sql`
    CREATE TABLE IF NOT EXISTS usuario_codigos_recuperacion (
      id         SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      huella     TEXT NOT NULL,
      usado_en   TIMESTAMPTZ,
      creado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_codigos_recuperacion_usuario ON usuario_codigos_recuperacion (usuario_id)`
  console.log('✅ usuario_codigos_recuperacion')
}

main().catch(e => { console.error('❌', String(e.message).replace(/postgres(ql)?:\/\/\S+/g, '[cadena oculta]')); process.exit(1) })
