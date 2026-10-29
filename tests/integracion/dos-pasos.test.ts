// Verificación en dos pasos de administradores (lib/dosPasos.ts, /seguridad,
// login web y móvil). Necesita TOTP_CLAVE en .env.local (la app y la prueba la
// leen del mismo archivo); sin ella estas pruebas se saltan.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import { BASE, sql, PASSWORD, crearUsuarios, borrarUsuarios, loginWeb } from './entorno.ts'
import { claveMaestra, base32Decodificar, codigoParaPaso, pasoActual } from '../../lib/totp.ts'

const omitir = !claveMaestra() && 'falta TOTP_CLAVE en .env.local'
const ADMIN = 'it_2fa_admin'
const OTRO = 'it_2fa_otro'
let idAdmin = 0, idOtro = 0
let clave: Buffer
let recuperacion: string[] = []

/** Inicio de sesión web; devuelve las cookies y, si falló, el error que mandó NextAuth. */
async function loginWebCon(username: string, codigo?: string) {
  const r1 = await fetch(`${BASE}/api/auth/csrf`)
  const { csrfToken } = await r1.json() as { csrfToken: string }
  const cookie = r1.headers.getSetCookie().map(c => c.split(';')[0]).join('; ')
  const r2 = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    body: new URLSearchParams({ csrfToken, username, password: PASSWORD, json: 'true', ...(codigo ? { codigo } : {}) }),
  })
  const cookies = [cookie, ...r2.headers.getSetCookie().map(c => c.split(';')[0])].join('; ')
  const { url } = await r2.json() as { url?: string }
  const error = new URL(url ?? BASE, BASE).searchParams.get('error')
  return { cookies: cookies.includes('session-token') ? cookies : null, error }
}

async function llamar(cookies: string, metodo: string, ruta: string, cuerpo?: unknown) {
  const r = await fetch(`${BASE}${ruta}`, {
    method: metodo, headers: { Cookie: cookies, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  return { status: r.status, datos: await r.json().catch(() => null) as Record<string, unknown> | null }
}

async function loginMovilCon(username: string, codigo?: string) {
  const r = await fetch(`${BASE}/api/auth/mobile/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: PASSWORD, ...(codigo ? { codigo } : {}) }),
  })
  return { status: r.status, datos: await r.json() as { token?: string; error?: string; requiere2fa?: boolean } }
}

before(async () => {
  if (omitir) return
  await crearUsuarios() // usuarios it_* comunes (incluye it_inventario, sin 2FA)
  const hash = await bcrypt.hash(PASSWORD, 10)
  for (const u of [ADMIN, OTRO]) {
    await sql`INSERT INTO usuarios (username, password_hash, nombre, rol, area, activo, debe_cambiar_password, acceso_movil)
              VALUES (${u}, ${hash}, ${'Prueba ' + u}, 'admin', 'general', true, false, true)`
  }
  ;[{ id: idAdmin }] = await sql`SELECT id FROM usuarios WHERE username = ${ADMIN}`
  ;[{ id: idOtro }] = await sql`SELECT id FROM usuarios WHERE username = ${OTRO}`
})
after(async () => {
  if (omitir) return
  await sql`DELETE FROM audit_logs WHERE usuario_nombre LIKE 'it\\_2fa%' OR usuario_nombre LIKE 'Prueba it\\_2fa%'`
  await borrarUsuarios()
})

test('admin sin 2FA: entra con sesión restringida a /seguridad; la app móvil lo rechaza', { skip: omitir }, async () => {
  const { cookies } = await loginWebCon(ADMIN)
  assert.ok(cookies, 'la contraseña basta mientras no la active')
  assert.equal((await llamar(cookies!, 'GET', '/api/usuarios')).status, 401, 'nada fuera de /seguridad')
  const estado = await llamar(cookies!, 'GET', '/api/seguridad/dos-pasos')
  assert.equal(estado.status, 200)
  assert.equal(estado.datos?.obligatoria, true)
  assert.equal(estado.datos?.activo, false)
  // La página también redirige a /seguridad
  const pagina = await fetch(`${BASE}/dashboard`, { headers: { Cookie: cookies! }, redirect: 'manual' })
  assert.match(pagina.headers.get('location') ?? '', /\/seguridad$/)
  assert.equal((await loginMovilCon(ADMIN)).status, 403)
})

test('activación: código errado se rechaza; el correcto activa y entrega 10 códigos de recuperación', { skip: omitir }, async () => {
  const { cookies } = await loginWebCon(ADMIN)
  const ini = await llamar(cookies!, 'POST', '/api/seguridad/dos-pasos', { accion: 'iniciar' })
  assert.equal(ini.status, 200)
  assert.match(String(ini.datos?.qr), /^<svg/)
  clave = base32Decodificar(String(ini.datos?.clave))

  assert.equal((await llamar(cookies!, 'POST', '/api/seguridad/dos-pasos', { accion: 'confirmar', codigo: '000000' })).status, 400)
  const ok = await llamar(cookies!, 'POST', '/api/seguridad/dos-pasos', { accion: 'confirmar', codigo: codigoParaPaso(clave, pasoActual()) })
  assert.equal(ok.status, 200)
  recuperacion = ok.datos?.codigos as string[]
  assert.equal(recuperacion.length, 10)
  // La misma sesión ya no está restringida (se revalida contra la BD en cada petición)
  assert.equal((await llamar(cookies!, 'GET', '/api/usuarios')).status, 200)
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM audit_logs WHERE usuario_id = ${idAdmin} AND accion = 'DOS_PASOS_ACTIVADO'`
  assert.equal(n, 1)
})

test('login web con 2FA: sin código lo pide, errado falla, correcto entra y no se puede reusar', { skip: omitir }, async () => {
  assert.equal((await loginWebCon(ADMIN)).error, 'CODIGO_2FA_REQUERIDO')
  const errado = await loginWebCon(ADMIN, '000000')
  assert.equal(errado.cookies, null)
  assert.match(errado.error ?? '', /incorrecto/)
  // El paso actual ya se usó al activar: se usa el siguiente (la ventana acepta ±30 s)
  const codigo = codigoParaPaso(clave, pasoActual() + 1)
  assert.ok((await loginWebCon(ADMIN, codigo)).cookies, 'con el código correcto entra')
  assert.equal((await loginWebCon(ADMIN, codigo)).cookies, null, 'el mismo código no sirve dos veces')
})

test('códigos de recuperación: sirven una sola vez (web y móvil)', { skip: omitir }, async () => {
  const [c1, c2] = recuperacion
  assert.ok((await loginWebCon(ADMIN, c1.toLowerCase().replace('-', ''))).cookies, 'acepta minúsculas y sin guion')
  assert.equal((await loginWebCon(ADMIN, c1)).cookies, null, 'ya gastado')

  const sinCodigo = await loginMovilCon(ADMIN)
  assert.equal(sinCodigo.status, 401)
  assert.equal(sinCodigo.datos.requiere2fa, true)
  const conCodigo = await loginMovilCon(ADMIN, c2)
  assert.ok(conCodigo.datos.token, 'la app móvil entra con un código de recuperación')
})

test('los fallos de código cuentan para el bloqueo de la cuenta (5 seguidos)', { skip: omitir }, async () => {
  await sql`UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ${idOtro}`
  // OTRO con 2FA activa (clave cualquiera) para probar el conteo
  await sql`UPDATE usuarios SET totp_activo = TRUE, totp_clave = (SELECT totp_clave FROM usuarios WHERE id = ${idAdmin}) WHERE id = ${idOtro}`
  for (let i = 0; i < 5; i++) await loginMovilCon(OTRO, '000000')
  const r = await loginMovilCon(OTRO, codigoParaPaso(clave, pasoActual()))
  assert.equal(r.status, 429, 'cuenta bloqueada aunque ahora el código sea correcto')
  await sql`UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ${idOtro}`
})

test('reinicio: otro admin puede reiniciarla; uno mismo no', { skip: omitir }, async () => {
  const { cookies } = await loginWebCon(ADMIN, recuperacion[2])
  assert.equal((await llamar(cookies!, 'DELETE', `/api/usuarios/${idAdmin}/dos-pasos`)).status, 403, 'no sobre sí mismo')
  assert.equal((await llamar(cookies!, 'DELETE', `/api/usuarios/${idOtro}/dos-pasos`)).status, 200)
  const [u] = await sql`SELECT totp_activo, totp_clave FROM usuarios WHERE id = ${idOtro}`
  assert.equal(u.totp_activo, false)
  assert.equal(u.totp_clave, null)
  // Un usuario que no es admin no puede reiniciar a nadie
  const noAdmin = await llamar(await loginWeb('inventario'), 'DELETE', `/api/usuarios/${idAdmin}/dos-pasos`)
  assert.equal(noAdmin.status, 403)
})

test('los usuarios que no son admin no notan nada', { skip: omitir }, async () => {
  const r = await loginWebCon('it_inventario')
  assert.ok(r.cookies)
  assert.equal(r.error, null)
})
