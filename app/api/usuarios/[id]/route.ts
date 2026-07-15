import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import bcrypt from 'bcryptjs'

const PASSWORD_GENERICA = '123456'

// PUT /api/usuarios/[id] — activar/desactivar, cambiar rol o área
// admin → puede modificar cualquier usuario
// lider → solo puede modificar usuarios de su área, no puede cambiar admins ni crear admins
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const sesionRol = session.user?.rol
  if (!['admin', 'lider'].includes(sesionRol)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const esSelf = String(id) === session.user?.id
  if (esSelf && sesionRol !== 'admin') {
    return NextResponse.json({ error: 'No puedes modificar tu propia cuenta' }, { status: 400 })
  }

  const [usuario] = await sql`SELECT id, nombre, username, rol, area FROM usuarios WHERE id = ${id} LIMIT 1`
  if (!usuario) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  // Lider solo puede modificar usuarios de su área y no puede tocar admins
  if (sesionRol === 'lider') {
    if (usuario.area !== session.user?.area) {
      return NextResponse.json({ error: 'No tienes permiso para modificar este usuario' }, { status: 403 })
    }
    if (usuario.rol === 'admin') {
      return NextResponse.json({ error: 'No puedes modificar administradores' }, { status: 403 })
    }
  }

  const body = await req.json()
  const { activo, rol, nombre, username, area, punto_venta_id, resetPassword, modulos } = body

  if (activo !== undefined) {
    if (esSelf && !activo) {
      return NextResponse.json({ error: 'No puedes desactivar tu propia cuenta' }, { status: 400 })
    }
    await sql`UPDATE usuarios SET activo = ${!!activo} WHERE id = ${id}`
  }
  if (rol !== undefined) {
    if (esSelf && rol !== usuario.rol) {
      return NextResponse.json({ error: 'No puedes cambiar tu propio rol' }, { status: 400 })
    }
    const rolesValidos = sesionRol === 'admin' ? ['admin', 'lider', 'usuario', 'pvn', 'pvv'] : ['lider', 'usuario', 'pvn', 'pvv']
    if (!rolesValidos.includes(rol)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    }
    await sql`UPDATE usuarios SET rol = ${rol} WHERE id = ${id}`
  }
  if (nombre !== undefined && typeof nombre === 'string' && nombre.trim()) {
    await sql`UPDATE usuarios SET nombre = ${nombre.trim()} WHERE id = ${id}`
  }
  if (username !== undefined && typeof username === 'string' && username.trim()) {
    const existing = await sql`SELECT id FROM usuarios WHERE username = ${username.trim()} AND id != ${id} LIMIT 1`
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Ese nombre de usuario ya está en uso' }, { status: 400 })
    }
    await sql`UPDATE usuarios SET username = ${username.trim()} WHERE id = ${id}`
  }
  if (area !== undefined && sesionRol === 'admin') {
    const [areaValida] = await sql`SELECT key FROM areas WHERE key = ${area}`
    if (!areaValida) {
      return NextResponse.json({ error: 'Área inválida' }, { status: 400 })
    }
    await sql`UPDATE usuarios SET area = ${area} WHERE id = ${id}`
  }
  if (punto_venta_id !== undefined) {
    const pvId = punto_venta_id === null ? null : parseInt(punto_venta_id)
    await sql`UPDATE usuarios SET punto_venta_id = ${pvId} WHERE id = ${id}`
  }
  if (resetPassword === true) {
    const hash = await bcrypt.hash(PASSWORD_GENERICA, 10)
    await sql`UPDATE usuarios SET password_hash = ${hash}, debe_cambiar_password = true WHERE id = ${id}`
  }
  if (Array.isArray(modulos)) {
    await sql`DELETE FROM usuario_modulos WHERE usuario_id = ${id}`
    for (const m of modulos) {
      await sql`INSERT INTO usuario_modulos (usuario_id, modulo) VALUES (${id}, ${m}) ON CONFLICT DO NOTHING`
    }
  }

  await logAudit({
    usuarioId: session.user?.id ?? null,
    usuarioNombre: session.user?.name ?? 'Desconocido',
    accion: 'USUARIO_MODIFICADO',
    descripcion: resetPassword === true
      ? `Restableció la contraseña de "${usuario.nombre}" (${usuario.username})`
      : `Modificó usuario "${usuario.nombre}" (${usuario.username})`,
    datos: { id, cambios: { ...body, resetPassword: resetPassword === true ? true : undefined } },
  })

  const [actualizado] = await sql`
    SELECT id, username, nombre, rol, area, activo, debe_cambiar_password, created_at
    FROM usuarios WHERE id = ${id}
  `
  return NextResponse.json(actualizado)
}
