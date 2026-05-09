import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'

// PUT /api/cambiar-password
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { nueva_password } = await req.json()

  if (!nueva_password || nueva_password.length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
  }

  const hash = await bcrypt.hash(nueva_password, 10)

  await sql`
    UPDATE usuarios
    SET password_hash = ${hash}, debe_cambiar_password = false
    WHERE id = ${parseInt(session.user.id)}
  `

  return NextResponse.json({ ok: true })
}
