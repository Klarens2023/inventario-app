import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import { tieneModulo } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'

function canAccess(session: { user?: { rol?: string; modulos?: string[] } } | null) {
  if (!session?.user) return false
  return tieneModulo(session.user.rol ?? '', session.user.modulos, 'movimientos_tic')
}

// GET /api/sistemas/movimientos/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!canAccess(session)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const [mov] = await sql`
    SELECT *, fecha::text AS fecha FROM tic_movimientos WHERE id = ${params.id}
  `
  if (!mov) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const activos = await sql`
    SELECT a.*, e.marca, e.modelo, e.numero_serie
    FROM tic_movimiento_activos a
    JOIN equipos_tecnologicos e ON e.id = a.equipo_id
    WHERE a.movimiento_id = ${params.id}
    ORDER BY a.id
  `

  return NextResponse.json({ ...mov, activos })
}

// PATCH /api/sistemas/movimientos/[id] — actualizar estado
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!canAccess(session)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const { estado } = await req.json()
  const validos = ['autorizado', 'entregado', 'recibido', 'cerrado']
  if (!validos.includes(estado)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }

  const [upd] = await sql`
    UPDATE tic_movimientos SET estado = ${estado}
    WHERE id = ${params.id}
    RETURNING id, estado
  `
  if (!upd) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  await logAudit({
    usuarioId: session.user?.id ?? null,
    usuarioNombre: session.user?.name ?? 'Sistema',
    accion: 'TIC_MOVIMIENTO_ESTADO',
    descripcion: `Cambió estado de ${params.id} a "${estado}"`,
    datos: { id: params.id, estado },
  })

  return NextResponse.json(upd)
}
