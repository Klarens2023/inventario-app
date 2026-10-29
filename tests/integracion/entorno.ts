// Entorno de las pruebas de integración: usuarios de prueba, inicio de sesión y
// llamadas HTTP contra la app corriendo (npm run start) con una base de DESARROLLO.
//
// Seguridad: estas pruebas ESCRIBEN en la base (crean y borran usuarios "it_*").
// Por eso exigen que la variable BD_DESARROLLO_HOST coincida con el host de
// DATABASE_URL: así nunca corren por accidente contra producción.
//
// Uso (con la app ya corriendo en http://localhost:3000):
//   BD_DESARROLLO_HOST=ep-xxxx node --env-file=.env.local --test "tests/integracion/**/*.test.ts"
import { neon } from '@neondatabase/serverless'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { claveMaestra, cifrarClave, generarClave, generarCodigosRecuperacion, huellaRecuperacion } from '../../lib/totp.ts'

/** URL de la app bajo prueba. */
export const BASE = process.env.PRUEBAS_BASE_URL ?? 'http://localhost:3000'

/** Valida que la base sea la de desarrollo indicada; si no, aborta todo. */
function conexionSegura() {
  const url = process.env.DATABASE_URL
  const esperado = process.env.BD_DESARROLLO_HOST
  if (!url) throw new Error('Falta DATABASE_URL')
  if (!esperado) throw new Error('Falta BD_DESARROLLO_HOST: indica el host de la rama de desarrollo de Neon')
  const host = new URL(url).hostname
  // startsWith: el host real lleva el sufijo "-pooler.c-6..." que no hace falta escribir
  if (!host.startsWith(esperado)) throw new Error(`La base (${host.split('.')[0]}) no es la indicada en BD_DESARROLLO_HOST: no se corre nada`)
  return neon(url)
}
export const sql = conexionSegura()

/** Roles de prueba: cada uno con el rol, área y módulos que se quieren ejercitar. */
export const ROLES = {
  admin:       { rol: 'admin',   area: 'general',   modulos: [] as string[] },
  lider:       { rol: 'lider',   area: 'sistemas',  modulos: ['equipos'] },
  inventario:  { rol: 'usuario', area: 'logistica', modulos: ['cargar', 'consulta', 'acumulados', 'ordenes_cen'] },
  tic:         { rol: 'usuario', area: 'sistemas',  modulos: ['equipos', 'movimientos_tic', 'repuestos_tic'] },
  pagos:       { rol: 'usuario', area: 'logistica', modulos: ['pvn_pagos_qr', 'pvn_historial', 'pvn_analisis', 'pvn_catalogo'] },
  sinModulos:  { rol: 'usuario', area: 'logistica', modulos: [] },
  pvn:         { rol: 'pvn',     area: 'puntos_venta', modulos: [] },
  pvv:         { rol: 'pvv',     area: 'puntos_venta', modulos: [] },
} as const
export type Rol = keyof typeof ROLES

/** Contraseña aleatoria por corrida: nunca se repite ni se guarda. */
export const PASSWORD = 'It-' + randomBytes(9).toString('base64url')
const PREFIJO = 'it_'

/** Ids de los usuarios creados, para usarlos y borrarlos al final. */
export const ids: Partial<Record<Rol | 'otroPvn', number>> = {}

/**
 * Verificación en dos pasos del admin de prueba: si el servidor la tiene
 * habilitada (TOTP_CLAVE), el admin la trae activa y cada inicio de sesión
 * gasta uno de estos códigos de recuperación (así no hay que esperar 30 s entre
 * códigos de la app). Si no hay TOTP_CLAVE, queda vacío y no se usa.
 */
const codigosAdmin: string[] = []

/** Activa la verificación en dos pasos del admin de prueba con 40 códigos de recuperación. */
async function activarDosPasosAdmin(id: number) {
  const maestra = claveMaestra()
  if (!maestra) return
  const codigos = generarCodigosRecuperacion(40)
  await sql`UPDATE usuarios SET totp_clave = ${cifrarClave(generarClave(), maestra)}, totp_activo = TRUE, totp_activado_en = NOW() WHERE id = ${id}`
  await sql`INSERT INTO usuario_codigos_recuperacion (usuario_id, huella) SELECT ${id}, unnest(${codigos.map(c => huellaRecuperacion(c, maestra))}::text[])`
  codigosAdmin.splice(0, codigosAdmin.length, ...codigos)
}

/** Código para el login del admin de prueba (vacío si la verificación no aplica). */
function codigoAdmin(clave: Rol | 'otroPvn'): string | undefined {
  if (clave !== 'admin' || !codigosAdmin.length) return undefined
  return codigosAdmin.shift()
}

/** Crea (o recrea) los usuarios de prueba con sus módulos. */
export async function crearUsuarios() {
  await borrarUsuarios()
  // Las pruebas fallan logins a propósito desde este equipo: sin esto, al correr la
  // suite varias veces seguidas el límite por IP (30 fallos) bloquea las siguientes
  await sql`DELETE FROM login_intentos_ip WHERE ip IN ('desconocida', '::1', '127.0.0.1', '::ffff:127.0.0.1')`
  const hash = await bcrypt.hash(PASSWORD, 10)
  // Un punto de venta nacional existente para los pvn (el pvv queda rotativo)
  const [pv] = await sql`SELECT id FROM pvn_puntos_venta WHERE tipo = 'nacional' AND activo ORDER BY id LIMIT 1`
  for (const [clave, def] of Object.entries(ROLES) as [Rol, (typeof ROLES)[Rol]][]) {
    const [u] = await sql`
      INSERT INTO usuarios (username, password_hash, nombre, rol, area, activo, debe_cambiar_password, punto_venta_id, acceso_movil)
      VALUES (${PREFIJO + clave}, ${hash}, ${'Prueba ' + clave}, ${def.rol}, ${def.area}, true, false,
              ${def.rol === 'pvn' ? pv?.id ?? null : null}, true)
      RETURNING id`
    ids[clave] = u.id
    if (def.rol === 'admin') await activarDosPasosAdmin(u.id)
    for (const m of def.modulos) await sql`INSERT INTO usuario_modulos (usuario_id, modulo) VALUES (${u.id}, ${m})`
  }
  // Segundo pvn: dueño de datos que el primero NO debe poder ver (pruebas de IDOR)
  const [o] = await sql`
    INSERT INTO usuarios (username, password_hash, nombre, rol, area, activo, debe_cambiar_password, punto_venta_id, acceso_movil)
    VALUES (${PREFIJO + 'otro_pvn'}, ${hash}, 'Prueba otro pvn', 'pvn', 'puntos_venta', true, false, ${pv?.id ?? null}, true)
    RETURNING id`
  ids.otroPvn = o.id
}

/** Borra todo lo que crearon las pruebas (usuarios it_* y sus turnos, pagos y registros). */
export async function borrarUsuarios() {
  const viejos = await sql`SELECT id FROM usuarios WHERE username LIKE ${PREFIJO + '%'}`
  const lista = viejos.map(v => v.id as number)
  if (!lista.length) return
  await sql`DELETE FROM pvn_pagos_qr WHERE usuario_id = ANY(${lista}::int[])`
  await sql`DELETE FROM pvn_turnos WHERE usuario_id = ANY(${lista}::int[])`
  await sql`DELETE FROM pvn_registros WHERE usuario_id = ANY(${lista}::int[])`
  // La bitácora apunta al usuario: se desliga para poder borrarlo (las entradas quedan)
  await sql`UPDATE audit_logs SET usuario_id = NULL WHERE usuario_id = ANY(${lista}::int[])`
  await sql`DELETE FROM usuarios WHERE id = ANY(${lista}::int[])`
}

/** Sesión web (cookie de NextAuth) de un rol, igual que el login del navegador. */
export async function loginWeb(clave: Rol | 'otroPvn'): Promise<string> {
  const codigo = codigoAdmin(clave)
  const usuario = PREFIJO + (clave === 'otroPvn' ? 'otro_pvn' : clave)
  const r1 = await fetch(`${BASE}/api/auth/csrf`)
  const { csrfToken } = await r1.json() as { csrfToken: string }
  let cookies = unirCookies('', r1.headers.getSetCookie())
  const r2 = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookies },
    body: new URLSearchParams({ csrfToken, username: usuario, password: PASSWORD, json: 'true', ...(codigo ? { codigo } : {}) }),
  })
  cookies = unirCookies(cookies, r2.headers.getSetCookie())
  if (!cookies.includes('session-token')) throw new Error(`No se pudo iniciar sesión web como ${usuario} (HTTP ${r2.status})`)
  return cookies
}

/** Token de la app móvil (Bearer) de un rol. */
export async function loginMovil(clave: Rol | 'otroPvn'): Promise<string> {
  const codigo = codigoAdmin(clave)
  const usuario = PREFIJO + (clave === 'otroPvn' ? 'otro_pvn' : clave)
  const r = await fetch(`${BASE}/api/auth/mobile/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: usuario, password: PASSWORD, ...(codigo ? { codigo } : {}) }),
  })
  const d = await r.json() as { token?: string; error?: string }
  if (!d.token) throw new Error(`Login móvil de ${usuario}: ${d.error ?? r.status}`)
  return d.token
}

/** Junta cookies previas con las nuevas de Set-Cookie (solo nombre=valor). */
function unirCookies(previas: string, nuevas: string[]): string {
  const mapa = new Map(previas.split('; ').filter(Boolean).map(c => [c.split('=')[0], c] as [string, string]))
  for (const n of nuevas) { const par = n.split(';')[0]; mapa.set(par.split('=')[0], par) }
  return Array.from(mapa.values()).join('; ')
}

/** Petición autenticada: credencial = cookie web, "Bearer x" o null (sin sesión). */
export async function pedir(credencial: string | null, metodo: string, ruta: string, cuerpo?: unknown) {
  const headers: Record<string, string> = {}
  if (credencial?.startsWith('Bearer ')) headers.Authorization = credencial
  else if (credencial) headers.Cookie = credencial
  if (cuerpo !== undefined) headers['Content-Type'] = 'application/json'
  const r = await fetch(`${BASE}${ruta}`, { method: metodo, headers, redirect: 'manual', body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) })
  let datos: unknown = null
  try { datos = await r.json() } catch { /* sin cuerpo JSON */ }
  return { status: r.status, datos }
}
