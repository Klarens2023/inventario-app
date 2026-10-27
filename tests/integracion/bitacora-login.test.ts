// Registro de inicios de sesión en la bitácora (lib/audit.ts → registrarInicioSesion).
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { BASE, sql, ids, crearUsuarios, borrarUsuarios, loginWeb, loginMovil } from './entorno.ts'

/** Eventos de login de la bitácora para un usuario de prueba, del más viejo al más nuevo. */
async function eventos(username: string) {
  return sql`
    SELECT accion, descripcion, datos FROM audit_logs
    WHERE usuario_nombre = ${username} AND accion LIKE 'LOGIN_%'
    ORDER BY id`
}

/** Intento de login móvil con contraseña dada. */
async function intentarMovil(username: string, password: string) {
  return fetch(`${BASE}/api/auth/mobile/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'prueba-integracion' },
    body: JSON.stringify({ username, password }),
  })
}

before(async () => {
  await crearUsuarios()
  await sql`DELETE FROM audit_logs WHERE usuario_nombre LIKE 'it\\_%' AND accion LIKE 'LOGIN_%'`
})
after(async () => {
  await sql`DELETE FROM audit_logs WHERE usuario_nombre LIKE 'it\\_%' AND accion LIKE 'LOGIN_%'`
  await borrarUsuarios()
})

test('inicio de sesión web y móvil exitoso queda en la bitácora con canal e IP', async () => {
  await loginWeb('admin')
  await loginMovil('pvn')
  const [web] = await eventos('it_admin')
  assert.equal(web.accion, 'LOGIN_EXITOSO')
  assert.equal(web.datos.canal, 'web')
  assert.ok(web.datos.ip, 'debe guardar la IP')
  const [movil] = await eventos('it_pvn')
  assert.equal(movil.accion, 'LOGIN_EXITOSO')
  assert.equal(movil.datos.canal, 'movil')
})

test('contraseña errada: 4 fallidos y el 5.º bloquea la cuenta; durante el bloqueo no se registra más', async () => {
  for (let i = 0; i < 5; i++) assert.equal((await intentarMovil('it_sinModulos', 'incorrecta')).status, 401)
  const bloqueado = await intentarMovil('it_sinModulos', 'incorrecta')
  assert.equal(bloqueado.status, 429, 'el 6.º intento debe responder cuenta bloqueada')
  const ev = await eventos('it_sinModulos')
  assert.deepEqual(ev.map(e => e.accion), ['LOGIN_FALLIDO', 'LOGIN_FALLIDO', 'LOGIN_FALLIDO', 'LOGIN_FALLIDO', 'LOGIN_BLOQUEADO'])
  assert.equal(ev[0].datos.navegador, 'prueba-integracion')
  assert.match(ev[0].descripcion, /contraseña incorrecta/)
})

test('un usuario inexistente no deja nada en la bitácora (ni lo que se escribió)', async () => {
  const escrito = 'it_no_existe_' + Date.now()
  await intentarMovil(escrito, 'x')
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM audit_logs WHERE usuario_nombre = ${escrito} OR descripcion LIKE ${'%' + escrito + '%'}`
  assert.equal(n, 0)
  assert.ok(ids.admin, 'los usuarios de prueba existen')
})
