// Pruebas de la lectura del inventario de Siesa (lib/cen/inventario.ts). Datos sintéticos.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { condicionInventario, existenciasPorItem } from '../lib/cen/inventario.ts'

const fila = (p: Record<string, unknown>) => ({ f120_id: 3348, f150_id: '00110', f121_id_ext1_detalle: 'FN', f121_id_ext2_detalle: null, f120_id_unidad_inventario: 'UND ',
  f400_cant_existencia_1: 0, f400_cant_comprometida_1: 0, f400_id_lote: '', f400_id_ubicacion_aux: null, ...p })

test('con lotes: se toma la fila sin lote (el total), no se suma dos veces', () => {
  const m = existenciasPorItem([
    fila({ f400_id_lote: '300926-1', f400_cant_existencia_1: 300 }),
    fila({ f400_id_lote: '300927-1', f400_cant_existencia_1: 244 }),
    fila({ f400_id_lote: '', f400_cant_existencia_1: 544 }), // total de los lotes
    fila({ f150_id: '001DS', f400_id_lote: '', f400_cant_existencia_1: 30 }),
  ])
  const x = m.get(3348)!
  assert.equal(x.existencia, 574)
  assert.equal(x.unidad, 'UND')
  assert.deepEqual(x.porBodega, { '00110': 544, '001DS': 30 })
})

test('sin fila de total: suma los lotes; filtro por bodega', () => {
  const filas = [
    fila({ f120_id: 9, f400_id_lote: 'A', f400_cant_existencia_1: 2.5, f120_id_unidad_inventario: 'KG' }),
    fila({ f120_id: 9, f400_id_lote: 'B', f400_cant_existencia_1: 1.5, f120_id_unidad_inventario: 'KG' }),
    fila({ f120_id: 9, f150_id: '00201', f400_cant_existencia_1: 7, f120_id_unidad_inventario: 'KG' }),
  ]
  assert.equal(existenciasPorItem(filas).get(9)!.existencia, 11)
  assert.equal(existenciasPorItem(filas, ['00110']).get(9)!.existencia, 4)
  assert.equal(existenciasPorItem(filas).get(9)!.unidad, 'KG')
})

test('condición de la consulta', () => {
  assert.equal(condicionInventario([3348, 9, 9, -1]), 'f120_id IN (3348,9) AND f400_cant_existencia_1 <> 0')
  assert.equal(condicionInventario([]), null)
})
