import { NextRequest, NextResponse } from 'next/server'
import { exigirAcceso } from '@/lib/acceso'
import type { NeonQueryPromise } from '@neondatabase/serverless'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import bcrypt from 'bcryptjs'
import { generarPasswordTemporal } from '@/lib/passwordTemporal'
import { MODULOS } from '@/lib/permissions'

// PUT /api/usuarios/[id] — activar/desactivar, cambiar rol o área
// admin → puede modificar cualquier usuario
// lider → solo puede modificar usuarios de su área, no puede cambiar admins ni crear admins
export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const acceso = await exigirAcceso(req, { roles: ['admin', 'lider'] })
  if (!acceso.ok) return acceso.respuesta
  const { user } = acceso

  const sesionRol = user.rol
  if (!['admin', 'lider'].includes(sesionRol)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const esSelf = String(id) === user.id
  if (esSelf && sesionRol !== 'admin') {
    return NextResponse.json({ error: 'No puedes modificar tu propia cuenta' }, { status: 400 })
  }

  const [usuario] = await sql`SELECT id, nombre, username, rol, area FROM usuarios WHERE id = ${id} LIMIT 1`
  if (!usuario) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  // Lider solo puede modificar usuarios de su área con rol usuario, pvn o pvv (AUD-16):
  // ni admins ni otros líderes, para que no pueda restablecerle la contraseña a otro
  // líder y actuar a su nombre.
  if (sesionRol === 'lider') {
    if (usuario.area !== user.area) {
      return NextResponse.json({ error: 'No tienes permiso para modificar este usuario' }, { status: 403 })
    }
    if (usuario.rol === 'admin') {
      return NextResponse.json({ error: 'No puedes modificar administradores' }, { status: 403 })
    }
    if (usuario.rol === 'lider') {
      return NextResponse.json({ error: 'Solo un administrador puede modificar a otro líder' }, { status: 403 })
    }
  }

  const body = await req.json()
  const { activo, rol, nombre, username, area, punto_venta_id, resetPassword, modulos, acceso_movil } = body

  // Primero se valida todo y después se aplican los cambios en una sola
  // transacción (AUD-22): antes cada campo se guardaba apenas se validaba, así
  // que un error en un campo posterior (p. ej. usuario repetido) respondía 400
  // pero dejaba aplicados los cambios anteriores.
  const cambios: NeonQueryPromise<false, false>[] = []

  if (activo !== undefined) {
    if (esSelf && !activo) {
      return NextResponse.json({ error: 'No puedes desactivar tu propia cuenta' }, { status: 400 })
    }
    cambios.push(sql`UPDATE usuarios SET activo = ${!!activo} WHERE id = ${id}`)
  }
  if (rol !== undefined) {
    if (esSelf && rol !== usuario.rol) {
      return NextResponse.json({ error: 'No puedes cambiar tu propio rol' }, { status: 400 })
    }
    const rolesValidos = sesionRol === 'admin' ? ['admin', 'lider', 'usuario', 'pvn', 'pvv'] : ['usuario', 'pvn', 'pvv']
    if (!rolesValidos.includes(rol)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    }
    cambios.push(sql`UPDATE usuarios SET rol = ${rol} WHERE id = ${id}`)
  }
  if (nombre !== undefined && typeof nombre === 'string' && nombre.trim()) {
    cambios.push(sql`UPDATE usuarios SET nombre = ${nombre.trim()} WHERE id = ${id}`)
  }
  if (username !== undefined && typeof username === 'string' && username.trim()) {
    const existing = await sql`SELECT id FROM usuarios WHERE username = ${username.trim()} AND id != ${id} LIMIT 1`
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Ese nombre de usuario ya está en uso' }, { status: 400 })
    }
    cambios.push(sql`UPDATE usuarios SET username = ${username.trim()} WHERE id = ${id}`)
  }
  if (area !== undefined && sesionRol === 'admin') {
    const [areaValida] = await sql`SELECT key FROM areas WHERE key = ${area}`
    if (!areaValida) {
      return NextResponse.json({ error: 'Área inválida' }, { status: 400 })
    }
    cambios.push(sql`UPDATE usuarios SET area = ${area} WHERE id = ${id}`)
  }
  if (punto_venta_id !== undefined) {
    const pvId = punto_venta_id === null ? null : parseInt(punto_venta_id)
    if (pvId !== null && !Number.isInteger(pvId)) {
      return NextResponse.json({ error: 'Punto de venta inválido' }, { status: 400 })
    }
    cambios.push(sql`UPDATE usuarios SET punto_venta_id = ${pvId} WHERE id = ${id}`)
  }
  if (typeof acceso_movil === 'boolean') {
    cambios.push(sql`UPDATE usuarios SET acceso_movil = ${acceso_movil} WHERE id = ${id}`)
  }
  if (Array.isArray(modulos)) {
    if (esSelf) {
      // Solo un admin llega aquí siendo esSelf (a un líder ya se le bloqueó
      // arriba cualquier auto-edición). El modal de edición siempre reenvía
      // los módulos actuales aunque el admin solo esté cambiando su nombre,
      // así que solo se rechaza si de verdad intenta cambiar la lista.
      const actuales = await sql`SELECT modulo FROM usuario_modulos WHERE usuario_id = ${id}`
      const actualesSet = new Set(actuales.map((r) => r.modulo))
      const nuevosSet = new Set(modulos)
      const huboCambio = actualesSet.size !== nuevosSet.size || Array.from(actualesSet).some((m) => !nuevosSet.has(m))
      if (huboCambio) {
        return NextResponse.json({ error: 'No puedes cambiar tus propios módulos' }, { status: 400 })
      }
    } else {
      // Un líder solo puede conceder módulos que ya estén habilitados para el
      // área del usuario objetivo (tabla `areas`), para que no pueda otorgar
      // a otros usuarios módulos de otras áreas editando este campo.
      let modulosPermitidos: string[] = modulos.filter((m: unknown) => (MODULOS as readonly unknown[]).includes(m))
      if (sesionRol === 'lider') {
        const [areaInfo] = await sql`SELECT modulos_usuario, modulos_lider FROM areas WHERE key = ${usuario.area}`
        const permitido = new Set([...(areaInfo?.modulos_usuario ?? []), ...(areaInfo?.modulos_lider ?? [])])
        modulosPermitidos = modulosPermitidos.filter((m: string) => permitido.has(m))
      }
      cambios.push(sql`DELETE FROM usuario_modulos WHERE usuario_id = ${id}`)
      cambios.push(sql`
        INSERT INTO usuario_modulos (usuario_id, modulo)
        SELECT ${id}, m FROM unnest(${modulosPermitidos}::text[]) AS m
        ON CONFLICT DO NOTHING
      `)
    }
  }
  // Restablecer: contraseña temporal aleatoria (antes "123456"), devuelta una sola vez.
  let passwordTemporal: string | null = null
  // Restablecer la propia contraseña dejaba la sesión actual con cambio obligatorio
  // pendiente (sin permisos) y la pantalla de Usuarios fallaba antes de mostrar la
  // temporal: la cuenta quedaba con una clave que nadie conocía. Para la propia
  // contraseña se usa /cambiar-password.
  if (resetPassword === true && esSelf) {
    return NextResponse.json({ error: 'Para cambiar tu propia contraseña usa "Cambiar contraseña" en el menú lateral' }, { status: 400 })
  }
  if (resetPassword === true) {
    passwordTemporal = generarPasswordTemporal()
    const hash = await bcrypt.hash(passwordTemporal, 10)
    cambios.push(sql`UPDATE usuarios SET password_hash = ${hash}, debe_cambiar_password = true WHERE id = ${id}`)
  }

  if (cambios.length > 0) {
    try {
      await sql.transaction(cambios)
    } catch (e) {
      // 23505: el nombre de usuario lo tomó otra petición entre el chequeo y el UPDATE
      if ((e as { code?: string })?.code === '23505') {
        return NextResponse.json({ error: 'Ese nombre de usuario ya está en uso' }, { status: 400 })
      }
      throw e
    }
  }

  await logAudit({
    usuarioId: user.id ?? null,
    usuarioNombre: user.name ?? 'Desconocido',
    accion: 'USUARIO_MODIFICADO',
    descripcion: resetPassword === true
      ? `Restableció la contraseña de "${usuario.nombre}" (${usuario.username})`
      : `Modificó usuario "${usuario.nombre}" (${usuario.username})`,
    datos: { id, cambios: { ...body, resetPassword: resetPassword === true ? true : undefined } },
  })

  const [actualizado] = await sql`
    SELECT id, username, nombre, rol, area, activo, debe_cambiar_password, created_at, acceso_movil
    FROM usuarios WHERE id = ${id}
  `
  if (!passwordTemporal) return NextResponse.json(actualizado)
  return NextResponse.json({ ...actualizado, password_temporal: passwordTemporal }, { headers: { 'Cache-Control': 'no-store' } })
}
