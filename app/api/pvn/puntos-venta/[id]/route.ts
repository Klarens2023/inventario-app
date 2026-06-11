import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

function canManage(rol: string, area: string) {
  return rol === 'admin' || (rol === 'lider' && ['logistica', 'general'].includes(area))
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { rol, area } = session.user as { rol: string; area: string }
  if (!canManage(rol, area)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const { nombre, activo } = await req.json()

  if (nombre !== undefined) {
    const dup = await sql`
      SELECT id FROM pvn_puntos_venta WHERE LOWER(nombre) = LOWER(${nombre.trim()}) AND id != ${id} LIMIT 1
    `
    if (dup.length > 0) return NextResponse.json({ error: 'Ya existe un punto con ese nombre' }, { status: 409 })
    await sql`UPDATE pvn_puntos_venta SET nombre = ${nombre.trim()} WHERE id = ${id}`
  }
  if (activo !== undefined) {
    await sql`UPDATE pvn_puntos_venta SET activo = ${!!activo} WHERE id = ${id}`
  }

  const [updated] = await sql`SELECT id, nombre, activo FROM pvn_puntos_venta WHERE id = ${id}`
  return NextResponse.json(updated)
}
