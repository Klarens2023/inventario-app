#!/usr/bin/env node
/**
 * Inventario de Siesa guardado para el reporte de necesidad por producto (app/api/logistica/ordenes-cen/inventario):
 * se consulta en Siesa SOLO con el botón "Actualizar inventario" y aquí queda la última foto, con quién y cuándo.
 *   - cen_inventario: existencia por ítem de Siesa (total, comprometida y por bodega)
 *   - cen_inventario_estado: una fila con la fecha, el usuario y la conexión de la última actualización
 * Uso: node --env-file=.env.local scripts/migrate-add-cen-inventario.js
 */
const { neon } = require('@neondatabase/serverless')
async function main() {
  if (!process.env.DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  const sql = neon(process.env.DATABASE_URL)
  console.log('Base:', process.env.DATABASE_URL.match(/@([^.]+)/)[1])
  await sql`
    CREATE TABLE IF NOT EXISTS cen_inventario (
      f120_id INTEGER PRIMARY KEY,
      unidad VARCHAR(6) NOT NULL DEFAULT '',
      existencia NUMERIC(18,4) NOT NULL DEFAULT 0,
      comprometida NUMERIC(18,4) NOT NULL DEFAULT 0,
      por_bodega JSONB NOT NULL DEFAULT '{}'::jsonb
    )`
  await sql`
    CREATE TABLE IF NOT EXISTS cen_inventario_estado (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      actualizado_at TIMESTAMPTZ NOT NULL,
      actualizado_por VARCHAR(120),
      conexion VARCHAR(10),
      items INTEGER NOT NULL DEFAULT 0
    )`
  console.log('✅ Tablas cen_inventario y cen_inventario_estado listas')
}
main().catch(e => { console.error(e); process.exit(1) })
