import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

function canAccess(session: { user?: { rol?: string; area?: string } } | null) {
  if (!session?.user) return false
  const { rol, area } = session.user
  return rol === 'admin' || area === 'sistemas' || area === 'general'
}

// POST /api/sistemas/equipos/[id]/historial
// body.tipo: 'mantenimiento' | 'incidencia' | 'cambio'
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!canAccess(session)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const [equipo] = await sql`SELECT id FROM equipos_tecnologicos WHERE id = ${params.id}`
  if (!equipo) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })

  const body = await req.json()
  const { tipo } = body

  if (tipo === 'mantenimiento') {
    if (!body.fecha) return NextResponse.json({ error: 'La fecha es obligatoria' }, { status: 400 })
    const [row] = await sql`
      INSERT INTO equipos_mantenimientos (equipo_id, fecha, tipo, descripcion, tecnico, empresa, costo, proxima_fecha, observaciones)
      VALUES (${params.id}, ${body.fecha}, ${body.tipo_mant || null}, ${body.descripcion || null},
              ${body.tecnico || null}, ${body.empresa || null}, ${body.costo || null},
              ${body.proxima_fecha || null}, ${body.observaciones || null})
      RETURNING *
    `
    return NextResponse.json(row, { status: 201 })
  }

  if (tipo === 'incidencia') {
    if (!body.fecha_apertura) return NextResponse.json({ error: 'La fecha de apertura es obligatoria' }, { status: 400 })
    const [row] = await sql`
      INSERT INTO equipos_incidencias (equipo_id, ticket_id, fecha_apertura, fecha_cierre, tipo, descripcion, solucion, tecnico, prioridad, estado_ticket)
      VALUES (${params.id}, ${body.ticket_id || null}, ${body.fecha_apertura}, ${body.fecha_cierre || null},
              ${body.tipo_inc || null}, ${body.descripcion || null}, ${body.solucion || null},
              ${body.tecnico || null}, ${body.prioridad || 'Media'}, ${body.estado_ticket || 'Abierto'})
      RETURNING *
    `
    return NextResponse.json(row, { status: 201 })
  }

  if (tipo === 'cambio') {
    if (!body.fecha) return NextResponse.json({ error: 'La fecha es obligatoria' }, { status: 400 })
    const [row] = await sql`
      INSERT INTO equipos_cambios_componentes (equipo_id, fecha, componente, descripcion_anterior, descripcion_nuevo, motivo, tecnico, observaciones)
      VALUES (${params.id}, ${body.fecha}, ${body.componente || null}, ${body.descripcion_anterior || null},
              ${body.descripcion_nuevo || null}, ${body.motivo || null}, ${body.tecnico || null}, ${body.observaciones || null})
      RETURNING *
    `
    return NextResponse.json(row, { status: 201 })
  }

  return NextResponse.json({ error: 'Tipo inválido. Use: mantenimiento, incidencia, cambio' }, { status: 400 })
}
