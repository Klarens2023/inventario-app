import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import bcrypt from 'bcryptjs'

const PASSWORD_GENERICA = '123456'

// GET /api/usuarios — lista todos los usuarios (solo admin)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user?.rol !== 'admin') return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const rows = await sql`
    SELECT id, username, nombre, rol, activo, debe_cambiar_password, created_at
    FROM usuarios
    ORDER BY created_at DESC
  `
  return NextResponse.json(rows)
}

// POST /api/usuarios — crear nuevo usuario (solo admin)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user?.rol !== 'admin') return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const { username, nombre, rol } = await req.json()

  if (!username?.trim() || !nombre?.trim()) {
    return NextResponse.json({ error: 'Usuario y nombre son obligatorios' }, { status: 400 })
  }

  const existe = await sql`SELECT id FROM usuarios WHERE username = ${username.trim()} LIMIT 1`
  if (existe.length > 0) {
    return NextResponse.json({ error: 'El nombre de usuario ya existe' }, { status: 409 })
  }

  const hash = await bcrypt.hash(PASSWORD_GENERICA, 10)

  const [nuevo] = await sql`
    INSERT INTO usuarios (username, password_hash, nombre, rol, activo, debe_cambiar_password)
    VALUES (
      ${username.trim()},
      ${hash},
      ${nombre.trim()},
      ${rol === 'admin' ? 'admin' : 'usuario'},
      true,
      true
    )
    RETURNING id, username, nombre, rol, activo, debe_cambiar_password, created_at
  `

  await logAudit({
    usuarioId: session.user?.id ?? null,
    usuarioNombre: session.user?.name ?? 'Desconocido',
    accion: 'USUARIO_CREADO',
    descripcion: `Creó el usuario "${nombre.trim()}" (${username.trim()})`,
    datos: { usuario_creado: username.trim(), rol: rol ?? 'usuario' },
  })

  return NextResponse.json(nuevo, { status: 201 })
}
