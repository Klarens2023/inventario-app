import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'

// PUT /api/cambiar-password — usado por web (sesión) y app móvil (Bearer token)
export async function PUT(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { nueva_password } = await req.json()

  if (!nueva_password || nueva_password.length < 6 || nueva_password.length > 100) {
    return NextResponse.json({ error: 'La contraseña debe tener entre 6 y 100 caracteres' }, { status: 400 })
  }

  const hash = await bcrypt.hash(nueva_password, 10)

  await sql`
    UPDATE usuarios
    SET password_hash = ${hash}, debe_cambiar_password = false
    WHERE id = ${parseInt(user.id)}
  `

  return NextResponse.json({ ok: true })
}
