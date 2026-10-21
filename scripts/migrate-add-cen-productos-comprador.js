#!/usr/bin/env node
/**
 * Producto por cadena: un mismo EAN puede ser un producto distinto según quién lo pide. Ej.
 * 7702705021764 para Éxito es el SIXPACK de avena (ítem 3218, 1,2 kg) y para Ara la bolsa
 * individual (ítem 2580, 0,2 kg, $1.093 la unidad; base "JERONIMO MARTINS.xlsx").
 *   - cen_productos_comprador: ítem de Siesa, peso, descripción y und/caja por cadena (ean_comprador + ean).
 *   - Vista cen_lineas_producto: para cada línea de orden, el producto de su cadena si existe, si no el del maestro.
 * Además completa con las bases de Ara y D1 ("JERONIMO MARTINS.xlsx", "D1 SAS 2.xlsx"):
 *   - el ítem de Siesa de los productos que no lo tenían;
 *   - las sucursales de los puntos de entrega sin asociar (ciudad de la OC en la hoja DATOS, cruzada con la
 *     ciudad de la sucursal en la base de clientes de Siesa). Palermo = CEDI Neiva de Ara (la OC 4503945127
 *     figura como PALERMO en la base de Ara y como "CENTRO DISTRIBUCION NEIVA" en BD 2026);
 * y recalcula el peso de las órdenes abiertas.
 * Uso: node --env-file=.env.local scripts/migrate-add-cen-productos-comprador.js
 */
const { neon } = require('@neondatabase/serverless')

const ARA = '7704269000018'

// Ítem de Siesa en el maestro (vale para todas las cadenas)
const ITEMS = [
  { ean: '7704269115354', f120: 2584, nota: 'Crema de leche De la Cuesta slim 200 g (Ara) → CREMA DE LECHE UHT X200 GR DE LA CUESTA' },
  { ean: '7704269387584', f120: 70, nota: 'Leche semidescremada De la Cuesta 900 ml (Ara) → LECHE SEMIDESCREMADA UHT DE LA CUESTA SL' },
  { ean: '7700304670703', f120: 3920, nota: 'Suero Latti 200 g (D1, base D1: referencia 3920) → SUERO LATTI BOLSA X 200 GR' },
  { ean: '7702705021764', f120: 3218, nota: 'Sixpack avena natural 200 ml → SIXPACK AVENA NATURAL UHT X 200 ML' },
]

// Producto distinto por cadena
const POR_CADENA = [
  { comprador: ARA, ean: '7702705021764', f120: 2580, descripcion: 'AVENA NATURAL UHT X 200 ML (bolsa individual)', peso: 0.2, und_caja: 50 },
]

const PUNTOS = [
  { ean: '7704269000537', nit: '900480569', sucursal: '011', razon: 'JERONIMO MARTINS COLOMBIA SAS 9500', ciudad: 'Montería', depto: 'Córdoba' },
  { ean: '7704269650794', nit: '900480569', sucursal: '015', razon: 'JERONIMO MARTINS COLOMBIA SAS CEDI NEIVA', ciudad: 'Neiva', depto: 'Huila' },
  { ean: '7700304046973', nit: '900276962', sucursal: '014', razon: 'D1 SAS', ciudad: 'Cúcuta', depto: 'Norte de Santander' },
]

async function main() {
  if (!process.env.DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  const sql = neon(process.env.DATABASE_URL)

  await sql`
    CREATE TABLE IF NOT EXISTS cen_productos_comprador (
      ean_comprador  VARCHAR(14) NOT NULL,
      ean            VARCHAR(14) NOT NULL,
      f120_id        INTEGER,
      descripcion    VARCHAR(200),
      peso_kg        NUMERIC(10,3),
      und_caja       INTEGER,
      updated_at     TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (ean_comprador, ean)
    )
  `
  await sql`
    CREATE OR REPLACE VIEW cen_lineas_producto AS
    SELECT l.id AS linea_id, o.ean_comprador,
           COALESCE(p.ean, c.ean) AS ean,
           COALESCE(c.f120_id, p.f120_id) AS f120_id,
           COALESCE(c.peso_kg, p.peso_kg) AS peso_kg,
           COALESCE(c.descripcion, p.descripcion) AS descripcion,
           COALESCE(c.und_caja, p.und_caja) AS und_caja,
           c.ean IS NOT NULL AS por_cadena
    FROM cen_orden_lineas l
    JOIN cen_ordenes o ON o.id = l.orden_id
    LEFT JOIN cen_productos p ON p.ean = l.ean_item
    LEFT JOIN cen_productos_comprador c ON c.ean = l.ean_item AND c.ean_comprador = o.ean_comprador
  `

  for (const i of ITEMS) {
    const r = await sql`UPDATE cen_productos SET f120_id = ${i.f120}, updated_at = NOW() WHERE ean = ${i.ean} AND f120_id IS NULL RETURNING ean`
    console.log(r.length ? '  ✓' : '  ·', i.nota)
  }
  for (const c of POR_CADENA) {
    await sql`
      INSERT INTO cen_productos_comprador (ean_comprador, ean, f120_id, descripcion, peso_kg, und_caja)
      VALUES (${c.comprador}, ${c.ean}, ${c.f120}, ${c.descripcion}, ${c.peso}, ${c.und_caja})
      ON CONFLICT (ean_comprador, ean) DO NOTHING
    `
  }

  for (const p of PUNTOS) {
    const [otro] = await sql`SELECT ean FROM cen_puntos_ean WHERE nit = ${p.nit} AND sucursal = ${p.sucursal} AND ean <> ${p.ean}`
    if (otro) { console.log(`  ⚠ ${p.nit}/${p.sucursal} ya tiene el EAN ${otro.ean}: no se asocia ${p.ean}`); continue }
    await sql`
      INSERT INTO cen_puntos_ean (nit, sucursal, razon_social, ean, ciudad, departamento, bodega)
      VALUES (${p.nit}, ${p.sucursal}, ${p.razon}, ${p.ean}, ${p.ciudad}, ${p.depto}, '00110')
      ON CONFLICT (ean) DO NOTHING
    `
    const o = await sql`
      UPDATE cen_ordenes SET nit = ${p.nit}, sucursal = ${p.sucursal}, razon_social = ${p.razon},
             estado = CASE WHEN estado = 'sin_punto' THEN 'pendiente' ELSE estado END, updated_at = NOW()
      WHERE ean_entrega = ${p.ean} AND nit IS NULL AND estado IN ('sin_punto', 'pendiente', 'error')
      RETURNING id
    `
    console.log(`  ✓ EAN ${p.ean} → ${p.nit}/${p.sucursal} ${p.ciudad} (${o.length} orden(es))`)
  }

  // Peso de las órdenes abiertas con el producto de su cadena
  const r = await sql`
    UPDATE cen_ordenes o SET peso_kg = x.peso, updated_at = NOW()
    FROM (
      SELECT l.orden_id, CASE WHEN BOOL_AND(p.ean IS NOT NULL) THEN SUM(l.cantidad * p.peso_kg) END AS peso
      FROM cen_orden_lineas l JOIN cen_lineas_producto p ON p.linea_id = l.id
      GROUP BY l.orden_id
    ) x
    WHERE o.id = x.orden_id AND o.estado <> 'enviado' AND o.peso_kg IS DISTINCT FROM x.peso
    RETURNING o.id
  `
  console.log(`✅ cen_productos_comprador y vista cen_lineas_producto listas; ${r.length} orden(es) con peso recalculado`)
}
main().catch(e => { console.error(e); process.exit(1) })
