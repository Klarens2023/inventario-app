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

  // Validar que todos los IDs sean enteros
  const idsValidos = ids.map((id: unknown) => parseInt(String(id))).filter(id => !isNaN(id))
  if (idsValidos.length !== ids.length) {
    return NextResponse.json({ error: 'IDs inválidos' }, { status: 400 })
  }

  // Si no es admin, verificar que solo acumule filas que él subió
  if (session.user?.rol !== 'admin') {
    const userId = parseInt(session.user?.id ?? '0')
    const filas = await sql`
      SELECT id, cargado_por FROM inventario_datos
      WHERE id = ANY(${idsValidos}::int[])
    `
    const noAutorizados = filas.filter(r => Number(r.cargado_por) !== userId)
    if (noAutorizados.length > 0) {
      return NextResponse.json({ error: 'No tienes permiso para acumular registros que no subiste' }, { status: 403 })
    }
  }

  await sql`
    UPDATE inventario_datos SET acumulado = true
    WHERE id = ANY(${idsValidos}::int[])
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
