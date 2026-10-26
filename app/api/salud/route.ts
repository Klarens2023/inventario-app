import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

// Chequeo de salud para monitoreo externo (UptimeRobot, GitHub Actions, etc.).
// Es PÚBLICO a propósito (está en la lista de tests/rutas-protegidas.test.ts):
// no devuelve datos, solo si la app responde y si la base de datos contesta.
// Nunca incluye el detalle del error, para no filtrar información interna.
// ----

// Siempre se ejecuta en el momento (nada de caché), o el monitoreo mentiría.
export const dynamic = 'force-dynamic'

export async function GET() {
  const inicio = Date.now()
  try {
    // Consulta mínima: prueba conexión y credenciales sin leer ninguna tabla
    await sql`SELECT 1`
    return NextResponse.json(
      { ok: true, bd: 'ok', ms: Date.now() - inicio },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e) {
    // El detalle va al log del servidor (Vercel), no a la respuesta
    console.error('[salud] La base de datos no respondió:', e)
    return NextResponse.json(
      { ok: false, bd: 'error' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
