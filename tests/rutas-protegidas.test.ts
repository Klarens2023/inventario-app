// Prueba estática: toda ruta API debe pasar por el control de acceso único
// (exigirAcceso o verificarAcceso de lib/cen/acceso.ts). Si alguien agrega una
// ruta nueva y olvida protegerla, esta prueba falla en `npm test`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Rutas públicas a propósito, con su motivo
const PUBLICAS: Record<string, string> = {
  'app/api/auth/[...nextauth]/route.ts': 'NextAuth: login, cierre de sesión y sesión',
  'app/api/auth/mobile/login/route.ts': 'login de la app móvil',
  'app/api/salud/route.ts': 'monitoreo: solo responde si la app y la BD funcionan, sin datos',
}

function rutas(dir: string): string[] {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? rutas(p) : n === 'route.ts' ? [p.split('\\').join('/')] : []
  })
}

test('toda ruta API usa el control de acceso único o está declarada como pública', () => {
  const sinControl: string[] = []
  for (const r of rutas('app/api')) {
    if (PUBLICAS[r]) continue
    const s = readFileSync(r, 'utf8')
    const metodos = s.match(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g) ?? []
    const controles = (s.match(/\b(exigirAcceso|verificarAcceso)\(req/g) ?? []).length
    // Excepción conocida: el GET de sincronizar se autentica con CRON_SECRET (timingSafeEqual)
    const cron = /timingSafeEqual/.test(s) ? 1 : 0
    if (controles + cron < metodos.length) sinControl.push(`${r}: ${metodos.length} método(s), ${controles + cron} con control`)
  }
  assert.deepEqual(sinControl, [])
})
