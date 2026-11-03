// Pruebas de los cálculos del módulo de órdenes EDI → pedidos de Siesa:
// totales y peso de la orden, ruta de despacho, reglas de ruta y el pedido
// que se envía a Siesa (bodega, precios, fechas y JSON del conector).
// Datos sintéticos: no se usan órdenes reales (el repositorio es público).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { totalesOrden } from '../lib/cen/totales.ts'
import { normalizarLugar, sugerirRuta, type ReglaRuta } from '../lib/cen/reglasRuta.ts'
import { validarRegla } from '../lib/cen/reglasRuta.ts'
import {
  armarDocumento, bloqueosDeLineas, elegirBodega, fechaEntregaPedido, preciosVigentes, revisarPrecios,
  type DatosDocumento, type LineaPedido,
} from '../lib/cen/documentoPedido.ts'

const OLIMPICA = '7701008009080'
const EXITO = '7701001000008'
const ARA = '7704269000018'

// ── Totales de la orden ─────────────────────────────────────────────────────

test('totales: unidades, valor y peso con el maestro de pesos', () => {
  const lineas = [
    { eanItem: 'A', cantidad: 24, precio: 4403 },
    { eanItem: 'B', cantidad: 10, precio: 8808.5 },
  ]
  const t = totalesOrden(lineas, new Map([['A', 1.2], ['B', 0.25]]))
  assert.equal(t.unidades, 34)
  assert.equal(t.valor, 24 * 4403 + 10 * 8808.5)
  assert.ok(Math.abs(t.peso! - (24 * 1.2 + 10 * 0.25)) < 1e-9)
})

test('totales: si un producto no tiene peso, el peso queda vacío (no uno incompleto)', () => {
  const t = totalesOrden([{ eanItem: 'A', cantidad: 5, precio: 100 }, { eanItem: 'X', cantidad: 1, precio: 1 }], new Map([['A', 2]]))
  assert.equal(t.peso, null)
  assert.equal(t.unidades, 6)
})

test('totales: un producto con peso 0 cuenta como conocido', () => {
  assert.equal(totalesOrden([{ eanItem: 'A', cantidad: 3, precio: 1 }], new Map([['A', 0]])).peso, 0)
})

// ── Ruta de despacho ────────────────────────────────────────────────────────

const regla = (r: Partial<ReglaRuta> & { ruta: string }): ReglaRuta => ({
  id: 0, prioridad: 100, ean_comprador: null, ciudades: [], departamentos: [],
  peso_min: null, peso_max: null, descripcion: null, activo: true, ...r,
})

test('normalizarLugar quita tildes, mayúsculas y lo que va después de la coma', () => {
  assert.equal(normalizarLugar('Bogotá, D.C.'), 'BOGOTA')
  assert.equal(normalizarLugar('  cartagena   de indias '), 'CARTAGENA DE INDIAS')
  assert.equal(normalizarLugar('Medellín'), 'MEDELLIN')
  assert.equal(normalizarLugar(null), '')
})

test('ruta: gana la primera regla (por orden) que cumple cadena y ciudad', () => {
  const reglas = [
    regla({ ruta: 'EXBOG', ean_comprador: EXITO, ciudades: ['BOGOTA'] }),
    regla({ ruta: 'BOGOTA-GENERAL', ciudades: ['BOGOTA'] }),
  ]
  assert.equal(sugerirRuta(reglas, { ean_comprador: EXITO, ciudad: 'Bogotá, D.C.', departamento: null, peso_kg: 10 })?.ruta, 'EXBOG')
  // Otra cadena en Bogotá no toma la regla del Éxito
  assert.equal(sugerirRuta(reglas, { ean_comprador: OLIMPICA, ciudad: 'Bogotá', departamento: null, peso_kg: 10 })?.ruta, 'BOGOTA-GENERAL')
})

test('ruta: la ciudad de la regla coincide con el inicio del nombre, no con una parte', () => {
  const reglas = [regla({ ruta: 'CAR', ciudades: ['CARTAGENA'] })]
  assert.equal(sugerirRuta(reglas, { ean_comprador: OLIMPICA, ciudad: 'Cartagena de Indias', departamento: null, peso_kg: 1 })?.ruta, 'CAR')
  assert.equal(sugerirRuta(reglas, { ean_comprador: OLIMPICA, ciudad: 'Cartago', departamento: null, peso_kg: 1 }), null)
})

test('ruta: también por departamento', () => {
  const reglas = [regla({ ruta: 'COSTA', departamentos: ['ATLANTICO', 'BOLIVAR'] })]
  assert.equal(sugerirRuta(reglas, { ean_comprador: OLIMPICA, ciudad: 'Soledad', departamento: 'Atlántico', peso_kg: 1 })?.ruta, 'COSTA')
})

test('ruta: rango de peso; sin peso conocido no aplica una regla con peso', () => {
  const reglas = [
    regla({ ruta: 'PESADO', ciudades: ['BOGOTA'], peso_min: 500 }),
    regla({ ruta: 'LIVIANO', ciudades: ['BOGOTA'], peso_max: 499.99 }),
    regla({ ruta: 'BOGOTA', ciudades: ['BOGOTA'] }),
  ]
  const o = (peso_kg: number | null) => ({ ean_comprador: OLIMPICA, ciudad: 'Bogotá', departamento: null, peso_kg })
  assert.equal(sugerirRuta(reglas, o(800))?.ruta, 'PESADO')
  assert.equal(sugerirRuta(reglas, o(500))?.ruta, 'PESADO')
  assert.equal(sugerirRuta(reglas, o(120))?.ruta, 'LIVIANO')
  assert.equal(sugerirRuta(reglas, o(null))?.ruta, 'BOGOTA')
})

test('ruta: sin punto homologado solo aplica una regla de cadena sin lugar (ej. ARA)', () => {
  const reglas = [
    regla({ ruta: 'GENERAL' }),                                  // sin cadena ni lugar: no aplica sin punto
    regla({ ruta: 'EXBOG', ean_comprador: EXITO, ciudades: ['BOGOTA'] }),
    regla({ ruta: 'ARA', ean_comprador: ARA }),
  ]
  assert.equal(sugerirRuta(reglas, { ean_comprador: ARA, ciudad: null, departamento: null, peso_kg: null })?.ruta, 'ARA')
  assert.equal(sugerirRuta(reglas, { ean_comprador: EXITO, ciudad: null, departamento: null, peso_kg: null }), null)
  // Con punto conocido, la regla general sí aplica
  assert.equal(sugerirRuta(reglas, { ean_comprador: OLIMPICA, ciudad: 'Cali', departamento: null, peso_kg: 1 })?.ruta, 'GENERAL')
})

test('ruta: las reglas inactivas se ignoran', () => {
  const reglas = [regla({ ruta: 'VIEJA', ciudades: ['CALI'], activo: false }), regla({ ruta: 'NUEVA', ciudades: ['CALI'] })]
  assert.equal(sugerirRuta(reglas, { ean_comprador: OLIMPICA, ciudad: 'Cali', departamento: null, peso_kg: 1 })?.ruta, 'NUEVA')
})

test('validarRegla normaliza la regla escrita en pantalla', () => {
  const r = validarRegla({ ruta: ' exbog ', ciudades: 'Bogotá, Soacha; bogota', peso_min: '1,5', peso_max: '', prioridad: '20' as never })
  assert.equal(r.ruta, 'EXBOG')
  assert.deepEqual(r.ciudades, ['BOGOTA', 'SOACHA'])
  assert.equal(r.peso_min, 1.5)
  assert.equal(r.peso_max, null)
  assert.equal(r.prioridad, 20)
  assert.equal(r.ean_comprador, null)
  assert.equal(r.activo, true)
})

test('validarRegla rechaza ruta vacía, peso negativo y mínimo mayor que máximo', () => {
  assert.throws(() => validarRegla({ ruta: '  ' }), /obligatoria/)
  assert.throws(() => validarRegla({ ruta: 'X', peso_min: -1 }), /positivo/)
  assert.throws(() => validarRegla({ ruta: 'X', peso_min: 10, peso_max: 5 }), /mínimo/)
})

// ── Pedido de Siesa ─────────────────────────────────────────────────────────

const linea = (l: Partial<LineaPedido> & { nro_linea: number }): LineaPedido => ({
  ean_item: '7700000000017', cod_comprador: null, cantidad: 1, precio: 1000, f120_id: '9', extension1: null, ...l,
})

test('bodega: Siesa > sucursal en la app > configuración del cliente > 00110', () => {
  assert.deepEqual(elegirBodega(null, null, null), { bodega: '00110', origen: 'por defecto' })
  assert.deepEqual(elegirBodega('00110', null, null), { bodega: '00110', origen: 'por defecto' })
  assert.deepEqual(elegirBodega('00210', null, null), { bodega: '00210', origen: 'configuración del cliente' })
  assert.deepEqual(elegirBodega('00210', '00310', null), { bodega: '00310', origen: 'sucursal (app)' })
  assert.deepEqual(
    elegirBodega('00210', '00310', { f201_id_lista_precio: 'STO', f201_id_bodega: ' 00410 ' }),
    { bodega: '00410', origen: 'Siesa (f201_id_bodega)' },
  )
  // Un campo de bodega vacío en Siesa no cuenta
  assert.equal(elegirBodega(null, '00310', { f201_id_bodega: '  ' }).bodega, '00310')
})

test('precios vigentes: ignora inactivados y futuros, y toma la activación más reciente', () => {
  const v = preciosVigentes([
    { f120_id: 9, f126_precio: 4000, f126_fecha_activacion: '2026-01-01T00:00:00' },
    { f120_id: 9, f126_precio: 4390, f126_fecha_activacion: '2026-06-01T00:00:00' },
    { f120_id: 9, f126_precio: 9999, f126_fecha_activacion: '2026-12-01T00:00:00' },            // futuro
    { f120_id: 16, f126_precio: 7000, f126_fecha_activacion: '2026-01-01', f126_fecha_inactivacion: '2026-10-01' }, // inactivado
    { f120_id: 10, f126_precio: 9558, f126_fecha_activacion: '2026-03-01', f126_fecha_inactivacion: '2027-01-01' },
  ], '2026-11-03')
  assert.equal(v.get('9')?.precio, 4390)
  assert.equal(v.has('16'), false)
  assert.equal(v.get('10')?.precio, 9558)
})

test('revisión de precios: alerta si difiere más de 50 centavos; sin precio en la lista queda sin verificar', () => {
  const vigente = new Map([['9', { precio: 4390 }], ['10', { precio: 9558 }]])
  const r = revisarPrecios([
    linea({ nro_linea: 1, f120_id: '9', precio: 4171 }),     // difiere
    linea({ nro_linea: 2, f120_id: '10', precio: 9557.6 }),  // dentro de la tolerancia
    linea({ nro_linea: 3, f120_id: '77', precio: 100 }),     // no está en la lista
    linea({ nro_linea: 4, f120_id: null, precio: 100 }),     // sin ítem de Siesa
  ], vigente, 'SJM')
  assert.equal(r.diferencias.length, 1)
  assert.match(r.diferencias[0], /^Línea 1 .*\$4171 ≠ lista SJM \$4390/)
  assert.equal(r.sinVerificar.length, 2)
  assert.match(r.sinVerificar[0], /^línea 3 /)
})

test('fecha de entrega: la de la orden; si ya pasó o no trae, hoy', () => {
  assert.deepEqual(fechaEntregaPedido('2026-11-06', '2026-11-03'), { fechaEntrega: '2026-11-06', dias: 3, vencida: false })
  assert.deepEqual(fechaEntregaPedido('2026-11-03', '2026-11-03'), { fechaEntrega: '2026-11-03', dias: 0, vencida: false })
  assert.deepEqual(fechaEntregaPedido('2026-10-24', '2026-11-03'), { fechaEntrega: '2026-11-03', dias: 0, vencida: true })
  assert.deepEqual(fechaEntregaPedido(null, '2026-11-03'), { fechaEntrega: '2026-11-03', dias: 0, vencida: false })
  // Cruce de mes y de año
  assert.equal(fechaEntregaPedido('2027-01-02', '2026-12-30').dias, 3)
})

test('bloqueos: sin ítem de Siesa o con precio en cero (indicador 2)', () => {
  assert.deepEqual(bloqueosDeLineas([linea({ nro_linea: 1 })], '2'), [])
  const b = bloqueosDeLineas([linea({ nro_linea: 1, f120_id: null, ean_item: '770111' }), linea({ nro_linea: 2, precio: 0 })], '2')
  assert.equal(b.length, 2)
  assert.match(b[0], /línea 1 \(770111\)/)
  assert.match(b[1], /precio mayor que 0/)
  // Con indicador 0 (precio de la lista) el precio en cero no bloquea
  assert.deepEqual(bloqueosDeLineas([linea({ nro_linea: 1, precio: 0 })], '0'), [])
})

const datos = (cambios: Partial<DatosDocumento> = {}): DatosDocumento => ({
  orden: { numero_orden: '4646914279', fecha_orden: '2026-10-22', nit: '890107487', sucursal: '182' },
  lineas: [
    linea({ nro_linea: 1, f120_id: 9, cantidad: 24, precio: 4403, cod_comprador: '1005857' }),
    linea({ nro_linea: 3, f120_id: '16', cantidad: 6.5, precio: 1344.537815, extension1: 'FB' }),
  ],
  cia: '1', co: '001', tipoDocto: 'PVS', consecutivo: '125', hoy: '2026-11-03', fechaEntrega: '2026-11-05', dias: 2,
  bodega: '00110', listaPrecio: 'STO', condPago: '30D', tipoCli: '01', indPrecio: '2', ext1Detalle: 'FN',
  ...cambios,
})

test('documento: secciones en orden y todos los valores como texto', () => {
  const doc = armarDocumento(datos())
  assert.deepEqual(Object.keys(doc), ['Inicial', 'Pedidos', 'MovtoPedidoscomercial', 'Final'])
  assert.deepEqual(doc.Inicial, [{ F_CIA: '1' }])
  assert.deepEqual(doc.Final, [{ F_CIA: '1' }])
  for (const seccion of Object.values(doc)) {
    for (const fila of seccion) for (const [k, v] of Object.entries(fila)) assert.equal(typeof v, 'string', `${k} debe ser texto`)
  }
})

test('documento: encabezado del pedido (consecutivo manual, cliente, fechas y OC)', () => {
  const [p] = armarDocumento(datos()).Pedidos
  assert.equal(p.F_CONSEC_AUTO_REG, '0')
  assert.equal(p.f430_id_tipo_docto, 'PVS')
  assert.equal(p.f430_consec_docto, '125')
  assert.equal(p.f430_id_fecha, '20261103')
  assert.equal(p.f430_fecha_entrega, '20261105')
  assert.equal(p.f430_num_dias_entrega, '2')
  assert.equal(p.f430_id_tercero_fact, '890107487')
  assert.equal(p.f430_id_sucursal_rem, '182')
  assert.equal(p.f430_id_cond_pago, '30D')
  assert.equal(p.f430_num_docto_referencia, '4646914279')
  assert.equal(p.f430_notas, 'OC EDI 4646914279 del 20261022')
  assert.equal(p.f430_id_punto_envio, '001')
})

test('documento: la OC se recorta a 15 caracteres y sin fecha de orden la nota no la menciona', () => {
  const [p] = armarDocumento(datos({ orden: { numero_orden: '1234567890123456789', fecha_orden: null, nit: null, sucursal: null } })).Pedidos
  assert.equal(p.f430_num_docto_referencia, '123456789012345')
  assert.equal(p.f430_notas, 'OC EDI 1234567890123456789')
  assert.equal(p.f430_id_tercero_fact, '')
})

test('documento: líneas por ítem de Siesa, numeradas, con bodega, extensión FN y 4 decimales', () => {
  const m = armarDocumento(datos()).MovtoPedidoscomercial
  assert.equal(m.length, 2)
  assert.deepEqual(m.map(x => x.f431_nro_registro), ['1', '2'])       // consecutivo propio, no el número de línea de la OC
  assert.deepEqual(m.map(x => x.f431_id_item), ['9', '16'])
  assert.deepEqual(m.map(x => x.f431_codigo_barras), ['', ''])         // se pide por ítem, no por código de barras
  assert.deepEqual(m.map(x => x.f431_id_ext1_detalle), ['', 'FN'])
  assert.equal(m[1].f431_cant_pedida_base, '6.5')
  assert.equal(m[1].f431_precio_unitario, '1344.5378')
  assert.equal(m[0].f431_precio_unitario, '4403')
  assert.equal(m[0].f431_notas, 'Cod. comprador 1005857')
  assert.equal(m[1].f431_notas, '')
  for (const x of m) {
    assert.equal(x.f431_id_bodega, '00110')
    assert.equal(x.f431_consec_docto, '125')
    assert.equal(x.f431_id_lista_precio, 'STO')
    assert.equal(x.f431_ind_precio, '2')
    assert.equal(x.f431_fecha_entrega, '20261105')
  }
})
