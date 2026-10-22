#!/usr/bin/env node
/**
 * Exporta el esquema REAL de la base (tablas, columnas, restricciones, índices,
 * vistas y secuencias) a db/esquema.sql, leyendo el catálogo de PostgreSQL.
 *
 * Por qué existe: schema.sql quedó desactualizado y las migraciones de scripts/
 * se corrieron a mano, así que la base no se podía reconstruir desde el repo
 * (AUD-23). No hace falta pg_dump.
 *
 * Solo lectura: no modifica la base. Usar con una rama de desarrollo de Neon.
 *
 * Uso: node --env-file=.env.local scripts/exportar-esquema.js
 */

const fs = require('fs')
const path = require('path')
const { neon } = require('@neondatabase/serverless')

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  const sql = neon(url)

  const secuencias = await sql`
    SELECT sequencename AS nombre FROM pg_sequences WHERE schemaname = 'public' ORDER BY 1`

  const tablas = await sql`
    SELECT c.relname AS tabla, obj_description(c.oid) AS comentario
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY 1`

  const columnas = await sql`
    SELECT c.relname AS tabla, a.attname AS columna, format_type(a.atttypid, a.atttypmod) AS tipo,
           a.attnotnull AS no_nulo, pg_get_expr(d.adbin, d.adrelid) AS defecto, a.attnum
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY c.relname, a.attnum`

  // Primero PK/UNIQUE/CHECK dentro de la tabla; las FK al final (dependen de otras tablas)
  const restricciones = await sql`
    SELECT c.relname AS tabla, k.conname AS nombre, k.contype AS tipo, pg_get_constraintdef(k.oid) AS def
    FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' ORDER BY c.relname, k.contype, k.conname`

  const indices = await sql`
    SELECT i.indexname AS nombre, i.indexdef AS def FROM pg_indexes i
    WHERE i.schemaname = 'public'
      AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conname = i.indexname)
    ORDER BY i.tablename, i.indexname`

  const vistas = await sql`
    SELECT viewname AS nombre, pg_get_viewdef(format('public.%I', viewname)::regclass, true) AS def
    FROM pg_views WHERE schemaname = 'public' ORDER BY 1`

  const q = (s) => /^[a-z_][a-z0-9_]*$/.test(s) ? s : `"${s.replace(/"/g, '""')}"`
  const L = []
  L.push('-- ════════════════════════════════════════════════════════════════════════')
  L.push('-- Esquema real de la base, generado por scripts/exportar-esquema.js')
  L.push(`-- Fecha: ${new Date().toISOString().slice(0, 10)} · No editar a mano: volver a exportar.`)
  L.push('-- Recrea la estructura (sin datos) en una base vacía, en este orden:')
  L.push('-- secuencias → tablas → restricciones → llaves foráneas → índices → vistas.')
  L.push('-- ════════════════════════════════════════════════════════════════════════')
  L.push('')
  for (const s of secuencias) L.push(`CREATE SEQUENCE IF NOT EXISTS ${q(s.nombre)};`)
  L.push('')

  for (const t of tablas) {
    if (t.comentario) L.push(`-- ${t.comentario}`)
    const cols = columnas.filter(c => c.tabla === t.tabla).map(c =>
      `  ${q(c.columna)} ${c.tipo}${c.defecto ? ` DEFAULT ${c.defecto}` : ''}${c.no_nulo ? ' NOT NULL' : ''}`)
    L.push(`CREATE TABLE IF NOT EXISTS ${q(t.tabla)} (\n${cols.join(',\n')}\n);`)
    L.push('')
  }

  L.push('-- Restricciones (llave primaria, únicas y CHECK)')
  for (const r of restricciones.filter(r => r.tipo !== 'f'))
    L.push(`ALTER TABLE ${q(r.tabla)} ADD CONSTRAINT ${q(r.nombre)} ${r.def};`)
  L.push('')
  L.push('-- Llaves foráneas')
  for (const r of restricciones.filter(r => r.tipo === 'f'))
    L.push(`ALTER TABLE ${q(r.tabla)} ADD CONSTRAINT ${q(r.nombre)} ${r.def};`)
  L.push('')
  L.push('-- Índices')
  for (const i of indices) L.push(`${i.def.replace(/^CREATE (UNIQUE )?INDEX /, 'CREATE $1INDEX IF NOT EXISTS ')};`)
  L.push('')
  L.push('-- Vistas')
  for (const v of vistas) L.push(`CREATE OR REPLACE VIEW ${q(v.nombre)} AS\n${v.def.trim().replace(/;$/, '')};\n`)

  const destino = path.join(__dirname, '..', 'db', 'esquema.sql')
  fs.mkdirSync(path.dirname(destino), { recursive: true })
  fs.writeFileSync(destino, L.join('\n') + '\n')
  console.log(`✅ ${destino}: ${tablas.length} tablas, ${restricciones.length} restricciones, ${indices.length} índices, ${vistas.length} vistas, ${secuencias.length} secuencias`)
}

main().catch(e => { console.error(e); process.exit(1) })
