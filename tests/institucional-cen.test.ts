// Pruebas de los pedidos institucionales (lib/cen/institucional.ts): búsqueda en Siesa, agrupación de las
// líneas por pedido y la orden que se guarda. Datos sintéticos.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { agruparPedidos, armarOrdenInstitucional, clienteDelPedido, codigoCiudad, condicionAutomatica, condicionBusqueda, condicionPedido } from '../lib/cen/institucional.ts'

const DESDE = '2026-10-29'
const BASE = "f430_id_fecha >= ''20261029'' AND f430_ind_estado <> 9"

test('condición de búsqueda según lo que se escribe', () => {
  assert.equal(condicionBusqueda('pvk-16208', DESDE), `${BASE} AND f430_id_tipo_docto = ''PVK'' AND f430_consec_docto = 16208`)
  assert.equal(condicionBusqueda('PVK16208', DESDE), `${BASE} AND f430_id_tipo_docto = ''PVK'' AND f430_consec_docto = 16208`)
  assert.equal(condicionBusqueda(' 900123456 ', DESDE),
    `${BASE} AND (f200_nit_pedido_fact = ''900123456'' OR f430_num_docto_referencia = ''900123456'' OR f430_consec_docto = 900123456)`)
  // NIT largo: no se busca como número de pedido
  assert.equal(condicionBusqueda('1065562209', DESDE),
    `${BASE} AND (f200_nit_pedido_fact = ''1065562209'' OR f430_num_docto_referencia = ''1065562209'')`)
  assert.equal(condicionBusqueda("hospital  o'neil%", DESDE), `${BASE} AND f200_razon_social_pedido_fact LIKE ''%HOSPITAL ONEIL%''`)
  assert.equal(condicionBusqueda('ab', DESDE), null)
  assert.equal(condicionBusqueda("'';--", DESDE), null)
})

test('condición de un pedido puntual', () => {
  assert.equal(condicionPedido('001|PVK|16208'), "f430_id_co = ''001'' AND f430_id_tipo_docto = ''PVK'' AND f430_consec_docto = 16208")
  assert.equal(condicionPedido("001|PVK|1 OR 1=1"), null)
  assert.equal(condicionPedido('PVK-16208'), null)
})

const fila = (p: Record<string, unknown>) => ({
  f430_id_co: '001', f430_id_tipo_docto: 'PVK', f430_consec_docto: 100, f430_id_fecha: '2026-11-05T00:00:00', f430_fecha_entrega: '2026-11-07T00:00:00',
  f430_fecha_ts_creacion: '2026-11-05T09:10:11.5', f430_usuario_creacion: 'usuario.prueba', f430_ind_estado: 2,
  f200_nit_pedido_fact: '900000001', f430_id_sucursal_pedido_fact: '001', f200_razon_social_pedido_fact: 'CLIENTE PRUEBA',
  f430_num_docto_referencia: 'R1', f430_notas: '', f120_id: 10, f120_referencia: 'REF10', f120_descripcion: 'PRODUCTO 10',
  f431_id_unidad_medida: 'UND ', f431_cant1_pedida: 4, f431_precio_unitario_base: 1000, f431_vlr_bruto: 4000, f431_vlr_imp: 760, f431_vlr_neto: 4760, ...p,
})

test('agrupa las líneas por pedido, del más reciente al más antiguo', () => {
  const pedidos = agruparPedidos([
    fila({}),
    fila({ f120_id: 20, f120_descripcion: 'QUESO', f431_id_unidad_medida: 'KG  ', f431_cant1_pedida: 2.5, f431_vlr_bruto: 50000, f431_vlr_imp: 0 }),
    fila({ f430_consec_docto: 101, f430_fecha_ts_creacion: '2026-11-06T08:00:00' }),
  ])
  assert.equal(pedidos.length, 2)
  assert.equal(pedidos[0].pedido, 'PVK-101')
  const p = pedidos[1]
  assert.equal(p.id, '001|PVK|100')
  assert.equal(p.fecha, '2026-11-05')
  assert.equal(p.estado_label, 'Aprobado')
  assert.equal(p.lineas.length, 2)
  assert.equal(p.lineas[1].unidad, 'KG')
  assert.equal(p.unidades, 6.5)
  assert.equal(p.valor, 54000)
})

test('orden institucional: ítem del maestro, peso y líneas sin maestro', () => {
  const [p] = agruparPedidos([
    fila({}),
    fila({ f120_id: 20, f431_id_unidad_medida: 'KG', f431_cant1_pedida: 2.5, f431_vlr_bruto: 50000, f431_vlr_imp: 0 }),
  ])
  const conPeso = armarOrdenInstitucional(p, new Map([[10, { ean: '7700000000010', peso_kg: 0.25 }]]))
  assert.equal(conPeso.numero_orden, 'PVK-100')
  assert.equal(conPeso.fecha_entrega, '2026-11-07')
  assert.equal(conPeso.lineas[0].ean_item, '7700000000010')
  assert.equal(conPeso.lineas[0].iva, 19)
  assert.equal(conPeso.lineas[1].ean_item, 'SIESA-20') // no está en el maestro
  assert.equal(conPeso.lineas[1].iva, 0)
  assert.equal(conPeso.lineas[1].precio, 20000) // valor sin IVA ÷ cantidad
  assert.equal(conPeso.peso_kg, 3.5) // 4 × 0,25 + 2,5 kg
  // Sin peso en el maestro para un producto en unidades: peso incompleto
  assert.equal(armarOrdenInstitucional(p, new Map()).peso_kg, null)
})

test('automático: cliente por NIT y ciudad del punto de envío', () => {
  const clientes = [
    { nit: '900040299', nombre: 'ATLANTIC FS SAS', ciudades: ['08-001', '13-001'], ruta: 'DISTRYCAR', activo: true },
    { nit: '890929877', nombre: 'NEWREST', ciudades: ['44-035'], ruta: 'DISTRYCAR', activo: false },
  ]
  assert.equal(codigoCiudad('8', '1'), '08-001')
  assert.equal(codigoCiudad('', '001'), null)
  assert.equal(clienteDelPedido({ nit: '900040299', ciudad: '08-001', tipo: 'PVK' }, clientes)?.nombre, 'ATLANTIC FS SAS')
  assert.equal(clienteDelPedido({ nit: '900040299', ciudad: '11-001', tipo: 'PVK' }, clientes), null) // Atlantic Bogotá: no va
  assert.equal(clienteDelPedido({ nit: '900040299', ciudad: '13-001', tipo: 'CTV' }, clientes), null) // solo PVK
  assert.equal(clienteDelPedido({ nit: '890929877', ciudad: '44-035', tipo: 'PVK' }, clientes), null) // pausado
  assert.equal(condicionAutomatica(['900040299', '9.000-40299', 'x'], DESDE),
    "f430_id_fecha >= ''20261029'' AND f430_ind_estado <> 9 AND f430_id_tipo_docto = ''PVK'' AND f200_nit_pedido_fact IN (''900040299'')")
  assert.equal(condicionAutomatica([], DESDE), null)
})

test('agrupa la ciudad del punto de envío (o la de la sucursal)', () => {
  const base = { f430_id_co: '001', f430_id_tipo_docto: 'PVK', f430_consec_docto: 1, f430_id_fecha: '2026-11-06T00:00:00', f430_ind_estado: 2,
    f200_nit_pedido_fact: '900040299', f430_id_sucursal_pedido_fact: '002', f200_razon_social_pedido_fact: 'ATLANTIC FS SAS' }
  const [a] = agruparPedidos([{ ...base, f015_id_depto_pe: '08', f015_id_ciudad_pe: '001', f015_id_depto_fact: '11', f015_id_ciudad_fact: '001' }])
  assert.equal(a.ciudad, '08-001')
  const [b] = agruparPedidos([{ ...base, f015_id_depto_fact: '13', f015_id_ciudad_fact: '001' }])
  assert.equal(b.ciudad, '13-001')
})
