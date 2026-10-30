#!/usr/bin/env node
/**
 * Escribe en .env.local la cadena de conexión de la rama de DESARROLLO (QA) de Neon.
 *
 * Uso (desde cualquier carpeta):
 *   node C:\Users\EDWIN\Desktop\Apps\inventory-app\scripts\configurar-bd-desarrollo.mjs
 * y pegar el snippet de Neon → Connect (rama QA, pooling activado) cuando lo pida.
 *
 * - Acepta el snippet completo (con comentario, DATABASE_URL= y comillas).
 * - Se niega si la cadena es la de producción (ep-small-wind) o trae asteriscos.
 * - Solo reemplaza la línea DATABASE_URL; el resto de .env.local queda igual.
 * - Nunca imprime la cadena: solo el nombre corto del servidor.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ARCHIVO = join(dirname(fileURLToPath(import.meta.url)), '..', '.env.local')
const PRODUCCION = 'ep-small-wind'

const rl = createInterface({ input: process.stdin, output: process.stdout })
const texto = await rl.question('Pega el snippet de Neon (rama QA, pooling activado) y pulsa Enter:\n')
rl.close()

const cadena = texto.match(/postgres(?:ql)?:\/\/[^\s'"]+/)?.[0]
if (!cadena) { console.error('✗ No encontré una cadena postgresql:// en lo pegado'); process.exit(1) }
if (cadena.includes(PRODUCCION)) { console.error('✗ Esa es la rama de PRODUCCIÓN: no se escribe. Cambia a la rama QA en Neon.'); process.exit(1) }
if (/:\*+@/.test(cadena)) { console.error('✗ La contraseña viene con asteriscos: pulsa "Show password" antes de "Copy snippet"'); process.exit(1) }

const lineas = readFileSync(ARCHIVO, 'utf8').split(/\r?\n/)
let reemplazada = false
const nuevas = lineas.map(l => {
  if (/^\s*DATABASE_URL\s*=/.test(l)) { reemplazada = true; return `DATABASE_URL="${cadena}"` }
  return l
})
if (!reemplazada) nuevas.unshift(`DATABASE_URL="${cadena}"`)
writeFileSync(ARCHIVO, nuevas.join('\n'))

console.log(`✓ .env.local actualizado. Servidor: ${new URL(cadena).hostname.split('.')[0]}`)
console.log('  (Borra la pantalla con "cls": lo que pegaste incluye la contraseña de QA)')
