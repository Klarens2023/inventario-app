// Pruebas de los cálculos de los reportes de órdenes EDI (lib/cen/reportes.ts):
// cumplimiento, peso y cajas por línea, necesidad por producto, relación de despacho y tiempos.
// Datos sintéticos: no se usan órdenes reales (el repositorio es público).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  agruparOrdenes, cajasLinea, cumplimiento, diasDeSemana, diasEntre, lineasRelacion, necesidadPorProducto, necesidadSemanal, pesoLinea, sabadoDeSemana, semanaIso, tiemposPorCadena,
  type LineaReporte, type OrdenReporte,
} from '../lib/cen/reportes.ts'
import { codigoRelacion } from '../lib/cen/relacion.ts'

const HOY = '2026-11-06'

function orden(p: Partial<OrdenReporte> & { id: number }): OrdenReporte {
  return {
    numero_orden: `OC${p.id}`, fuente: 'carvajal', ean_comprador: '7700000000001', cadena: 'Cadena A', fecha_orden: '2026-11-01',
    fecha_entrega: '2026-11-10', fecha_entrega_max: null, fecha_despacho: '2026-11-10', ean_entrega: `77000000001${p.id}`, nit: '900000001', sucursal: '001',
    razon_social: 'PUNTO A', ciudad: 'Barranquilla', ruta: 'COSTA', estado: 'pendiente', total_unidades: 10, valor_total: 1000, peso_kg: 5,
    locales: 0, siesa_consecutivo: null, enviado_at: null, enviado_por: null, descartada_at: null, descartada_por: null, motivo_descarte: null,
    recibida_at: null, leida_at: null, ...p,
  }
}
function linea(p: Partial<LineaReporte> & { orden_id: number }): LineaReporte {
  return { nro_linea: 1, ean_item: 'P1', f120_id: 10, descripcion: 'PRODUCTO 1', cod_comprador: null, cantidad: 10, precio: 100, unidad: 'UND', peso_unitario: 0.5, und_caja: 4, ...p }
}

// ── Fechas ──────────────────────────────────────────────────────────────────

test('días entre fechas y semana ISO', () => {
  assert.equal(diasEntre('2026-11-06', '2026-11-08'), 2)
  assert.equal(diasEntre('2026-11-08', '2026-11-06'), -2)
  assert.equal(semanaIso('2026-11-06'), '2026-S45')
  assert.equal(semanaIso('2027-01-01'), '2026-S53') // el 1 de enero de 2027 cae en la última semana de 2026
})

// ── Cumplimiento ────────────────────────────────────────────────────────────

test('cumplimiento de órdenes abiertas según la fecha de entrega', () => {
  assert.equal(cumplimiento(orden({ id: 1, fecha_entrega: '2026-11-05' }), HOY), 'vencida')
  assert.equal(cumplimiento(orden({ id: 2, fecha_entrega: '2026-11-06' }), HOY), 'por_vencer')
  assert.equal(cumplimiento(orden({ id: 3, fecha_entrega: '2026-11-07' }), HOY), 'por_vencer')
  assert.equal(cumplimiento(orden({ id: 4, fecha_entrega: '2026-11-08' }), HOY), 'a_tiempo')
  assert.equal(cumplimiento(orden({ id: 5, estado: 'sin_punto', fecha_entrega: '2026-11-01' }), HOY), 'vencida')
})

test('cumplimiento de órdenes con pedido y descartadas', () => {
  assert.equal(cumplimiento(orden({ id: 1, estado: 'enviado', fecha_entrega: '2026-11-05', enviado_at: '2026-11-05T15:00:00' }), HOY), 'cumplida_a_tiempo')
  assert.equal(cumplimiento(orden({ id: 2, estado: 'enviado', fecha_entrega: '2026-11-05', enviado_at: '2026-11-06T08:00:00' }), HOY), 'cumplida_tarde')
  assert.equal(cumplimiento(orden({ id: 3, estado: 'descartada', fecha_entrega: '2026-11-01' }), HOY), 'descartada')
  // sin fecha de entrega mínima se usa la máxima
  assert.equal(cumplimiento(orden({ id: 4, fecha_entrega: null, fecha_entrega_max: '2026-11-02' }), HOY), 'vencida')
})

// ── Líneas ──────────────────────────────────────────────────────────────────

test('peso y cajas de una línea', () => {
  assert.equal(pesoLinea({ cantidad: 10, unidad: 'UND', peso_unitario: 0.5 }), 5)
  assert.equal(pesoLinea({ cantidad: 25, unidad: 'KG', peso_unitario: null }), 25) // pedida en kilos: ya es el peso
  assert.equal(pesoLinea({ cantidad: 10, unidad: 'UND', peso_unitario: null }), null)
  assert.equal(cajasLinea({ cantidad: 10, unidad: 'UND', und_caja: 4 }), 2.5)
  assert.equal(cajasLinea({ cantidad: 10, unidad: 'UND', und_caja: null }), null)
})

// ── Reportes ────────────────────────────────────────────────────────────────

test('necesidad por producto: suma por día de entrega y deja fuera las descartadas', () => {
  const ordenes = [orden({ id: 1, fecha_entrega: '2026-11-10' }), orden({ id: 2, fecha_entrega: '2026-11-11' }), orden({ id: 3, estado: 'descartada' })]
  const lineas = [
    linea({ orden_id: 1, cantidad: 10 }), linea({ orden_id: 2, cantidad: 4 }), linea({ orden_id: 3, cantidad: 100 }),
    linea({ orden_id: 2, ean_item: 'P2', descripcion: 'PRODUCTO 2', cantidad: 3, peso_unitario: null }),
  ]
  const n = necesidadPorProducto(ordenes, lineas)
  assert.deepEqual(n.dias, ['2026-11-10', '2026-11-11'])
  const p1 = n.filas.find(f => f.ean === 'P1')!
  assert.equal(p1.total.unidades, 14)
  assert.equal(p1.total.peso, 7)
  assert.equal(p1.total.ordenes, 2)
  assert.deepEqual(p1.porDia['2026-11-11'], { unidades: 4, peso: 2 })
  const p2 = n.filas.find(f => f.ean === 'P2')!
  assert.equal(p2.total.pesoCompleto, false) // sin peso en el maestro
  assert.equal(n.filas[0].ean, 'P1') // más kilos primero
})

test('relación de despacho: código RUTA-MMSS por semana de despacho, peso, cajas y sin descartadas', () => {
  // Se entrega el lunes 9 (semana 46) pero sale el viernes 6 (semana 45): la relación es la del despacho
  const ordenes = [orden({ id: 1, ruta: 'COSTA', fecha_entrega: '2026-11-09', fecha_despacho: '2026-11-06', siesa_consecutivo: 'PVS-7' }), orden({ id: 2, estado: 'descartada' }), orden({ id: 3, ruta: null })]
  const filas = lineasRelacion(ordenes, [linea({ orden_id: 1 }), linea({ orden_id: 2 }), linea({ orden_id: 3 })], codigoRelacion)
  assert.equal(filas.length, 2)
  const f = filas.find(x => x.numero_orden === 'OC1')!
  assert.equal(f.relacion, 'COSTA-1145')
  assert.equal(f.peso, 5)
  assert.equal(f.cajas, 2.5)
  assert.equal(f.valor, 1000)
  assert.equal(f.pedido, 'PVS-7')
  assert.equal(filas.find(x => x.numero_orden === 'OC3')!.relacion, 'Sin ruta')
})

test('agrupar órdenes por cadena: totales, puntos distintos y peso incompleto', () => {
  const g = agruparOrdenes([
    orden({ id: 1, cadena: 'A', ean_entrega: 'X' }), orden({ id: 2, cadena: 'A', ean_entrega: 'X', peso_kg: null }), orden({ id: 3, cadena: 'B' }),
  ], o => o.cadena)
  const a = g.get('A')!
  assert.equal(a.ordenes, 2)
  assert.equal(a.puntos, 1)
  assert.equal(a.valor, 2000)
  assert.equal(a.pesoCompleto, false)
  assert.equal(g.get('B')!.ordenes, 1)
})

test('tiempos por cadena: anticipación, demora de lectura y envíos a tiempo', () => {
  const t = tiemposPorCadena([
    orden({ id: 1, fecha_orden: '2026-11-01', fecha_entrega: '2026-11-05', recibida_at: '2026-11-01T10:00:00', leida_at: '2026-11-01T12:00:00',
      estado: 'enviado', enviado_at: '2026-11-03T12:00:00' }),
    orden({ id: 2, fecha_orden: '2026-11-01', fecha_entrega: '2026-11-03', recibida_at: '2026-11-01T10:00:00', leida_at: '2026-11-02T10:00:00' }),
  ], HOY)[0]
  assert.equal(t.ordenes, 2)
  assert.equal(t.anticipacionProm, 3) // (4 + 2) / 2 días
  assert.equal(t.anticipacionMax, 4)
  assert.equal(t.lecturaHorasProm, 13) // (2 + 24) / 2 horas
  assert.equal(t.lecturaHorasMax, 24)
  assert.equal(t.envioDiasProm, 2)
  assert.equal(t.enviadas, 1)
  assert.equal(t.aTiempo, 1)
})

// ── Necesidad semanal ───────────────────────────────────────────────────────

test('semana de necesidad: sábado a viernes', () => {
  assert.equal(sabadoDeSemana('2026-11-07'), '2026-11-07') // sábado
  assert.equal(sabadoDeSemana('2026-11-08'), '2026-11-07') // domingo
  assert.equal(sabadoDeSemana('2026-11-13'), '2026-11-07') // viernes
  assert.equal(sabadoDeSemana('2026-11-14'), '2026-11-14') // el sábado siguiente empieza otra
  assert.deepEqual(diasDeSemana('2026-11-07'), ['2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'])
})

test('necesidad semanal: por fecha de llegada, por ítem, con inventario y 20 % de margen', () => {
  const dias = diasDeSemana('2026-11-07')
  const ordenes = [
    orden({ id: 1, fecha_orden: '2026-11-07' }),
    orden({ id: 2, fecha_orden: '2026-11-13', fuente: 'institucional' }),
    orden({ id: 3, fecha_orden: '2026-11-14' }), // semana siguiente: no entra
    orden({ id: 4, fecha_orden: '2026-11-09', estado: 'descartada' }), // descartada: no entra
  ]
  const lineas = [
    linea({ orden_id: 1, cantidad: 10 }), // 10 und · 5 kg
    linea({ orden_id: 2, ean_item: 'SIESA-10', f120_id: null, cantidad: 4, peso_unitario: null }), // mismo ítem 10, sin peso
    linea({ orden_id: 3, cantidad: 100 }),
    linea({ orden_id: 4, cantidad: 100 }),
    linea({ orden_id: 1, ean_item: 'P2', f120_id: 20, descripcion: 'QUESO', cantidad: 7.5, unidad: 'KG', peso_unitario: null }),
  ]
  const filas = necesidadSemanal(ordenes, lineas, dias, new Map([[10, { existencia: 3, unidad: 'UND' }], [20, { existencia: 10, unidad: 'KG' }]]))
  const p1 = filas.find(f => f.f120_id === 10)!
  assert.equal(p1.unidades, 14)
  assert.equal(p1.ordenes, 2)
  assert.equal(p1.kgCompleto, false)
  assert.deepEqual(Object.keys(p1.porDia).sort(), ['2026-11-07', '2026-11-13'])
  assert.equal(p1.medida, 'UND')
  assert.equal(p1.diferencia, 11) // 14 − 3
  assert.equal(p1.sugerido, 14) // 11 × 1,2 = 13,2 → 14
  const queso = filas.find(f => f.f120_id === 20)!
  assert.equal(queso.medida, 'KG')
  assert.equal(queso.unidades, 0)
  assert.equal(queso.kg, 7.5)
  assert.equal(queso.diferencia, 0) // hay más inventario que pedido
  assert.equal(necesidadSemanal(ordenes, lineas, dias)[0].inventario, null) // sin inventario: no calcula diferencia
})

test('necesidad semanal: se compara en la unidad de inventario de Siesa', () => {
  const dias = diasDeSemana('2026-11-07')
  const ordenes = [orden({ id: 1, fecha_orden: '2026-11-08' })]
  const lineas = [linea({ orden_id: 1, cantidad: 10, peso_unitario: 2.5 })] // 10 und = 25 kg
  // El ítem se pidió en unidades pero Siesa lo inventaría en kilos: se comparan los 25 kg
  const [f] = necesidadSemanal(ordenes, lineas, dias, new Map([[10, { existencia: 5, unidad: 'KG' }]]))
  assert.equal(f.medida, 'KG')
  assert.equal(f.diferencia, 20)
  assert.equal(f.sugerido, 24)
  // Sin existencia en Siesa cuenta como 0
  const [g] = necesidadSemanal(ordenes, lineas, dias, new Map())
  assert.equal(g.inventario, 0)
  assert.equal(g.diferencia, 10)
})
