#!/usr/bin/env node
/**
 * Agrega la columna `acceso_movil` a `usuarios`, para controlar el acceso a
 * la app móvil por usuario individual en vez de una lista de roles fija en
 * app/api/auth/mobile/login/route.ts.
 *
 * Preserva el comportamiento actual: pvn/pvv/usuario/admin quedan en true
 * (ya podían entrar), lider queda en false (no podía entrar). El admin puede
 * después activar el acceso a líderes puntuales desde el checkbox en
 * Crear/Editar Usuario.
 *
 * Correr UNA SOLA VEZ.
 * Uso: DATABASE_URL="..." node scripts/migrate-add-acceso-movil.js
 */

const { neon } = require('@neondatabase/serverless')

async function main() {
  const sql = neon(process.env.DATABASE_URL)

  await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS acceso_movil BOOLEAN DEFAULT true`
  await sql`UPDATE usuarios SET acceso_movil = false WHERE rol = 'lider'`

  const resumen = await sql`SELECT rol, acceso_movil, COUNT(*) AS n FROM usuarios GROUP BY rol, acceso_movil ORDER BY rol`
  console.log('Migración completa. Resumen por rol:')
  console.table(resumen)
}

main().catch(e => { console.error(e); process.exit(1) })
