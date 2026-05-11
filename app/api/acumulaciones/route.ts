import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'

// POST /api/acumulaciones — bloquea los IDs indicados
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { ids, fecha } = await req.json()
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Falta la lista de IDs' }, { status: 400 })
  }

  await sql`
    UPDATE inventario_datos SET acumulado = true
    WHERE id = ANY(${ids}::int[])
  `

  await logAudit({
    usuarioId: session.user?.id ?? null,
    usuarioNombre: session.user?.name ?? 'Desconocido',
    accion: 'CONTEO_ACUMULADO',
    descripcion: `Acumuló y bloqueó ${ids.length} registros del día ${fecha ?? ''}`,
    datos: { ids_count: ids.length, fecha },
  })

  return NextResponse.json({ ok: true })
}
