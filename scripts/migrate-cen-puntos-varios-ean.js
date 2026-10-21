#!/usr/bin/env node
/**
 * Una sucursal de Siesa puede recibir órdenes por varios EAN de entrega: el de la tienda y el del CEDI
 * donde se entrega la mercancía. Ej. el CEDI VEGAS de Éxito (EAN 7701001000305, Calle 43 sur 48-127
 * Envigado) se factura a la sucursal 024 CARULLA POBLADO, que en Siesa tiene esa misma dirección.
 *   - Quita la restricción UNIQUE (nit, sucursal) de cen_puntos_ean; el EAN sigue siendo único
 *     (cada EAN lleva a una sola sucursal).
 *   - Asocia el CEDI VEGAS a 890900608/024 (ciudad Envigado → ruta EXEN) y sus órdenes por revisar.
 * Uso: node --env-file=.env.local scripts/migrate-cen-puntos-varios-ean.js
 */
const { neon } = require('@neondatabase/serverless')

const PUNTOS = [
  { ean: '7701001000305', nit: '890900608', sucursal: '024', razon: 'CARULLA POBLADO (entrega CEDI VEGAS)', ciudad: 'Envigado', depto: 'Antioquia' },
]

async function main() {
  if (!process.env.DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  const sql = neon(process.env.DATABASE_URL)

  await sql`ALTER TABLE cen_puntos_ean DROP CONSTRAINT IF EXISTS cen_puntos_ean_nit_sucursal_key`
  await sql`CREATE INDEX IF NOT EXISTS idx_cen_puntos_ean_nit_sucursal ON cen_puntos_ean(nit, sucursal)`

  for (const p of PUNTOS) {
    await sql`
      INSERT INTO cen_puntos_ean (nit, sucursal, razon_social, ean, ciudad, departamento, bodega)
      VALUES (${p.nit}, ${p.sucursal}, ${p.razon}, ${p.ean}, ${p.ciudad}, ${p.depto}, '00110')
      ON CONFLICT (ean) DO NOTHING
    `
    const o = await sql`
      UPDATE cen_ordenes SET nit = ${p.nit}, sucursal = ${p.sucursal}, razon_social = ${p.razon},
             estado = CASE WHEN estado = 'sin_punto' THEN 'pendiente' ELSE estado END, updated_at = NOW()
      WHERE ean_entrega = ${p.ean} AND nit IS NULL AND estado IN ('sin_punto', 'pendiente', 'error')
      RETURNING numero_orden
    `
    console.log(`  ✓ EAN ${p.ean} → ${p.nit}/${p.sucursal} (${o.length} orden(es): ${o.map(x => x.numero_orden).join(', ')})`)
  }
  console.log('✅ Una sucursal ya puede tener varios EAN de entrega')
}
main().catch(e => { console.error(e); process.exit(1) })
