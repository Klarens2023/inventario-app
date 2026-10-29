// Códigos TOTP (lib/totp.ts) contra los vectores oficiales del RFC 6238 y
// casos de uso de la verificación en dos pasos.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import {
  base32Codificar, base32Decodificar, codigoParaPaso, verificarCodigo, pasoActual, urlOtpauth,
  cifrarClave, descifrarClave, claveMaestra, generarCodigosRecuperacion, huellaRecuperacion, pareceCodigoRecuperacion,
} from '../lib/totp.ts'

// Apéndice B del RFC 6238 (SHA-1, clave ASCII "12345678901234567890", 8 dígitos)
const CLAVE_RFC = Buffer.from('12345678901234567890')
const VECTORES: [number, string][] = [
  [59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'],
  [1234567890, '89005924'], [2000000000, '69279037'], [20000000000, '65353130'],
]

test('códigos idénticos a los vectores del RFC 6238', () => {
  for (const [segundos, esperado] of VECTORES) {
    assert.equal(codigoParaPaso(CLAVE_RFC, Math.floor(segundos / 30), 8), esperado, `t=${segundos}`)
    // Con 6 dígitos (lo que muestran las apps) son las últimas 6 cifras
    assert.equal(codigoParaPaso(CLAVE_RFC, Math.floor(segundos / 30)), esperado.slice(2))
  }
})

test('base32 ida y vuelta, y la clave del RFC en base32', () => {
  assert.equal(base32Codificar(CLAVE_RFC), 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
  const b = randomBytes(20)
  assert.deepEqual(base32Decodificar(base32Codificar(b)), b)
  assert.throws(() => base32Decodificar('NO-VALIDA-1!'))
})

test('verificación: acepta ±30 s, rechaza otros pasos, formato inválido y códigos ya usados', () => {
  const ahora = 1_800_000_000_000
  const p = pasoActual(ahora)
  const clave = randomBytes(20)
  assert.equal(verificarCodigo(clave, codigoParaPaso(clave, p), null, ahora), p)
  assert.equal(verificarCodigo(clave, codigoParaPaso(clave, p - 1), null, ahora), p - 1)
  assert.equal(verificarCodigo(clave, codigoParaPaso(clave, p + 1), null, ahora), p + 1)
  assert.equal(verificarCodigo(clave, codigoParaPaso(clave, p - 3), null, ahora), null)
  assert.equal(verificarCodigo(clave, '12345', null, ahora), null)
  assert.equal(verificarCodigo(clave, 'abcdef', null, ahora), null)
  // El mismo código no se acepta dos veces
  assert.equal(verificarCodigo(clave, codigoParaPaso(clave, p), p, ahora), null)
  // Con espacios (como lo muestran algunas apps: "123 456") sí
  const c = codigoParaPaso(clave, p)
  assert.equal(verificarCodigo(clave, `${c.slice(0, 3)} ${c.slice(3)}`, null, ahora), p)
})

test('cifrado de la clave: ida y vuelta, y falla si se altera o con otra maestra', () => {
  const maestra = randomBytes(32)
  const clave = randomBytes(20)
  const guardado = cifrarClave(clave, maestra)
  assert.deepEqual(descifrarClave(guardado, maestra), clave)
  assert.notEqual(cifrarClave(clave, maestra), guardado, 'cada cifrado usa un IV distinto')
  const alterado = guardado.slice(0, -2) + (guardado.endsWith('A') ? 'BB' : 'AA')
  assert.throws(() => descifrarClave(alterado, maestra))
  assert.throws(() => descifrarClave(guardado, randomBytes(32)))
})

test('clave maestra: solo base64 de 32 bytes', () => {
  assert.equal(claveMaestra(undefined), null)
  assert.equal(claveMaestra('corta'), null)
  assert.equal(claveMaestra(randomBytes(32).toString('base64'))?.length, 32)
})

test('códigos de recuperación: 10 distintos, formato fijo y huella que ignora guion y mayúsculas', () => {
  const maestra = randomBytes(32)
  const codigos = generarCodigosRecuperacion()
  assert.equal(new Set(codigos).size, 10)
  for (const c of codigos) {
    assert.match(c, /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/)
    assert.ok(pareceCodigoRecuperacion(c))
  }
  const [c] = codigos
  assert.equal(huellaRecuperacion(c.toLowerCase().replace('-', ''), maestra), huellaRecuperacion(c, maestra))
  assert.equal(pareceCodigoRecuperacion('123456'), false)
})

test('URL otpauth para el código QR', () => {
  const u = urlOtpauth(CLAVE_RFC, 'admin')
  assert.match(u, /^otpauth:\/\/totp\/Operaciones%20Klaren's%3Aadmin\?/)
  assert.match(u, /secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ/)
  assert.match(u, /period=30/)
})
