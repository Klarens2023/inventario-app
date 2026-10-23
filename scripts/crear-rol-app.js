#!/usr/bin/env node
/**
 * Crea (o actualiza) un rol de base de datos con los permisos MÍNIMOS que
 * necesita la app en producción, para no usar el dueño de la base
 * (neondb_owner) en Vercel.
 *
 * Con el dueño, una inyección SQL o una credencial filtrada permitiría borrar
 * tablas, cambiar su estructura o crear roles. Con este rol:
 *   - puede leer y escribir datos (SELECT, INSERT, UPDATE, DELETE) en todas
 *     las tablas, que es lo único que hace la app en tiempo de ejecución
 *     (no ejecuta CREATE/ALTER/DROP; eso lo hacen los scripts de migración);
 *   - NO puede crear, alterar ni borrar tablas, índices o vistas;
 *   - audit_logs queda SOLO lectura e inserción: la bitácora no se puede
 *     modificar ni borrar desde la app, aunque alguien tome control de ella.
 *
 * Las migraciones (scripts/migrate-*.js) se siguen corriendo con el dueño.
 * ALTER DEFAULT PRIVILEGES hace que las tablas que creen en el futuro
 * también queden accesibles para este rol sin volver a correr este script.
 *
 * Uso (conectado como el DUEÑO de la base):
 *   DATABASE_URL="<url del dueño>" APP_DB_PASSWORD="<contraseña larga>" \
 *     node scripts/crear-rol-app.js [nombre_rol]
 *
 * Luego, en Vercel, DATABASE_URL pasa a usar ese rol y esa contraseña (mismo
 * host y base). La contraseña nunca se imprime.
 */

const { neon } = require('@neondatabase/serverless')

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL
  const PASSWORD = process.env.APP_DB_PASSWORD
  const ROL = process.argv[2] || 'app_operaciones'
  if (!DATABASE_URL) { console.error('❌ Falta DATABASE_URL (del dueño de la base)'); process.exit(1) }
  if (!PASSWORD || PASSWORD.length < 24) { console.error('❌ APP_DB_PASSWORD debe tener al menos 24 caracteres'); process.exit(1) }
  // El nombre va dentro del SQL (los identificadores no admiten parámetros): solo letras, números y _
  if (!/^[a-z_][a-z0-9_]{2,40}$/.test(ROL)) { console.error('❌ Nombre de rol no válido'); process.exit(1) }

  const sql = neon(DATABASE_URL)
  // Quién es el dueño actual: las tablas futuras las creará él
  const [{ dueno, base }] = await sql`SELECT current_user AS dueno, current_database() AS base`
  const q = s => sql(s) // DDL con identificadores ya validados arriba

  // La contraseña sí va como literal escapado (CREATE ROLE no acepta parámetros $1)
  const literal = "'" + PASSWORD.replace(/'/g, "''") + "'"
  const [existe] = await sql`SELECT 1 FROM pg_roles WHERE rolname = ${ROL}`
  await q(`${existe ? 'ALTER' : 'CREATE'} ROLE ${ROL} WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD ${literal}`)
  console.log(`✅ rol ${ROL} ${existe ? 'actualizado' : 'creado'}`)

  // Conectarse a la base y usar el esquema public (sin poder crear objetos en él)
  await q(`GRANT CONNECT ON DATABASE "${base}" TO ${ROL}`)
  await q(`GRANT USAGE ON SCHEMA public TO ${ROL}`)
  await q(`REVOKE CREATE ON SCHEMA public FROM ${ROL}`)

  // Datos: lectura y escritura en todas las tablas y vistas actuales
  await q(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${ROL}`)
  // Secuencias: necesarias para los id SERIAL / IDENTITY al insertar
  await q(`GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${ROL}`)

  // Bitácora de auditoría: solo agregar y consultar
  await q(`REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM ${ROL}`)

  // Lo mismo para las tablas y secuencias que el dueño cree en el futuro
  await q(`ALTER DEFAULT PRIVILEGES FOR ROLE "${dueno}" IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${ROL}`)
  await q(`ALTER DEFAULT PRIVILEGES FOR ROLE "${dueno}" IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ${ROL}`)

  console.log('✅ permisos: datos de lectura/escritura, sin DDL, audit_logs solo SELECT/INSERT')
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
