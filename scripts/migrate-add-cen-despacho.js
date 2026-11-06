#!/usr/bin/env node
/**
 * Consecutivo de relación por semana de DESPACHO (RUTA-MMSS, ej. DISTRYCAR-1145):
 *   - cen_rutas.dias_transito: días antes de la entrega en que sale el despacho de cada ruta (0 = el mismo día).
 *     La fecha de despacho de una orden = entrega − días de tránsito de su ruta.
 *   - cen_ordenes.fecha_despacho: fecha de despacho fijada a mano en una orden (vacía = la calculada).
 *   - Todas las rutas de las reglas y de las órdenes quedan en cen_rutas (con 0 días si no estaban).
 * Uso: node scripts/migrate-add-cen-despacho.js (con DATABASE_URL de la base que corresponda)
 */
const { neon } = require('@neondatabase/serverless')
async function main() {
  if (!process.env.DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  const sql = neon(process.env.DATABASE_URL)
  console.log('Base:', process.env.DATABASE_URL.match(/@([^.]+)/)[1])
  await sql`ALTER TABLE cen_rutas ADD COLUMN IF NOT EXISTS dias_transito INTEGER NOT NULL DEFAULT 0`
  await sql`ALTER TABLE cen_ordenes ADD COLUMN IF NOT EXISTS fecha_despacho DATE`
  const r = await sql`
    INSERT INTO cen_rutas (ruta, totales)
    SELECT DISTINCT ruta, 'item' FROM (SELECT ruta FROM cen_reglas_ruta UNION SELECT ruta FROM cen_ordenes WHERE ruta IS NOT NULL) x
    WHERE ruta IS NOT NULL
    ON CONFLICT (ruta) DO NOTHING
    RETURNING ruta
  `
  console.log(`✅ Despacho por ruta listo (${r.length} ruta(s) agregadas a cen_rutas con 0 días de tránsito)`)
}
main().catch(e => { console.error(e); process.exit(1) })
