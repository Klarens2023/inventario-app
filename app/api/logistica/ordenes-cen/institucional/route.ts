import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { verificarAcceso } from '@/lib/cen/acceso'
import { siesaConfigurado } from '@/lib/siesa/connekta'
import { agregarPedidos, buscarPedidos } from '@/lib/cen/pedidosInstitucionales'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'

// GET /api/logistica/ordenes-cen/institucional?q=... — pedidos de Siesa de los últimos 8 días por NIT,
// razón social o número de pedido, marcando los que ya están en el sistema.
export async function GET(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  if (!siesaConfigurado('real')) return NextResponse.json({ error: 'La API real de Siesa no está configurada (SIESA_REAL_CLIENT_ID, SIESA_REAL_CONNI_KEY y SIESA_REAL_CONNI_TOKEN).' }, { status: 503 })
  const q = (req.nextUrl.searchParams.get('q') ?? '').slice(0, 80)
  try {
    return NextResponse.json(await buscarPedidos(q))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: /al menos 3/.test(msg) ? 400 : 502 })
  }
}

// POST /api/logistica/ordenes-cen/institucional — agrega pedidos de Siesa como órdenes institucionales.
// Body: { pedidos: ["001|PVK|16208", ...], ruta: "DISTRYCAR" }
export async function POST(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  const { user } = acceso
  if (!siesaConfigurado('real')) return NextResponse.json({ error: 'La API real de Siesa no está configurada (SIESA_REAL_CLIENT_ID, SIESA_REAL_CONNI_KEY y SIESA_REAL_CONNI_TOKEN).' }, { status: 503 })
  const b = await req.json().catch(() => ({})) as { pedidos?: unknown; ruta?: unknown }
  const ids = Array.isArray(b.pedidos) ? Array.from(new Set(b.pedidos.map(String))).slice(0, 50) : []
  if (!ids.length) return NextResponse.json({ error: 'Selecciona al menos un pedido' }, { status: 400 })
  const ruta = String(b.ruta ?? '').trim().toUpperCase()
  // Solo rutas que ya existen
  const [existe] = ruta ? await sql`SELECT ruta FROM cen_rutas WHERE ruta = ${ruta}` : []
  if (!existe) return NextResponse.json({ error: 'Elige una ruta existente' }, { status: 400 })

  const resultados = await agregarPedidos(ids, ruta, user.name.slice(0, 120))
  const agregados = resultados.filter(r => r.ok)
  if (agregados.length) {
    await logAudit({
      usuarioId: user.id, usuarioNombre: user.name, accion: 'CEN_INSTITUCIONAL_AGREGADO',
      descripcion: `Agregó ${agregados.length} pedido(s) institucional(es) de Siesa a la ruta ${ruta}: ${agregados.map(r => r.pedido).join(', ')}`,
      datos: { ruta, pedidos: agregados.map(r => r.pedido) },
    })
  }
  return NextResponse.json({ resultados })
}
