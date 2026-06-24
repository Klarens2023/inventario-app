#!/usr/bin/env node
/**
 * Migra el área de todos los usuarios con rol pvn o pvv a 'puntos_venta'.
 * Correr UNA SOLA VEZ.
 *
 * Uso: DATABASE_URL="..." node scripts/migrate-puntos-venta-area.js
 */

const { neon } = require('@neondatabase/serverless')

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) {
    console.error('❌ Falta DATABASE_URL')
    process.exit(1)
  }

  const sql = neon(DATABASE_URL)

  const result = await sql`
    UPDATE usuarios
    SET area = 'puntos_venta'
    WHERE rol IN ('pvn', 'pvv') AND area != 'puntos_venta'
    RETURNING id, username, nombre, rol, area
  `

  if (result.length === 0) {
    console.log('✅ Ningún usuario requería migración (ya están en puntos_venta o no hay pvn/pvv)')
  } else {
    console.log(`✅ ${result.length} usuario(s) migrados a área "puntos_venta":`)
    result.forEach(u => console.log(`   - ${u.nombre} (${u.username}) → rol: ${u.rol}`))
  }
}

main().catch(e => { console.error(e); process.exit(1) })
