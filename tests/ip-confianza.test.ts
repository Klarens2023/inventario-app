// Rangos de IP de confianza para el límite de login por IP (lib/ipConfianza.ts)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ipEnRango, esIpDeConfianza } from '../lib/ipConfianza.ts'

const EMPRESA = '190.242.100.248/29'

test('el /29 de la empresa incluye exactamente 190.242.100.248 a .255', () => {
  for (let i = 248; i <= 255; i++) assert.equal(ipEnRango(`190.242.100.${i}`, EMPRESA), true, `.${i}`)
  assert.equal(ipEnRango('190.242.100.247', EMPRESA), false)
  assert.equal(ipEnRango('190.242.101.250', EMPRESA), false)
})

test('IP exacta, lista con comas y espacios', () => {
  assert.equal(ipEnRango('10.0.0.1', '10.0.0.1'), true)
  assert.equal(ipEnRango('10.0.0.2', '10.0.0.1'), false)
  assert.equal(esIpDeConfianza('8.8.8.8', ` ${EMPRESA} , 8.8.8.8 `), true)
})

test('sin variable o con valores inválidos, nada es de confianza', () => {
  assert.equal(esIpDeConfianza('190.242.100.250', ''), false)
  assert.equal(ipEnRango('desconocida', EMPRESA), false)
  assert.equal(ipEnRango('::1', EMPRESA), false)
  assert.equal(ipEnRango('190.242.100.250', '190.242.100.248/33'), false)
  assert.equal(ipEnRango('190.242.100.256', '190.242.100.0/24'), false)
  assert.equal(ipEnRango('1.2.3.4', '0.0.0.0/0'), true) // /0 = todas (solo si alguien lo configura así)
})
