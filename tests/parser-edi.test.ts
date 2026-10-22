// Pruebas del lector de órdenes EDI (lib/cen/parser.ts) con mensajes sintéticos
// (no se usan las muestras reales de muestras-cen/, que no van al repositorio).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsearOrden } from '../lib/cen/parser.ts'
import { codigoRelacion } from '../lib/cen/relacion.ts'

const EDIFACT = [
  "UNB+UNOA:3+7701001000008:14+7709999999999:14+261022:0800+1'",
  "UNH+1+ORDERS:D:96A:UN:EAN008'",
  "BGM+220+4500123456+9'",
  "DTM+137:20261020:102'",
  "DTM+64:20261025:102'",
  "DTM+63:20261027:102'",
  "NAD+BY+7701001000008::9'",
  "NAD+SU+7709999999999::9'",
  "NAD+DP+7701001012345::9'",
  "LIN+1++7700000000017:EN'",
  "PIA+1+000000000001005857:IN'",
  "IMD+F++:::QUESO ?+ CREMA 500G'",
  "QTY+21:24.000'",
  "PRI+AAA:12500.50'",
  "TAX+7+VAT+++:::19'",
  "LOC+7+7701001000101::9'",
  "QTY+11:10'",
  "LOC+7+7701001000102::9'",
  "QTY+11:14'",
  "UNT+15+1'",
].join('')

test('EDIFACT (Carvajal): encabezado, línea, escape ? y reparto por tienda', () => {
  const o = parsearOrden(EDIFACT)
  assert.equal(o.numeroOrden, '4500123456')
  assert.equal(o.fechaOrden, '2026-10-20')
  assert.equal(o.fechaEntrega, '2026-10-25')
  assert.equal(o.fechaEntregaMax, '2026-10-27')
  assert.equal(o.eanComprador, '7701001000008')
  assert.equal(o.eanEntrega, '7701001012345')
  assert.equal(o.lineas.length, 1)
  const l = o.lineas[0]
  assert.equal(l.eanItem, '7700000000017')
  assert.equal(l.codComprador, '1005857')
  assert.equal(l.descripcion, 'QUESO + CREMA 500G')
  assert.equal(l.cantidad, 24)
  assert.equal(l.precio, 12500.5)
  assert.equal(l.iva, 19)
  assert.deepEqual(l.distribucion, [
    { eanLocal: '7701001000101', cantidad: 10 },
    { eanLocal: '7701001000102', cantidad: 14 },
  ])
})

test('EDIFACT sin líneas se rechaza (no se guarda una orden vacía)', () => {
  assert.throws(() => parsearOrden("UNB+UNOA:3'BGM+220+1+9'NAD+BY+1::9'NAD+DP+2::9'"), /no trae productos/)
})

test('Ancho fijo (Subrik)', () => {
  const hse = [
    'BGMA4500999',
    'DTM 137 20261020',
    'DTM 64  20261024',
    'NAD BY  7701008009080   9',
    'NAD DP  7701008001234   9',
    'LIN 1 7700000000024',
    'QTYA21  000000000040.000 NAR',
    'PRI AAA 3200.00',
  ].join('\n')
  const o = parsearOrden(hse)
  assert.equal(o.numeroOrden, '4500999')
  assert.equal(o.eanComprador, '7701008009080')
  assert.equal(o.eanEntrega, '7701008001234')
  assert.equal(o.lineas[0].cantidad, 40)
  assert.equal(o.lineas[0].precio, 3200)
})

test('codigoRelacion RUTA-MMSS', () => {
  assert.equal(codigoRelacion(null, '2026-10-22'), null)
  assert.equal(codigoRelacion('EXVAL', '2026-10-22'), 'EXVAL-1043')
})
