// Matriz de autorización de la API: para cada ruta, qué roles DEBEN poder usarla.
// Cualquier otro rol (y sin sesión) debe recibir 401 o 403. Las rutas que escriben
// se llaman con cuerpos inválidos o ids inexistentes, para comprobar que el control
// de acceso ocurre ANTES de validar y que nada se escribe.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { ROLES, type Rol, ids, sql, crearUsuarios, borrarUsuarios, loginWeb, loginMovil, pedir } from './entorno.ts'

type Caso = { metodo: string; ruta: string; cuerpo?: unknown; permitidos: Rol[]; soloRechazo?: boolean }

const TODOS = Object.keys(ROLES) as Rol[]

// Permisos esperados según el diseño (lib/permissions.ts y los chequeos de cada ruta)
const CASOS: Caso[] = [
  // Administración
  { metodo: 'GET', ruta: '/api/usuarios', permitidos: ['admin', 'lider'] },
  { metodo: 'GET', ruta: '/api/areas', permitidos: ['admin', 'lider'] },
  { metodo: 'GET', ruta: '/api/auditoria', permitidos: ['admin'] },
  { metodo: 'POST', ruta: '/api/usuarios', cuerpo: {}, permitidos: ['admin', 'lider'] },
  { metodo: 'POST', ruta: '/api/areas', cuerpo: {}, permitidos: ['admin'] },
  { metodo: 'DELETE', ruta: '/api/reiniciar', cuerpo: {}, permitidos: ['admin'] },
  // Inventario
  { metodo: 'GET', ruta: '/api/inventario', permitidos: ['admin', 'inventario'] },
  { metodo: 'GET', ruta: '/api/inventario/tipos?fecha=2000-01-01', permitidos: ['admin', 'inventario'] },
  { metodo: 'GET', ruta: '/api/acumulados', permitidos: ['admin', 'inventario'] },
  { metodo: 'PUT', ruta: '/api/conteo', cuerpo: {}, permitidos: ['admin', 'inventario'] },
  { metodo: 'POST', ruta: '/api/acumulaciones', cuerpo: {}, permitidos: ['admin', 'inventario'] },
  // Órdenes EDI
  { metodo: 'GET', ruta: '/api/logistica/ordenes-cen', permitidos: ['admin', 'inventario'] },
  { metodo: 'GET', ruta: '/api/logistica/ordenes-cen/reglas', permitidos: ['admin', 'inventario'] },
  { metodo: 'GET', ruta: '/api/logistica/ordenes-cen/puntos', permitidos: ['admin', 'inventario'] },
  { metodo: 'GET', ruta: '/api/logistica/ordenes-cen/productos', permitidos: ['admin', 'inventario'] },
  { metodo: 'GET', ruta: '/api/logistica/ordenes-cen/clientes', permitidos: ['admin', 'inventario'] },
  { metodo: 'PUT', ruta: '/api/logistica/ordenes-cen/clientes', cuerpo: {}, permitidos: ['admin', 'inventario'] },
  { metodo: 'POST', ruta: '/api/logistica/ordenes-cen/reglas', cuerpo: {}, permitidos: ['admin', 'inventario'] },
  { metodo: 'POST', ruta: '/api/logistica/ordenes-cen/sincronizar', permitidos: ['admin', 'inventario'], soloRechazo: true },
  { metodo: 'POST', ruta: '/api/logistica/ordenes-cen/999999999/pedido', cuerpo: {}, permitidos: ['admin', 'inventario'], soloRechazo: true },
  // Sistemas
  { metodo: 'GET', ruta: '/api/sistemas/equipos', permitidos: ['admin', 'lider', 'tic'] },
  { metodo: 'GET', ruta: '/api/sistemas/mantenimientos', permitidos: ['admin', 'lider', 'tic'] },
  { metodo: 'POST', ruta: '/api/sistemas/equipos', cuerpo: {}, permitidos: ['admin', 'lider', 'tic'] },
  { metodo: 'DELETE', ruta: '/api/sistemas/equipos/NO-EXISTE-IT', permitidos: ['admin'] },
  { metodo: 'GET', ruta: '/api/sistemas/movimientos', permitidos: ['admin', 'tic'] },
  { metodo: 'POST', ruta: '/api/sistemas/movimientos', cuerpo: {}, permitidos: ['admin', 'tic'] },
  { metodo: 'GET', ruta: '/api/sistemas/repuestos', permitidos: ['admin', 'tic'] },
  { metodo: 'POST', ruta: '/api/sistemas/repuestos', cuerpo: {}, permitidos: ['admin', 'tic'] },
  { metodo: 'GET', ruta: '/api/sistemas/repuestos/movimientos', permitidos: ['admin', 'tic'] },
  { metodo: 'GET', ruta: '/api/sistemas/repuestos/asignaciones', permitidos: ['admin', 'tic'] },
  // Puntos de venta y pagos QR
  { metodo: 'GET', ruta: '/api/pvn/puntos-venta', permitidos: TODOS },
  { metodo: 'GET', ruta: '/api/pvn/productos', permitidos: TODOS },
  { metodo: 'GET', ruta: '/api/pvn/registros', permitidos: ['admin', 'pagos', 'pvn'] },
  { metodo: 'GET', ruta: '/api/pvn/analisis', permitidos: ['admin', 'pagos'] },
  { metodo: 'POST', ruta: '/api/pvn/registros', cuerpo: { turno: '' }, permitidos: ['admin', 'lider', 'pvn'] },
  { metodo: 'PUT', ruta: '/api/pvn/puntos-venta/999999999', cuerpo: {}, permitidos: ['admin', 'pagos'] },
  { metodo: 'GET', ruta: '/api/qr/pagos', permitidos: ['admin', 'pagos', 'pvn', 'pvv'] },
  { metodo: 'DELETE', ruta: '/api/qr/pagos/999999999', permitidos: ['admin', 'pvn', 'pvv'] },
  { metodo: 'GET', ruta: '/api/qr/turno', permitidos: ['pvn', 'pvv'] },
  { metodo: 'POST', ruta: '/api/qr/turno', cuerpo: { accion: 'nada' }, permitidos: ['pvn', 'pvv'] },
  { metodo: 'GET', ruta: '/api/qr/turno/activos', permitidos: ['admin', 'pagos'] },
  { metodo: 'POST', ruta: '/api/qr/turno/activos', cuerpo: {}, permitidos: ['admin'] },
  { metodo: 'GET', ruta: '/api/qr/turno/cierres', permitidos: ['admin', 'pagos'] },
]

const sesiones = {} as Record<Rol, string>
const rechazado = (s: number) => s === 401 || s === 403

before(async () => {
  await crearUsuarios()
  for (const rol of TODOS) sesiones[rol] = await loginWeb(rol)
})
after(async () => { await borrarUsuarios() })

test('sin sesión: todas las rutas responden 401', async () => {
  for (const c of CASOS) {
    const r = await pedir(null, c.metodo, c.ruta, c.cuerpo)
    assert.equal(r.status, 401, `${c.metodo} ${c.ruta} sin sesión respondió ${r.status}`)
  }
})

for (const rol of TODOS) {
  test(`rol ${rol}: puede solo lo que le corresponde`, async () => {
    const fallas: string[] = []
    for (const c of CASOS) {
      const debe = c.permitidos.includes(rol)
      if (debe && c.soloRechazo) continue // no se ejecuta la acción real (SFTP, Siesa)
      const r = await pedir(sesiones[rol], c.metodo, c.ruta, c.cuerpo)
      if (debe && rechazado(r.status)) fallas.push(`DEBÍA poder: ${c.metodo} ${c.ruta} → ${r.status}`)
      if (!debe && !rechazado(r.status)) fallas.push(`NO debía poder: ${c.metodo} ${c.ruta} → ${r.status}`)
    }
    assert.deepEqual(fallas, [])
  })
}

test('token móvil: sirve en rutas de la app y no en las de solo sesión web', async () => {
  const pvn = 'Bearer ' + await loginMovil('pvn')
  assert.equal((await pedir(pvn, 'GET', '/api/qr/turno')).status, 200)
  assert.equal((await pedir(pvn, 'GET', '/api/pvn/productos')).status, 200)
  assert.ok(rechazado((await pedir(pvn, 'GET', '/api/usuarios')).status))
  const malo = 'Bearer eyJhbGciOiJub25lIn0.eyJpZCI6IjEiLCJyb2wiOiJhZG1pbiJ9.'
  assert.equal((await pedir(malo, 'GET', '/api/qr/pagos')).status, 401, 'token sin firma (alg=none) debe rechazarse')
})

test('usuario desactivado: la sesión abierta y el token dejan de servir de inmediato', async () => {
  const web = sesiones.pagos
  const movil = 'Bearer ' + await loginMovil('pagos')
  await sql`UPDATE usuarios SET activo = false WHERE id = ${ids.pagos!}`
  try {
    assert.ok(rechazado((await pedir(web, 'GET', '/api/qr/pagos')).status), 'sesión web de usuario inactivo')
    assert.equal((await pedir(movil, 'GET', '/api/qr/pagos')).status, 401, 'token móvil de usuario inactivo')
  } finally {
    await sql`UPDATE usuarios SET activo = true WHERE id = ${ids.pagos!}`
  }
})

test('cambio de contraseña pendiente: solo /api/cambiar-password responde', async () => {
  await sql`UPDATE usuarios SET debe_cambiar_password = true WHERE id = ${ids.inventario!}`
  try {
    assert.ok(rechazado((await pedir(sesiones.inventario, 'GET', '/api/inventario')).status))
    // Con cambio pendiente no pide la actual; con 7 caracteres debe rechazar por longitud (400), no por permiso
    assert.equal((await pedir(sesiones.inventario, 'PUT', '/api/cambiar-password', { nueva_password: 'corta12' })).status, 400)
  } finally {
    await sql`UPDATE usuarios SET debe_cambiar_password = false WHERE id = ${ids.inventario!}`
  }
})

test('IDOR: un pvn no ve ni toca turnos, pagos ni fotos de otro pvn', async () => {
  const [pv] = await sql`SELECT id, nombre FROM pvn_puntos_venta WHERE tipo = 'nacional' AND activo ORDER BY id LIMIT 1`
  const [t] = await sql`
    INSERT INTO pvn_turnos (usuario_id, usuario_nombre, punto_venta_id, punto_venta_nombre, fecha, activo)
    VALUES (${ids.otroPvn!}, 'Prueba otro pvn', ${pv.id}, ${pv.nombre}, CURRENT_DATE - 30, false) RETURNING id`
  const fileId = 'ItFotoAjena' + Date.now()
  const [p] = await sql`
    INSERT INTO pvn_pagos_qr (usuario_id, usuario_nombre, punto_venta_id, punto_venta_nombre, turno_id, fecha, valor, foto_url)
    VALUES (${ids.otroPvn!}, 'Prueba otro pvn', ${pv.id}, ${pv.nombre}, ${t.id}, CURRENT_DATE - 30, 1000,
            ${'https://drive.google.com/uc?export=view&id=' + fileId}) RETURNING id`
  const yo = sesiones.pvn
  const lista = await pedir(yo, 'GET', `/api/qr/pagos?turno_id=${t.id}`)
  assert.deepEqual(lista.datos, [], 'no debe listar pagos del turno de otro')
  assert.equal((await pedir(yo, 'PUT', `/api/qr/pagos/${p.id}`, { valor: 5 })).status, 404, 'no debe editar el pago de otro')
  assert.equal((await pedir(yo, 'DELETE', `/api/qr/pagos/${p.id}`)).status, 404, 'no debe borrar el pago de otro')
  assert.equal((await pedir(yo, 'GET', `/api/qr/foto?id=${fileId}`)).status, 404, 'no debe ver la foto de otro')
  const [sigue] = await sql`SELECT valor::float AS valor FROM pvn_pagos_qr WHERE id = ${p.id}`
  assert.equal(sigue.valor, 1000, 'el pago ajeno no debe haber cambiado')
})

test('líder: no puede modificar ni restablecer a otro líder', async () => {
  const [otro] = await sql`
    INSERT INTO usuarios (username, password_hash, nombre, rol, area, activo)
    VALUES ('it_otro_lider', 'x', 'Prueba otro líder', 'lider', 'sistemas', true) RETURNING id`
  const r = await pedir(sesiones.lider, 'PUT', `/api/usuarios/${otro.id}`, { resetPassword: true })
  assert.equal(r.status, 403)
  const r2 = await pedir(sesiones.lider, 'POST', '/api/usuarios', { username: 'it_no_crear', nombre: 'x', rol: 'lider' })
  assert.equal(r2.status, 403, 'un líder no crea líderes')
})

test('app móvil: todas las rutas que usa (pvn-pvv-mobile/src/api) aceptan el token', async () => {
  const pvn = 'Bearer ' + await loginMovil('pvn')
  const pvv = 'Bearer ' + await loginMovil('pvv')
  const tic = 'Bearer ' + await loginMovil('tic')
  // Solo lecturas o cuerpos inválidos: ninguna crea datos
  const casos: [string, string, string, unknown?][] = [
    [pvn, 'GET', '/api/pvn/productos'],
    [pvn, 'GET', '/api/pvn/puntos-venta?tipo=principal'],
    [pvn, 'POST', '/api/pvn/registros', { turno: '' }],
    [pvn, 'GET', '/api/qr/turno?pendiente=true'],
    [pvv, 'GET', '/api/qr/turno?historial=true'],
    [pvv, 'POST', '/api/qr/turno', { accion: 'nada' }],
    [pvv, 'GET', '/api/qr/pagos'],
    [pvv, 'PUT', '/api/qr/pagos/999999999', { valor: 1 }],
    [pvv, 'DELETE', '/api/qr/pagos/999999999'],
    [tic, 'GET', '/api/sistemas/movimientos/TIC-NO-EXISTE'],
    [pvn, 'PUT', '/api/cambiar-password', { nueva_password: 'corta' }],
  ]
  const fallas: string[] = []
  for (const [cred, metodo, ruta, cuerpo] of casos) {
    const r = await pedir(cred, metodo, ruta, cuerpo)
    if (rechazado(r.status)) fallas.push(`${metodo} ${ruta} con token → ${r.status}`)
  }
  assert.deepEqual(fallas, [])
})
