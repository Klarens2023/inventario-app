#!/usr/bin/env node
/**
 * Trazabilidad de las órdenes EDI para los reportes de control:
 *   - descartada_at, descartada_por, motivo_descarte: quién, cuándo y por qué se descartó la orden.
 *   - enviado_por: quién creó el pedido en Siesa (enviado_at ya existía).
 * Uso: node --env-file=.env.local scripts/migrate-add-cen-trazabilidad.js
 */
const { neon } = require('@neondatabase/serverless')
async function main() {
  if (!process.env.DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  const sql = neon(process.env.DATABASE_URL)
  await sql`ALTER TABLE cen_ordenes ADD COLUMN IF NOT EXISTS descartada_at TIMESTAMP`
  await sql`ALTER TABLE cen_ordenes ADD COLUMN IF NOT EXISTS descartada_por VARCHAR(120)`
  await sql`ALTER TABLE cen_ordenes ADD COLUMN IF NOT EXISTS motivo_descarte VARCHAR(300)`
  await sql`ALTER TABLE cen_ordenes ADD COLUMN IF NOT EXISTS enviado_por VARCHAR(120)`
  await sql`CREATE INDEX IF NOT EXISTS idx_cen_ordenes_fecha_entrega ON cen_ordenes(fecha_entrega)`
  console.log('✅ cen_ordenes con trazabilidad de descarte y envío')
}
main().catch(e => { console.error(e); process.exit(1) })
