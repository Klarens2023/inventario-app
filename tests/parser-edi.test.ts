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

// Mismo diseño que los .hse reales de Subrik (columnas con espacios, fechas de 12
// dígitos con código de formato al final, número de línea con ceros), con valores inventados.
const HSE_SUBRIK = [
  'UNH 1',
  'BGM 220',
  'BGMA4500777001',
  'DTM 137 20261022                            102',
  'DTM 64  202610250000                        203',
  'DTM 63  202610270000                        203',
  'NAD BY  7701008009080                           9',
  'NAD SU  7709999999999                           9',
  'NAD DP  7701008001234                           9',
  'NAD IV  7701008009080                           9',
  'LIN 000001     7700000000017                       EN ',
  'PIA 1   000000000001005857                  AT ',
  'QTYA21  000000000024.000 NAR',
  'PRI AAA 000000004403.000',
  'TAXF7   VAT',
  'TAXG                                19',
  'MOAE124 000000105672.000',
  'LIN 000002     7700000000024                       EN ',
  'PIA 1   000000000001005860                  AT ',
  'QTYA21  000000000006.000 NAR',
  'PRI AAA 000000008808.500',
  'TAXF7   VAT',
  'TAXG                                0',
  'CNT 2',
].join('\r\n')

test('Subrik con el diseño real: varias líneas, fechas largas, ceros e IVA', () => {
  const o = parsearOrden(HSE_SUBRIK)
  assert.equal(o.numeroOrden, '4500777001')               // la línea "BGM 220" no lo reemplaza
  assert.equal(o.fechaOrden, '2026-10-22')
  assert.equal(o.fechaEntrega, '2026-10-25')
  assert.equal(o.fechaEntregaMax, '2026-10-27')
  assert.equal(o.eanComprador, '7701008009080')
  assert.equal(o.eanProveedor, '7709999999999')
  assert.equal(o.eanEntrega, '7701008001234')              // NAD IV (factura) no cambia el punto de entrega
  assert.deepEqual(o.lineas.map(l => l.nroLinea), [1, 2])
  assert.deepEqual(o.lineas.map(l => l.eanItem), ['7700000000017', '7700000000024'])
  assert.deepEqual(o.lineas.map(l => l.codComprador), ['1005857', '1005860'])
  assert.deepEqual(o.lineas.map(l => l.cantidad), [24, 6])
  assert.deepEqual(o.lineas.map(l => l.precio), [4403, 8808.5])
  assert.deepEqual(o.lineas.map(l => l.iva), [19, 0])
  assert.deepEqual(o.lineas.map(l => l.distribucion), [[], []])
})

test('EDIFACT con varias líneas: cada QTY/PRI va a su línea y el reparto suma la cantidad', () => {
  const o = parsearOrden([
    "UNB+UNOA:3+7701001000008:14+7709999999999:14+261022:0800+1'",
    "UNH+1+ORDERS:D:96A:UN:EAN008'",
    "BGM+220+4500123457+9'",
    "DTM+137:202610200000:203'",
    "NAD+BY+7701001000008::9'",
    "NAD+DP+7701001012345::9'",
    "LIN+1++7700000000017:EN'", "QTY+21:5'", "PRI+AAA:100'",
    "LIN+2++7700000000024:EN'", "IMD+F++:::JUGO D?'ORO'", "QTY+21:30'", "PRI+AAA:250.25'",
    "LOC+7+7701001000101::9'", "QTY+11:12'", "LOC+7+7701001000102::9'", "QTY+11:18'",
    "UNT+14+1'",
  ].join(''))
  assert.equal(o.fechaOrden, '2026-10-20')
  assert.equal(o.fechaEntrega, null)
  assert.deepEqual(o.lineas.map(l => [l.nroLinea, l.cantidad, l.precio]), [[1, 5, 100], [2, 30, 250.25]])
  assert.equal(o.lineas[1].descripcion, "JUGO D'ORO")     // ?' es un apóstrofe literal, no fin de segmento
  assert.deepEqual(o.lineas[0].distribucion, [])
  assert.equal(o.lineas[1].distribucion.reduce((s, d) => s + d.cantidad, 0), 30)
})

test('unidad de la cantidad: NAR = unidades, KGM = kilos (EDIFACT y Subrik)', () => {
  const edi = parsearOrden("UNB+UNOA:3'BGM+220+77+9'NAD+BY+1::9'NAD+DP+2::9'LIN+1++3:EN'QTY+21:12.5:KGM'LIN+2++4:EN'QTY+21:6:NAR'LIN+3++5:EN'QTY+21:2'")
  assert.deepEqual(edi.lineas.map(l => [l.cantidad, l.unidad]), [[12.5, 'KG'], [6, 'UND'], [2, 'UND']])
  const hse = parsearOrden('BGMA77\nNAD BY  7701008009080   9\nNAD DP  7701008001234   9\nLIN 000001     7700000000017   EN\nQTYA21  000000000012.500 KGM')
  assert.deepEqual(hse.lineas.map(l => [l.cantidad, l.unidad]), [[12.5, 'KG']])
  assert.equal(parsearOrden(HSE_SUBRIK).lineas[0].unidad, 'UND')
})

test('se rechaza una orden sin número, comprador o punto de entrega', () => {
  assert.throws(() => parsearOrden("UNB+UNOA:3'NAD+BY+1::9'NAD+DP+2::9'LIN+1++3:EN'QTY+21:1'"), /número/)
  assert.throws(() => parsearOrden("UNB+UNOA:3'BGM+220+9+9'NAD+DP+2::9'LIN+1++3:EN'QTY+21:1'"), /comprador/)
  assert.throws(() => parsearOrden('BGMA9\nNAD BY  7701008009080   9\nLIN 1 7700000000017\nQTYA21  1'), /punto de entrega/)
})

test('codigoRelacion RUTA-MMSS', () => {
  assert.equal(codigoRelacion(null, '2026-10-22'), null)
  assert.equal(codigoRelacion('EXVAL', '2026-10-22'), 'EXVAL-1043')
})
