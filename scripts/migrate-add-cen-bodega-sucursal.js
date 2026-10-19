#!/usr/bin/env node
/**
 * La bodega del pedido se amarra a la sucursal del cliente (no al NIT): agrega
 * cen_puntos_ean.bodega. Prioridad al armar el pedido: bodega que traiga Siesa en
 * API_v2_Clientes > bodega de la sucursal > bodega del cliente (cen_config_clientes) > 00110.
 * La bodega se asigna a mano desde la pantalla Sucursales (lista de API_v2_Bodegas, instalación 001).
 * Uso: node --env-file=.env.local scripts/migrate-add-cen-bodega-sucursal.js
 */
const { neon } = require('@neondatabase/serverless')
async function main() {
  if (!process.env.DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  const sql = neon(process.env.DATABASE_URL)
  await sql`ALTER TABLE cen_puntos_ean ADD COLUMN IF NOT EXISTS bodega VARCHAR(5)`
  console.log('✅ Columna cen_puntos_ean.bodega lista')
}
main().catch(e => { console.error(e); process.exit(1) })
