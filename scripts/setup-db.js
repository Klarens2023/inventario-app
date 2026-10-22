#!/usr/bin/env node
/**
 * Script de configuración inicial de usuarios (solo para una base de datos nueva).
 *
 * Seguridad:
 *  - No hay contraseñas fijas en el código: cada usuario recibe una contraseña
 *    temporal aleatoria (o la de la variable SETUP_PASSWORD_<USUARIO>, si se
 *    define) que se muestra UNA vez en la consola.
 *  - Los usuarios quedan con debe_cambiar_password = true: al primer ingreso la
 *    app obliga a cambiarla.
 *  - Si el usuario ya existe NO se toca (ON CONFLICT DO NOTHING). Antes este
 *    script reescribía la contraseña de 'admin' con un valor publicado en el
 *    README cada vez que se corría.
 *
 * Uso: DATABASE_URL="..." node scripts/setup-db.js
 */

const crypto = require('crypto')
const { neon } = require('@neondatabase/serverless')
const bcrypt = require('bcryptjs')

const usuarios = [
  { username: 'admin',    nombre: 'Administrador' },
  { username: 'usuario1', nombre: 'Usuario 1' },
  { username: 'usuario2', nombre: 'Usuario 2' },
]

// 12 caracteres sin ambigüedades (sin 0/O, 1/l/I) para dictarla sin errores.
function passwordTemporal() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  return Array.from(crypto.randomBytes(12), b => alfabeto[b % alfabeto.length]).join('')
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ Falta DATABASE_URL en las variables de entorno')
    process.exit(1)
  }

  const sql = neon(process.env.DATABASE_URL)

  console.log('🔧 Creando usuarios iniciales...\n')

  for (const u of usuarios) {
    const password = process.env[`SETUP_PASSWORD_${u.username.toUpperCase()}`] || passwordTemporal()
    const hash = await bcrypt.hash(password, 10)
    const creado = await sql`
      INSERT INTO usuarios (username, password_hash, nombre, debe_cambiar_password)
      VALUES (${u.username}, ${hash}, ${u.nombre}, true)
      ON CONFLICT (username) DO NOTHING
      RETURNING id
    `
    if (creado.length) console.log(`✅ ${u.username} → contraseña temporal: ${password}`)
    else console.log(`↷ ${u.username} ya existe: no se modificó`)
  }

  console.log('\n🎉 Listo. Las contraseñas temporales se deben cambiar al primer ingreso.')
}

main().catch(e => { console.error(e); process.exit(1) })
