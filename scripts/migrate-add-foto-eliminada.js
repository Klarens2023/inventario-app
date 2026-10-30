#!/usr/bin/env node
/**
 * Columna para la depuración automática de fotos de pagos QR (lib/depurarFotos.ts):
 *   pvn_pagos_qr.foto_eliminada_en  cuándo se mandó la foto a la papelera de Drive
 * El registro del pago se conserva; solo se marca que su foto ya no está.
 * Correr ANTES de desplegar. No toca datos; se puede correr varias veces.
 *
 * Uso (con el DUEÑO de la base): DATABASE_URL="..." node scripts/migrate-add-foto-eliminada.js
 */

const { neon } = require('@neondatabase/serverless')

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL?.match(/postgres(?:ql)?:\/\/[^\s'"]+/)?.[0]
  if (!DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  const sql = neon(DATABASE_URL)
  await sql`ALTER TABLE pvn_pagos_qr ADD COLUMN IF NOT EXISTS foto_eliminada_en TIMESTAMPTZ`
  // Índice parcial: la depuración busca pagos viejos aún sin depurar
  await sql`CREATE INDEX IF NOT EXISTS idx_pagos_qr_por_depurar ON pvn_pagos_qr (created_at) WHERE foto_eliminada_en IS NULL`
  console.log('✅ pvn_pagos_qr.foto_eliminada_en')
}

main().catch(e => { console.error('❌', String(e.message).replace(/postgres(ql)?:\/\/\S+/g, '[cadena oculta]')); process.exit(1) })
