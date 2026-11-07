// Pruebas del orden de tablas por columna (lib/ordenTabla.ts): fechas, números en formato colombiano y texto.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aFecha, aNumero, esVacio, ordenar, tipoColumna } from '../lib/ordenTabla.ts'

test('reconoce números en formato colombiano', () => {
  assert.equal(aNumero('$ 82.805.760'), 82805760)
  assert.equal(aNumero('24.883,2 kg'), 24883.2)
  assert.equal(aNumero('27.648'), 27648)
  assert.equal(aNumero('-15%'), -15)
  assert.equal(aNumero('4503983039'), 4503983039)
  assert.equal(aNumero('900480569/010'), null)
  assert.equal(aNumero('PVK-17347'), null)
  assert.equal(aNumero('1 producto(s)'), null)
})

test('reconoce fechas en los formatos de la app', () => {
  assert.equal(aFecha('2026-11-06'), Date.UTC(2026, 10, 6) / 60000)
  assert.equal(aFecha('06/11/2026 13:29'), Date.UTC(2026, 10, 6) / 60000 + 13 * 60 + 29)
  assert.equal(aFecha('vie, 6 de nov', 2026), Date.UTC(2026, 10, 6) / 60000)
  assert.equal(aFecha('2 de dic de 2025'), Date.UTC(2025, 11, 2) / 60000)
  assert.equal(aFecha('Galapa'), null)
  assert.ok(aFecha('lun, 2 de nov', 2026)! < aFecha('vie, 13 de nov', 2026)!)
})

test('decide el tipo de la columna e ignora los vacíos', () => {
  assert.equal(tipoColumna(['$ 1.000', '—', '$ 25']), 'numero')
  assert.equal(tipoColumna(['06/11/2026', '', '01/10/2026']), 'fecha')
  assert.equal(tipoColumna(['ARA', '12', 'D1']), 'texto')
  assert.ok(esVacio('—') && esVacio('  ') && !esVacio('0'))
})

test('ordena por número, fecha y texto con los vacíos al final', () => {
  assert.deepEqual(ordenar(['$ 1.000', '—', '$ 25', '$ 300'], 'asc'), [2, 3, 0, 1])
  assert.deepEqual(ordenar(['$ 1.000', '—', '$ 25', '$ 300'], 'desc'), [0, 3, 2, 1])
  assert.deepEqual(ordenar(['13/11/2026', '02/11/2026', '14/11/2026'], 'asc'), [1, 0, 2])
  assert.deepEqual(ordenar(['PVK-10', 'pvk-9', 'Ébano', 'abeja'], 'asc'), [3, 2, 1, 0])
  // Los empates conservan el orden original
  assert.deepEqual(ordenar(['B', 'A', 'B', 'A'], 'asc'), [1, 3, 0, 2])
})
