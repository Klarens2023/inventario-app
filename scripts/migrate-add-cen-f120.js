#!/usr/bin/env node
/**
 * Agrega a cen_productos el id del ítem en Siesa (f120_id). Siesa no expone una consulta de
 * ítems por código de barras: la relación se aprende de cada pedido creado desde la app. Se
 * siembra con los ítems del pedido PVK-16201 (QA), creado con códigos de barras.
 * Uso: node --env-file=.env.local scripts/migrate-add-cen-f120.js
 */
const { neon } = require('@neondatabase/serverless')

async function main() {
  if (!process.env.DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  const sql = neon(process.env.DATABASE_URL)
  await sql`ALTER TABLE cen_productos ADD COLUMN IF NOT EXISTS f120_id INTEGER`
  for (const [ean, id] of [['7702705022013', 9], ['7702705022082', 16], ['7702705022020', 10]]) {
    await sql`UPDATE cen_productos SET f120_id = ${id} WHERE ean = ${ean} AND f120_id IS NULL`
  }
  console.log('✅ Columna cen_productos.f120_id lista')
}
main().catch(e => { console.error(e); process.exit(1) })
