// Pruebas del correo de aviso a facturación (lib/cen/correoFacturacion.ts). Datos sintéticos.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { armarCorreoFacturacion, asuntoAviso, porRelacion, totalesPorCliente, totalesPorItem, type LineaAviso, type PedidoAviso } from '../lib/cen/correoFacturacion.ts'

const base: PedidoAviso = {
  id: 1, pedido: 'PVS-10', oc: '4504006920', institucional: false, cadena: 'Ara', razon_social: 'CLIENTE PRUEBA SAS',
  nit: '900000001', sucursal: '010', ciudad: 'Galapa', ruta: 'ARA', relacion: 'ARA-1146', fecha_entrega: '2026-11-13',
  unidades: 100, peso_kg: 20, valor: 1_000_000, retenido: null, creado_por: 'Prueba',
}

test('agrupa por relación y arma el asunto', () => {
  const ps = [base, { ...base, id: 2, pedido: 'PVK-5', oc: null, institucional: true }, { ...base, id: 3, relacion: 'ARA-1145' }]
  assert.deepEqual(porRelacion(ps).map(([r, xs]) => [r, xs.length]), [['ARA-1145', 1], ['ARA-1146', 2]])
  assert.equal(asuntoAviso(ps), 'Pedidos a facturar · Ruta ARA · 3 pedidos')
  assert.equal(asuntoAviso([base]), 'Pedidos a facturar · Ruta ARA · Relación ARA-1146 · 1 pedido')
  assert.equal(asuntoAviso([base, { ...base, id: 4, ruta: 'DISTRYCAR', relacion: 'DISTRYCAR-1146' }]), 'Pedidos a facturar · Rutas ARA, DISTRYCAR · 2 pedidos')
})

test('marca institucionales, retenidos y suma los totales', () => {
  const ps = [base, { ...base, id: 2, pedido: 'PVK-5', oc: null, institucional: true, valor: 500_000, retenido: 'Siesa dejó el pedido retenido por: cupo.' }]
  const c = armarCorreoFacturacion(ps, { avisadoPor: 'Prueba', urlApp: 'https://app.test' })
  assert.match(c.html, /INSTITUCIONAL/)
  assert.match(c.html, /1 pedido quedó retenido/)
  assert.match(c.html, /de los cuales 1 es institucional/)
  assert.match(c.html, /\$ 1\.500\.000/)
  assert.match(c.html, /https:\/\/app\.test\/logistica\/ordenes-cen/)
  assert.match(c.texto, /PVK-5 \(INSTITUCIONAL\)/)
})

test('escapa los datos en el HTML', () => {
  const c = armarCorreoFacturacion([{ ...base, razon_social: '<img src=x onerror=alert(1)>' }], { avisadoPor: 'Prueba' })
  assert.ok(!c.html.includes('<img'))
  assert.match(c.html, /&lt;img/)
})

test('totales por ítem y por cliente (opcionales en el correo)', () => {
  const ps = [base, { ...base, id: 2, pedido: 'PVK-5', oc: null, institucional: true, razon_social: 'COLEGIO', nit: '800000002' }]
  const lineas: LineaAviso[] = [
    { orden_id: 1, item: 10, descripcion: 'LECHE', unidad: 'UND', cantidad: 10, kg: 9, valor: 1000 },
    { orden_id: 2, item: 10, descripcion: 'LECHE', unidad: 'UND', cantidad: 5, kg: null, valor: 500 },
    { orden_id: 2, item: 20, descripcion: 'QUESO', unidad: 'KG', cantidad: 2.5, kg: 2.5, valor: 300 },
  ]
  const items = totalesPorItem(lineas)
  assert.deepEqual(items.map(i => [i.item, i.unidades, i.kg, i.kgCompleto, i.valor]), [[10, 15, 9, false, 1500], [20, 0, 2.5, true, 300]])
  const clientes = totalesPorCliente(ps, lineas)
  assert.deepEqual(clientes.map(c => [c.cliente, c.pedidos, c.valor, c.items.length]), [['CLIENTE PRUEBA SAS', 1, 1000, 1], ['COLEGIO', 1, 800, 2]])
  const sin = armarCorreoFacturacion(ps, { avisadoPor: 'Prueba' })
  assert.ok(!sin.html.includes('Totales por ítem'))
  const con = armarCorreoFacturacion(ps, { avisadoPor: 'Prueba', lineas })
  assert.match(con.html, /Totales por ítem · ARA-1146/)
  assert.match(con.html, /Totales por cliente/)
  assert.match(con.html, /Kilos incompletos/)
  assert.match(con.texto, /Totales por ítem:/)
})
