#!/usr/bin/env node
/**
 * Agrega a cen_items_siesa la extensión 1 del ítem (f120_id_extension1, ej. "FB"). Los ítems con
 * extensión se piden en Siesa con su detalle de extensión (f431_id_ext1_detalle); sin él Siesa
 * rechaza la línea con "El item - extension no existe".
 * Uso: node --env-file=.env.local scripts/migrate-add-cen-items-extension.js
 */
const { neon } = require('@neondatabase/serverless')
async function main() {
  if (!process.env.DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  const sql = neon(process.env.DATABASE_URL)
  await sql`ALTER TABLE cen_items_siesa ADD COLUMN IF NOT EXISTS extension1 VARCHAR(10)`
  // Fuerza a que la próxima sincronización vuelva a traer los ítems con su extensión.
  await sql`UPDATE cen_items_siesa SET actualizado_at = '2000-01-01'`
  console.log('✅ cen_items_siesa.extension1 lista')
}
main().catch(e => { console.error(e); process.exit(1) })
