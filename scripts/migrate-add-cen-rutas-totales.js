#!/usr/bin/env node
/**
 * Rutas de despacho de las órdenes EDI:
 *   - Tabla cen_rutas: cómo se ve la tabla de totales de cada ruta ("item" o "cliente"), igual que en
 *     las hojas de relación de "BD 2026.xlsx" (unas totalizan por ítem; otras por punto de venta con
 *     sus ítems). Una ruta que no esté aquí totaliza por ítem.
 *   - Reglas de las rutas ARA (Jerónimo Martins) y D1: todas las órdenes de esas cadenas.
 * Uso: node --env-file=.env.local scripts/migrate-add-cen-rutas-totales.js
 */
const { neon } = require('@neondatabase/serverless')

// Hojas con columna "Nombre Punto de Venta" / "Descripción del ítem" junto a DESCRIPCION → por cliente
const POR_CLIENTE = ['EXVAL', 'EXCAR', 'EXBOG', 'EXEN', 'LAMARTINA', 'GUAJIRA', 'SABANA', 'WOL524']
const POR_ITEM = ['PYM', 'DISTRYCAR', 'CENPLA', 'KLARENSBOG', 'EXCAL', 'EXPER', 'EXBU', 'SUPERVAL', 'PROVY', 'OLPOBLA', 'OLMP-BOG', 'RIGO', 'ARA', 'D1']

const REGLAS = [
  { prioridad: 50, ruta: 'ARA', ean: '7704269000018', descripcion: 'Ara (Jerónimo Martins): todas sus órdenes' },
  { prioridad: 51, ruta: 'D1', ean: '7700304892105', descripcion: 'D1: todas sus órdenes' },
]

async function main() {
  if (!process.env.DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  const sql = neon(process.env.DATABASE_URL)
  await sql`
    CREATE TABLE IF NOT EXISTS cen_rutas (
      ruta        VARCHAR(30) PRIMARY KEY,
      totales     VARCHAR(10) NOT NULL DEFAULT 'item' CHECK (totales IN ('item', 'cliente')),
      updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `
  const filas = [...POR_CLIENTE.map(r => [r, 'cliente']), ...POR_ITEM.map(r => [r, 'item'])]
  await sql`
    INSERT INTO cen_rutas (ruta, totales)
    SELECT * FROM unnest(${filas.map(f => f[0])}::text[], ${filas.map(f => f[1])}::text[])
    ON CONFLICT (ruta) DO NOTHING
  `
  for (const r of REGLAS) {
    const [existe] = await sql`SELECT id FROM cen_reglas_ruta WHERE ruta = ${r.ruta} AND ean_comprador = ${r.ean}`
    if (!existe) {
      await sql`
        INSERT INTO cen_reglas_ruta (prioridad, ruta, ean_comprador, ciudades, departamentos, peso_min, peso_max, descripcion, activo)
        VALUES (${r.prioridad}, ${r.ruta}, ${r.ean}, '{}', '{}', NULL, NULL, ${r.descripcion}, TRUE)
      `
    }
  }
  console.log(`✅ cen_rutas lista (${filas.length} rutas) y reglas ARA y D1 creadas`)
}
main().catch(e => { console.error(e); process.exit(1) })
