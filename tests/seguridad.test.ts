// Pruebas de las funciones puras de seguridad y validación.
// Correr con: npm test   (node --test, sin dependencias extra; ver docs/TESTING.md)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { escapeHtml } from '../lib/html.ts'
import { valorMonetario, VALOR_MAXIMO } from '../lib/validacion.ts'
import { tieneModulo, modulosPorDefecto, MODULOS } from '../lib/permissions.ts'
import { generarPasswordTemporal, LARGO_PASSWORD_TEMPORAL } from '../lib/passwordTemporal.ts'

test('generarPasswordTemporal: largo, alfabeto sin ambigüedades y sin repetirse (AUD-03)', () => {
  const generadas = new Set<string>()
  for (let i = 0; i < 1000; i++) {
    const p = generarPasswordTemporal()
    assert.equal(p.length, LARGO_PASSWORD_TEMPORAL)
    assert.match(p, /^[A-HJ-NP-Za-km-z2-9]+$/)
    assert.notEqual(p, '123456')
    generadas.add(p)
  }
  assert.equal(generadas.size, 1000)
})

test('escapeHtml neutraliza marcado (XSS en impresión de movimientos TIC)', () => {
  const ataque = `<img src=x onerror="fetch('/api/usuarios')">`
  const out = escapeHtml(ataque)
  assert.ok(!out.includes('<'))
  assert.ok(!out.includes('"'))
  assert.equal(out, '&lt;img src=x onerror=&quot;fetch(&#39;/api/usuarios&#39;)&quot;&gt;')
})

test('escapeHtml: null/undefined/números', () => {
  assert.equal(escapeHtml(null), '')
  assert.equal(escapeHtml(undefined), '')
  assert.equal(escapeHtml(5), '5')
  assert.equal(escapeHtml('A & B'), 'A &amp; B')
})

test('valorMonetario acepta los formatos que ya usaban los clientes', () => {
  assert.equal(valorMonetario('25000'), 25000)
  assert.equal(valorMonetario(25000), 25000)
  assert.equal(valorMonetario('1500.5'), 1500.5)
  assert.equal(valorMonetario('10.005'), 10.01)
})

test('valorMonetario rechaza montos inválidos que antes se colaban', () => {
  for (const v of ['1e999', 'Infinity', '-5', '0', '', 'abc', null, undefined, '0.001', VALOR_MAXIMO + 1, NaN]) {
    assert.equal(valorMonetario(v), null, `debió rechazar ${String(v)}`)
  }
})

test('tieneModulo: admin todo; rol vacío (sesión revocada) nada', () => {
  assert.equal(tieneModulo('admin', [], 'planos'), true)
  assert.equal(tieneModulo('usuario', ['planos'], 'planos'), true)
  assert.equal(tieneModulo('usuario', ['consulta'], 'planos'), false)
  // lib/auth.ts publica rol '' y módulos [] cuando la sesión está revocada
  for (const m of MODULOS) assert.equal(tieneModulo('', [], m), false)
})

test('modulosPorDefecto según el área', () => {
  const area = {
    id: 1, key: 'logistica', label: 'Logística', color: '', bg: '', roles_permitidos: ['usuario', 'lider'],
    modulos_usuario: ['cargar'], modulos_lider: ['cargar', 'acumulados'], protegida: true,
  }
  assert.deepEqual(modulosPorDefecto('usuario', area), ['cargar'])
  assert.deepEqual(modulosPorDefecto('lider', area), ['cargar', 'acumulados'])
  assert.deepEqual(modulosPorDefecto('usuario', undefined), [])
  assert.equal(modulosPorDefecto('admin', undefined).length, MODULOS.length)
})
