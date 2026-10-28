#!/usr/bin/env node
/**
 * Tabla con el registro de cada sincronización de órdenes EDI
 * (lib/cen/registroSincronizacion.ts): cuándo corrió, quién la lanzó
 * (Vercel Cron, GitHub Actions o el botón "Traer órdenes") y si funcionó.
 * Se conservan 30 días. No toca datos existentes; se puede correr varias veces.
 * Mientras no se corra, la sincronización funciona igual (solo no se registra).
 *
 * Uso (con el DUEÑO de la base): DATABASE_URL="..." node scripts/migrate-add-cen-sincronizaciones.js
 * El rol de la app (app_operaciones) recibe los permisos por ALTER DEFAULT PRIVILEGES.
 */

const { neon } = require('@neondatabase/serverless')

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL?.match(/postgres(?:ql)?:\/\/[^\s'"]+/)?.[0]
  if (!DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  const sql = neon(DATABASE_URL)

  await sql`
    CREATE TABLE IF NOT EXISTS cen_sincronizaciones (
      id       SERIAL PRIMARY KEY,
      inicio   TIMESTAMPTZ NOT NULL,
      fin      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      origen   TEXT        NOT NULL CHECK (origen IN ('vercel-cron', 'github', 'manual')),
      ok       BOOLEAN     NOT NULL,
      resumen  JSONB,
      error    TEXT,
      usuario  TEXT
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_cen_sincronizaciones_inicio ON cen_sincronizaciones (inicio DESC)`
  console.log('✅ cen_sincronizaciones')
}

main().catch(e => { console.error('❌', String(e.message).replace(/postgres(ql)?:\/\/\S+/g, '[cadena oculta]')); process.exit(1) })
