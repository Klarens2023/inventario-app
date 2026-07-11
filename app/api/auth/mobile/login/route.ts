import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { sql } from '@/lib/db'

// Login para la app móvil (PVN/PVV) — emite un JWT propio, independiente de la
// sesión por cookie de NextAuth (no accesible desde React Native).
export async function POST(req: NextRequest) {
  const { username, password } = await req.json() as { username?: string; password?: string }
  if (!username || !password) {
    return NextResponse.json({ error: 'Usuario y contraseña requeridos' }, { status: 400 })
  }

  const rows = await sql`
    SELECT u.id, u.username, u.password_hash, u.nombre, u.rol, u.area, u.activo,
           u.punto_venta_id, pv.nombre AS punto_venta_nombre, u.debe_cambiar_password
    FROM usuarios u
    LEFT JOIN pvn_puntos_venta pv ON pv.id = u.punto_venta_id
    WHERE u.username = ${username} AND u.activo = true
    LIMIT 1
  `
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
  }

  const user = rows[0]
  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
  }

  if (!['pvn', 'pvv'].includes(user.rol)) {
    return NextResponse.json({ error: 'Este usuario no tiene acceso a la app móvil' }, { status: 403 })
  }

  const payload = {
    id: String(user.id),
    name: user.nombre,
    rol: user.rol as string,
    area: user.area ?? 'logistica',
    punto_venta_id: user.punto_venta_id ?? null,
    punto_venta_nombre: user.punto_venta_nombre ?? null,
  }

  const token = jwt.sign(payload, process.env.NEXTAUTH_SECRET as string, { expiresIn: '30d' })

  return NextResponse.json({
    token,
    user: { ...payload, debe_cambiar_password: user.debe_cambiar_password ?? false },
  })
}
