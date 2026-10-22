#!/usr/bin/env node
/**
 * Índices únicos que hacen cumplir en la BD reglas que hoy solo valida el código
 * con un SELECT previo (y que dos peticiones simultáneas —doble toque en el
 * celular, reintento de red— pueden saltarse):
 *
 *   ux_pvn_turnos_activo_dia  un solo turno ABIERTO por usuario y día
 *                             (misma regla que POST /api/qr/turno accion=abrir)
 *   ux_pvn_registros_turno    un solo registro de ventas por usuario, fecha y turno
 *                             (misma regla que POST /api/pvn/registros)
 *
 * No borra ni modifica datos. Si ya existen duplicados, NO crea ese índice: los
 * lista para que se depuren a mano primero (decisión de negocio, no del script).
 * Se puede correr varias veces.
 *
 * Uso: DATABASE_URL="..." node scripts/migrate-add-indices-unicos.js
 */

const { neon } = require('@neondatabase/serverless')

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  const sql = neon(DATABASE_URL)

  const turnosDup = await sql`
    SELECT usuario_id, fecha::text, COUNT(*)::int AS n, array_agg(id ORDER BY id) AS ids
    FROM pvn_turnos WHERE activo = TRUE
    GROUP BY usuario_id, fecha HAVING COUNT(*) > 1
  `
  if (turnosDup.length) {
    console.log('⚠️  Hay turnos abiertos duplicados; no se crea ux_pvn_turnos_activo_dia:')
    for (const d of turnosDup) console.log(`   usuario ${d.usuario_id} · ${d.fecha} · turnos ${d.ids.join(', ')}`)
  } else {
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS ux_pvn_turnos_activo_dia ON pvn_turnos (usuario_id, fecha) WHERE activo`
    console.log('✅ ux_pvn_turnos_activo_dia')
  }

  const registrosDup = await sql`
    SELECT usuario_id, fecha::text, turno, COUNT(*)::int AS n, array_agg(id ORDER BY id) AS ids
    FROM pvn_registros
    GROUP BY usuario_id, fecha, turno HAVING COUNT(*) > 1
  `
  if (registrosDup.length) {
    console.log('⚠️  Hay registros de ventas duplicados; no se crea ux_pvn_registros_turno:')
    for (const d of registrosDup) console.log(`   usuario ${d.usuario_id} · ${d.fecha} · ${d.turno} · registros ${d.ids.join(', ')}`)
  } else {
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS ux_pvn_registros_turno ON pvn_registros (usuario_id, fecha, turno)`
    console.log('✅ ux_pvn_registros_turno')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
