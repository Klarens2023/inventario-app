import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'

// PUT /api/usuarios/[id] — activar/desactivar o cambiar rol
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user?.rol !== 'admin') return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  // No puede modificarse a sí mismo
  if (String(id) === session.user?.id) {
    return NextResponse.json({ error: 'No puedes modificar tu propia cuenta' }, { status: 400 })
  }

  const body = await req.json()
  const { activo, rol } = body

  const [usuario] = await sql`SELECT id, nombre, username FROM usuarios WHERE id = ${id} LIMIT 1`
  if (!usuario) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  if (activo !== undefined) {
    await sql`UPDATE usuarios SET activo = ${!!activo} WHERE id = ${id}`
  }
  if (rol !== undefined) {
    if (!['admin', 'usuario'].includes(rol)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    }
    await sql`UPDATE usuarios SET rol = ${rol} WHERE id = ${id}`
  }

  await logAudit({
    usuarioId: session.user?.id ?? null,
    usuarioNombre: session.user?.name ?? 'Desconocido',
    accion: 'USUARIO_MODIFICADO',
    descripcion: `Modificó usuario "${usuario.nombre}" (${usuario.username})`,
    datos: { id, cambios: body },
  })

  const [actualizado] = await sql`
    SELECT id, username, nombre, rol, activo, debe_cambiar_password, created_at
    FROM usuarios WHERE id = ${id}
  `
  return NextResponse.json(actualizado)
}
