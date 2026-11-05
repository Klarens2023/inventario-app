// Listado de sucursales para asociar un punto de entrega y aviso por correo de
// "sucursal no creada" (lib/cen/sucursalesPunto.ts). Datos sintéticos.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { combinarSucursales, correoSucursalNoCreada, enlaceGmail, listaCorreos } from '../lib/cen/sucursalesPunto.ts'

// Filas con la forma de API_v2_Clientes de Siesa
const siesa = (sucursal: string, nombre: string, activa = 1) => ({ f200_nit: '890900608', f201_id_sucursal: sucursal, f201_descripcion_sucursal: nombre, f201_ind_estado_activo: activa })

test('el listado sale de Siesa; la dirección y la ciudad, de la base importada', () => {
  const l = combinarSucursales(
    [siesa('005', 'ALMACENES EXITO  CEDI AV 68'), siesa('001', 'ALMACENES EXITO VALLEDUPAR'), siesa('052', 'ALMACENES EXITO NUEVA')],
    [
      { sucursal: '001', direccion: 'CRA 7 # 20-30', ciudad: 'VALLEDUPAR', departamento: 'CESAR' },
      { sucursal: '005', direccion: 'AV 68 # 1-1', ciudad: 'BOGOTA', departamento: 'CUNDINAMARCA' },
      { sucursal: '099', direccion: 'NO ESTÁ EN SIESA', ciudad: 'X', departamento: null },   // solo en la base: no aparece
    ],
    new Map([['005', ['7701001000800']]]),
  )
  assert.deepEqual(l.map(s => s.sucursal), ['001', '005', '052'])
  assert.equal(l[0].ciudad, 'VALLEDUPAR')
  assert.equal(l[1].razon_social, 'ALMACENES EXITO CEDI AV 68')   // espacios dobles de Siesa normalizados
  assert.deepEqual(l[1].eans, ['7701001000800'])
  // Creada en Siesa pero sin dirección en la base: aparece igual, con alerta
  assert.equal(l[2].sinDireccion, true)
  assert.equal(l[2].direccion, null)
  assert.equal(l[0].sinDireccion, false)
})

test('las inactivas van al final y se marcan; no se repiten sucursales', () => {
  const l = combinarSucursales([siesa('002', 'CERRADA', 0), siesa('010', 'ABIERTA'), siesa('010', 'ABIERTA')], [], new Map())
  assert.deepEqual(l.map(s => [s.sucursal, s.activa]), [['010', true], ['002', false]])
})

test('destinatarios: solo correos válidos y sin repetir', () => {
  assert.deepEqual(listaCorreos('sistemas@klarens.com.co, Soporte@Klarens.com.co; sistemas@klarens.com.co  no-es-correo'), ['sistemas@klarens.com.co', 'soporte@klarens.com.co'])
  assert.deepEqual(listaCorreos(undefined), [])
})

test('el correo solo lleva los datos del cliente; el detalle va en el PDF adjunto', () => {
  const c = correoSucursalNoCreada({ cadena: 'Éxito', nit: '890900608', eanEntrega: '7701001000800', numeroOrden: '0858694566' })
  assert.equal(c.asunto, 'Crear sucursal en Siesa – Éxito (NIT 890900608) – punto EAN 7701001000800')
  assert.match(c.cuerpo, /NIT: 890900608/)
  assert.match(c.cuerpo, /EAN del punto de entrega: 7701001000800/)
  assert.match(c.cuerpo, /Se adjunta la orden de compra 0858694566/)
  assert.doesNotMatch(c.cuerpo, /unidades|valor|\$/i)
})

test('enlace de Gmail con destinatarios, asunto y contenido codificados', () => {
  const url = new URL(enlaceGmail({ para: ['a@klarens.com.co', 'b@klarens.com.co'], cc: ['c@klarens.com.co'], asunto: 'Crear sucursal – Éxito & Cía', cuerpo: 'Línea 1\nLínea 2' }))
  assert.equal(url.origin + url.pathname, 'https://mail.google.com/mail/')
  assert.equal(url.searchParams.get('view'), 'cm')
  assert.equal(url.searchParams.get('to'), 'a@klarens.com.co,b@klarens.com.co')
  assert.equal(url.searchParams.get('cc'), 'c@klarens.com.co')
  assert.equal(url.searchParams.get('su'), 'Crear sucursal – Éxito & Cía')
  assert.equal(url.searchParams.get('body'), 'Línea 1\nLínea 2')
  assert.equal(new URL(enlaceGmail({ para: ['a@klarens.com.co'], cc: [], asunto: 'x', cuerpo: 'y' })).searchParams.has('cc'), false)
})
