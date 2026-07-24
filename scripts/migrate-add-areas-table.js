#!/usr/bin/env node
/**
 * Crea la tabla `areas` (dinámica, gestionable desde la UI) y siembra los
 * valores que hoy están hardcodeados en components/usuarios/constants.ts y
 * lib/permissions.ts, para que nada se rompa al migrar.
 *
 * 'general' y 'puntos_venta' quedan protegidas: no se pueden borrar ni
 * renombrar su `key` porque lib/auth.ts asigna 'general' fijo a los admins,
 * y el alta/edición de usuario asigna 'puntos_venta' fijo a roles pvn/pvv.
 *
 * Correr UNA SOLA VEZ.
 * Uso: DATABASE_URL="..." node scripts/migrate-add-areas-table.js
 */

const { neon } = require('@neondatabase/serverless')

const AREAS = [
  {
    key: 'logistica', label: 'Logística', color: '#065f46', bg: '#d1fae5',
    roles_permitidos: ['usuario', 'lider'],
    modulos_usuario: ['cargar', 'consulta', 'acumulados'],
    modulos_lider:   ['cargar', 'consulta', 'acumulados', 'pvn_historial', 'pvn_analisis', 'pvn_catalogo', 'pvn_pagos_qr'],
    protegida: false,
  },
  {
    key: 'sistemas', label: 'Sistemas', color: '#1e3a5f', bg: '#dbeafe',
    roles_permitidos: ['usuario', 'lider'],
    modulos_usuario: ['equipos', 'movimientos_tic'],
    modulos_lider:   ['equipos', 'movimientos_tic'],
    protegida: false,
  },
  {
    key: 'general', label: 'Administración', color: '#7c2d12', bg: '#fed7aa',
    roles_permitidos: ['admin', 'lider'],
    modulos_usuario: ['cargar', 'consulta', 'acumulados', 'pvn_historial', 'pvn_analisis', 'pvn_catalogo', 'pvn_pagos_qr', 'equipos', 'movimientos_tic'],
    modulos_lider:   ['cargar', 'consulta', 'acumulados', 'pvn_historial', 'pvn_analisis', 'pvn_catalogo', 'pvn_pagos_qr', 'equipos', 'movimientos_tic'],
    protegida: true,
  },
  {
    key: 'puntos_venta', label: 'Puntos de Venta', color: '#6b21a8', bg: '#f3e8ff',
    roles_permitidos: ['pvn', 'pvv'],
    modulos_usuario: ['pvn_historial', 'pvn_analisis', 'pvn_catalogo', 'pvn_pagos_qr'],
    modulos_lider:   ['pvn_historial', 'pvn_analisis', 'pvn_catalogo', 'pvn_pagos_qr'],
    protegida: true,
  },
  {
    key: 'contabilidad', label: 'Contabilidad', color: '#92400e', bg: '#fef3c7',
    roles_permitidos: ['usuario', 'lider'],
    modulos_usuario: [],
    modulos_lider: [],
    protegida: false,
  },
]

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }

  const sql = neon(DATABASE_URL)

  await sql`
    CREATE TABLE IF NOT EXISTS areas (
      id                SERIAL PRIMARY KEY,
      key               VARCHAR(50) UNIQUE NOT NULL,
      label             VARCHAR(100) NOT NULL,
      color             VARCHAR(20) NOT NULL,
      bg                VARCHAR(20) NOT NULL,
      roles_permitidos  TEXT[] NOT NULL DEFAULT '{}',
      modulos_usuario   TEXT[] NOT NULL DEFAULT '{}',
      modulos_lider     TEXT[] NOT NULL DEFAULT '{}',
      protegida         BOOLEAN NOT NULL DEFAULT FALSE,
      created_at        TIMESTAMP DEFAULT NOW()
    )
  `

  for (const a of AREAS) {
    await sql`
      INSERT INTO areas (key, label, color, bg, roles_permitidos, modulos_usuario, modulos_lider, protegida)
      VALUES (${a.key}, ${a.label}, ${a.color}, ${a.bg}, ${a.roles_permitidos}, ${a.modulos_usuario}, ${a.modulos_lider}, ${a.protegida})
      ON CONFLICT (key) DO NOTHING
    `
  }

  console.log('✅ Tabla areas creada y sembrada con los 5 valores actuales')
}

main().catch(e => { console.error(e); process.exit(1) })
