#!/usr/bin/env node
/**
 * Copia local de los ítems de venta de Siesa (API_v2_Items), para buscar el ítem (f120_id)
 * de cada producto de las órdenes EDI sin consultar Siesa en cada orden (la consulta completa
 * tarda ~13 s). f120_notas trae el código anterior del ítem, el mismo de "BD 2026": con él se
 * asigna solo el f120_id de cen_productos. Se refresca desde la app (cada 12 h o con un botón).
 * Uso: node --env-file=.env.local scripts/migrate-add-cen-items-siesa.js
 */
const { neon } = require('@neondatabase/serverless')
async function main() {
  if (!process.env.DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  const sql = neon(process.env.DATABASE_URL)
  await sql`
    CREATE TABLE IF NOT EXISTS cen_items_siesa (
      f120_id          INTEGER PRIMARY KEY,
      referencia       VARCHAR(30),
      descripcion      VARCHAR(200),
      codigo_anterior  VARCHAR(30),
      unidad           VARCHAR(4),
      actualizado_at   TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_cen_items_codigo_anterior ON cen_items_siesa(codigo_anterior)`
  console.log('✅ Tabla cen_items_siesa lista')
}
main().catch(e => { console.error(e); process.exit(1) })
