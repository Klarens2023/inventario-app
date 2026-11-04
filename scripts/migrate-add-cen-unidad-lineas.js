#!/usr/bin/env node
/**
 * Agrega a cen_orden_lineas la unidad en que viene la cantidad de la orden EDI:
 * 'UND' (unidades, NAR) o 'KG' (kilos, KGM). Con ella el pedido de Siesa convierte
 * las unidades a kilos en los ítems que Siesa maneja por kilo (lib/cen/documentoPedido.ts).
 * Las líneas existentes quedan en 'UND' (todas las órdenes recibidas hasta hoy vienen en NAR).
 * Sin esta columna la app sigue funcionando: trata todas las líneas como unidades.
 * Uso: node --env-file=.env.local scripts/migrate-add-cen-unidad-lineas.js
 */
const { neon } = require('@neondatabase/serverless')
async function main() {
  if (!process.env.DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  const sql = neon(process.env.DATABASE_URL)
  await sql`ALTER TABLE cen_orden_lineas ADD COLUMN IF NOT EXISTS unidad VARCHAR(4) NOT NULL DEFAULT 'UND'`
  console.log('✅ cen_orden_lineas.unidad lista')
}
main().catch(e => { console.error(e); process.exit(1) })
