#!/usr/bin/env node
/**
 * Poblar usuario_modulos para usuarios existentes según su rol/área actual.
 * Correr UNA SOLA VEZ después de aplicar la migración de usuario_modulos
 * (ver schema.sql), para que nadie pierda acceso al pasar del sistema de
 * área fija al sistema de módulos por usuario.
 *
 * Uso: DATABASE_URL="..." node scripts/seed-modulos.js
 */

const { neon } = require('@neondatabase/serverless')

const MODULOS = [
  'cargar', 'consulta', 'acumulados',
  'pvn_historial', 'pvn_analisis', 'pvn_catalogo', 'pvn_pagos_qr',
  'equipos',
]
const LOG = ['cargar', 'consulta', 'acumulados']
const PV  = ['pvn_historial', 'pvn_analisis', 'pvn_catalogo', 'pvn_pagos_qr']
const SIS = ['equipos']

function modulosPorDefecto(rol, area) {
  if (rol === 'admin') return [...MODULOS]
  if (area === 'logistica') return rol === 'lider' ? [...LOG, ...PV] : [...LOG]
  if (area === 'sistemas')  return [...SIS]
  if (area === 'general')   return rol === 'lider' ? [...MODULOS] : [...LOG, ...PV, ...SIS]
  return []
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ Falta DATABASE_URL en las variables de entorno')
    process.exit(1)
  }

  const sql = neon(process.env.DATABASE_URL)

  console.log('🔧 Poblando usuario_modulos para usuarios existentes...\n')

  const usuarios = await sql`SELECT id, username, rol, area FROM usuarios WHERE rol NOT IN ('pvn', 'pvv')`

  for (const u of usuarios) {
    const existentes = await sql`SELECT modulo FROM usuario_modulos WHERE usuario_id = ${u.id}`
    if (existentes.length > 0) {
      console.log(`⏭️  ${u.username} ya tiene módulos asignados (${existentes.length}), se omite`)
      continue
    }
    const modulos = modulosPorDefecto(u.rol, u.area)
    for (const m of modulos) {
      await sql`INSERT INTO usuario_modulos (usuario_id, modulo) VALUES (${u.id}, ${m}) ON CONFLICT DO NOTHING`
    }
    console.log(`✅ ${u.username} (${u.rol}/${u.area}) → ${modulos.join(', ') || '(sin módulos)'}`)
  }

  console.log('\n🎉 Listo. Revisa en /admin/usuarios que cada usuario tenga el acceso esperado.')
}

main().catch(e => { console.error(e); process.exit(1) })
