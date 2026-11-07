#!/usr/bin/env node
/**
 * Aviso a facturación por correo de los pedidos creados en Siesa (lib/cen/avisoFacturacion.ts):
 *   - aviso_facturacion_at / _por: cuándo y quién avisó (evita avisar dos veces el mismo pedido)
 *   - siesa_retenido: motivo por el que Siesa dejó el pedido retenido (cupo, mora...), para el correo
 * Los pedidos que ya estaban en Siesa antes de esta migración quedan como avisados (con su fecha de
 * envío), para que no salgan todos como "sin avisar".
 * Sin estas columnas la app sigue creando pedidos; solo no envía el aviso.
 * Uso: node --env-file=.env.local scripts/migrate-add-cen-aviso-facturacion.js
 */
const { neon } = require('@neondatabase/serverless')
async function main() {
  if (!process.env.DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  const sql = neon(process.env.DATABASE_URL)
  console.log('Base:', process.env.DATABASE_URL.match(/@([^.]+)/)[1])
  await sql`ALTER TABLE cen_ordenes ADD COLUMN IF NOT EXISTS aviso_facturacion_at TIMESTAMPTZ`
  await sql`ALTER TABLE cen_ordenes ADD COLUMN IF NOT EXISTS aviso_facturacion_por VARCHAR(120)`
  await sql`ALTER TABLE cen_ordenes ADD COLUMN IF NOT EXISTS siesa_retenido TEXT`
  const r = await sql`
    UPDATE cen_ordenes SET aviso_facturacion_at = COALESCE(enviado_at, NOW()), aviso_facturacion_por = 'Antes del aviso por correo'
    WHERE estado = 'enviado' AND aviso_facturacion_at IS NULL RETURNING id`
  console.log(`✅ Columnas listas · ${r.length} pedido(s) existentes marcados como ya avisados`)
}
main().catch(e => { console.error(e); process.exit(1) })
