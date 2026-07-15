import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'

// PUT /api/areas/[id] — editar label/color/roles/modulos por defecto (solo admin)
// El `key` no se puede cambiar: es lo que queda guardado en usuarios.area.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'admin') return NextResponse.json({ error: 'Solo un administrador puede editar áreas' }, { status: 403 })

  const id = parseInt(params.id)
  const [existente] = await sql`SELECT * FROM areas WHERE id = ${id}`
  if (!existente) return NextResponse.json({ error: 'Área no encontrada' }, { status: 404 })

  const { label, color, bg, roles_permitidos, modulos_usuario, modulos_lider } = await req.json()

  const nuevoLabel = typeof label === 'string' && label.trim() ? label.trim() : existente.label
  const nuevoColor = typeof color === 'string' && color ? color : existente.color
  const nuevoBg    = typeof bg === 'string' && bg ? bg : existente.bg
  const nuevosRoles   = Array.isArray(roles_permitidos) ? roles_permitidos : existente.roles_permitidos
  const nuevosModUsu  = Array.isArray(modulos_usuario) ? modulos_usuario : existente.modulos_usuario
  const nuevosModLid  = Array.isArray(modulos_lider) ? modulos_lider : existente.modulos_lider

  const [actualizada] = await sql`
    UPDATE areas
    SET label = ${nuevoLabel}, color = ${nuevoColor}, bg = ${nuevoBg},
        roles_permitidos = ${nuevosRoles}, modulos_usuario = ${nuevosModUsu}, modulos_lider = ${nuevosModLid}
    WHERE id = ${id}
    RETURNING *
  `

  await logAudit({
    usuarioId: session.user.id,
    usuarioNombre: session.user.name,
    accion: 'AREA_MODIFICADA',
    descripcion: `Editó el área "${existente.label}"`,
    datos: { area_key: existente.key, label_anterior: existente.label, label_nuevo: nuevoLabel },
  })

  return NextResponse.json(actualizada)
}

// DELETE /api/areas/[id] — solo admin; bloqueado si es protegida o tiene usuarios asignados
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'admin') return NextResponse.json({ error: 'Solo un administrador puede eliminar áreas' }, { status: 403 })

  const id = parseInt(params.id)
  const [existente] = await sql`SELECT * FROM areas WHERE id = ${id}`
  if (!existente) return NextResponse.json({ error: 'Área no encontrada' }, { status: 404 })

  if (existente.protegida) {
    return NextResponse.json({ error: 'Esta área es del sistema y no se puede eliminar' }, { status: 409 })
  }

  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM usuarios WHERE area = ${existente.key}`
  if (n > 0) {
    return NextResponse.json({ error: `No se puede eliminar: hay ${n} usuario(s) en esta área. Reasígnalos primero.` }, { status: 409 })
  }

  await sql`DELETE FROM areas WHERE id = ${id}`

  await logAudit({
    usuarioId: session.user.id,
    usuarioNombre: session.user.name,
    accion: 'AREA_ELIMINADA',
    descripcion: `Eliminó el área "${existente.label}"`,
    datos: { area_key: existente.key, label: existente.label },
  })

  return NextResponse.json({ ok: true })
}
