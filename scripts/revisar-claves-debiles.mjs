#!/usr/bin/env node
/**
 * Revisa si algún usuario tiene una contraseña conocida (AUD-04): las que
 * publicaban versiones antiguas de README.md y scripts/setup-db.js (siguen en el
 * historial público de Git), la temporal "123456" de antes de AUD-03, o su
 * propio nombre de usuario como contraseña.
 *
 * Solo LEE la tabla usuarios (sirve el rol de solo lectura app_respaldo) y
 * compara con bcrypt. Nunca imprime contraseñas ni hashes: solo el nombre de
 * usuario que hay que cambiar.
 *
 * Uso:
 *   node scripts/revisar-claves-debiles.mjs <archivo-de-candidatas>
 *   (DATABASE_URL en el entorno; el archivo trae una contraseña por línea y
 *    NO se guarda en el repositorio)
 *   Sin archivo, usa las candidatas que extrae del historial de Git.
 */
import { neon } from '@neondatabase/serverless'
import bcrypt from 'bcryptjs'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

// Acepta la cadena sola o el snippet completo de Neon (con comentario, DATABASE_URL= y comillas).
// Si no encuentra una cadena válida, NO la imprime: los errores de la librería la mostrarían entera.
const crudo = process.env.DATABASE_URL ?? ''
const url = crudo.match(/postgres(?:ql)?:\/\/[^\s'"]+/)?.[0]
if (!url) { console.error('DATABASE_URL no contiene una cadena postgresql:// válida (no se muestra por seguridad)'); process.exit(1) }

/** Contraseñas fijas que publicó el repositorio, sacadas del propio historial de Git. */
function candidatasDelHistorial() {
  const historial = execFileSync('git', ['log', '--all', '-p', '--no-color', '--', 'scripts/setup-db.js', 'README.md'], { encoding: 'utf8', maxBuffer: 50e6 })
  const encontradas = new Set()
  // setup-db.js antiguo: { username: 'x', ..., password: 'valor' }
  for (const m of historial.matchAll(/password:\s*'([^']{4,})'/g)) encontradas.add(m[1])
  // README antiguo: "✅ usuario → contraseña: valor"
  for (const m of historial.matchAll(/contraseña:\s*`?([^\s`$]{4,})`?\s*$/gm)) encontradas.add(m[1])
  return [...encontradas].filter(c => !/^\$\{|temporal/i.test(c))
}

const candidatas = new Set(process.argv[2]
  ? readFileSync(process.argv[2], 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  : candidatasDelHistorial())
candidatas.add('123456') // contraseña temporal fija antes de AUD-03

let usuarios
try {
  const sql = neon(url)
  usuarios = await sql`SELECT username, activo, password_hash FROM usuarios ORDER BY username`
} catch (e) {
  // Se oculta cualquier cadena de conexión que traiga el mensaje de error
  console.error('No se pudo leer la base:', String(e.message).replace(/postgres(ql)?:\/\/\S+/g, '[cadena oculta]'))
  process.exit(1)
}

const debiles = []
for (const u of usuarios) {
  // También se prueba el propio nombre de usuario como contraseña
  for (const c of [...candidatas, u.username]) {
    if (u.password_hash && await bcrypt.compare(c, u.password_hash)) {
      debiles.push(`${u.username}${u.activo ? '' : ' (inactivo)'}`)
      break
    }
  }
}

console.log(`Revisados ${usuarios.length} usuarios contra ${candidatas.size} contraseñas conocidas (+ su nombre de usuario).`)
if (debiles.length) {
  console.log(`⚠️  Deben cambiar su contraseña YA: ${debiles.join(', ')}`)
  console.log('   Desde /admin/usuarios → Restablecer contraseña (genera una temporal y obliga a cambiarla).')
  process.exit(2)
}
console.log('✅ Ningún usuario usa una contraseña conocida.')
