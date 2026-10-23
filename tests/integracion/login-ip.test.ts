// Límite de intentos de login fallidos por IP (lib/loginBruteForce.ts).
// Usa IPs del rango de documentación 198.51.100.0/24 (RFC 5737), que nunca son
// clientes reales, y las borra al terminar. Localmente `next start` respeta el
// encabezado x-real-ip que manda la prueba; en Vercel lo fija la plataforma.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { BASE, sql } from './entorno.ts'

const IP_ATACANTE = '198.51.100.' + (10 + Math.floor(Math.random() * 200))
const IP_VECINA = '198.51.100.250'
// IP del segmento de la empresa (LOGIN_IPS_CONFIANZA en .env.local)
const IP_EMPRESA = '190.242.100.250'

/** Intento de login móvil con usuario inexistente desde una IP dada. */
async function intentar(ip: string) {
  const r = await fetch(`${BASE}/api/auth/mobile/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-real-ip': ip },
    body: JSON.stringify({ username: 'it_no_existe', password: 'incorrecta' }),
  })
  return { status: r.status, datos: await r.json() as { error?: string } }
}

after(async () => {
  await sql`DELETE FROM login_intentos_ip WHERE ip = ANY(${[IP_ATACANTE, IP_VECINA, IP_EMPRESA]}::text[])`
})

test('30 fallos desde una IP la bloquean; otra IP sigue pudiendo intentar', async () => {
  for (let i = 1; i <= 30; i++) {
    const r = await intentar(IP_ATACANTE)
    assert.equal(r.status, 401, `el intento ${i} debía ser 401 (credenciales inválidas)`)
  }
  const bloqueado = await intentar(IP_ATACANTE)
  assert.equal(bloqueado.status, 429)
  assert.match(bloqueado.datos.error ?? '', /desde esta conexión/)

  // La IP bloqueada tampoco entra por el login web (NextAuth)
  const csrf = await fetch(`${BASE}/api/auth/csrf`)
  const { csrfToken } = await csrf.json() as { csrfToken: string }
  const cookie = csrf.headers.getSetCookie().map(c => c.split(';')[0]).join('; ')
  const web = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie, 'x-real-ip': IP_ATACANTE },
    body: new URLSearchParams({ csrfToken, username: 'it_no_existe', password: 'x', json: 'true' }),
  })
  // Con json=true NextAuth no redirige: responde { url } con el error en la consulta
  const { url } = await web.json() as { url?: string }
  const destino = decodeURIComponent(url ?? '')
  assert.match(destino, /desde esta conexión/, 'el login web debía devolver el mensaje de bloqueo por IP')

  // Otra IP no se ve afectada
  assert.equal((await intentar(IP_VECINA)).status, 401)
})

test('la IP de la empresa no se bloquea aunque acumule más de 30 fallos', async () => {
  for (let i = 1; i <= 35; i++) {
    const r = await intentar(IP_EMPRESA)
    assert.equal(r.status, 401, `el intento ${i} desde la empresa debía ser 401, no bloqueo`)
  }
  // Y no se guardó ningún conteo para ella
  const filas = await sql`SELECT 1 FROM login_intentos_ip WHERE ip = ${IP_EMPRESA}`
  assert.equal(filas.length, 0)
})
