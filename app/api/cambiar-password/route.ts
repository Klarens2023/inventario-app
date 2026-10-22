import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'

const PASSWORD_MIN = 8
const PASSWORD_MAX = 100

// PUT /api/cambiar-password — usado por web (sesión) y app móvil (Bearer token)
// Body: { nueva_password, password_actual? }
//
// Política (AUD-18):
// - Mínimo 8 caracteres (antes 6).
// - En un cambio voluntario se exige la contraseña actual: con una sesión abierta
//   en un equipo ajeno ya no se puede cambiar la contraseña y quedarse con la cuenta.
// - En el cambio obligatorio (contraseña temporal recién entregada) no se pide: el
//   usuario acaba de entrar con ella.
// - La nueva no puede ser igual a la actual.
export async function PUT(req: NextRequest) {
  const user = await getAuthUser(req, { permitirCambioPassword: true })
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { nueva_password, password_actual } = await req.json().catch(() => ({})) as { nueva_password?: unknown; password_actual?: unknown }

  if (typeof nueva_password !== 'string' || nueva_password.length < PASSWORD_MIN || nueva_password.length > PASSWORD_MAX) {
    return NextResponse.json({ error: `La contraseña debe tener entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres` }, { status: 400 })
  }

  const [actual] = await sql`SELECT password_hash FROM usuarios WHERE id = ${parseInt(user.id)}`
  if (!actual) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  if (!user.debeCambiarPassword) {
    if (typeof password_actual !== 'string' || !password_actual) {
      return NextResponse.json({ error: 'Ingresa tu contraseña actual' }, { status: 400 })
    }
    if (!(await bcrypt.compare(password_actual, actual.password_hash))) {
      return NextResponse.json({ error: 'La contraseña actual no es correcta' }, { status: 403 })
    }
  }
  if (await bcrypt.compare(nueva_password, actual.password_hash)) {
    return NextResponse.json({ error: 'La nueva contraseña debe ser distinta de la actual' }, { status: 400 })
  }

  const hash = await bcrypt.hash(nueva_password, 10)

  await sql`
    UPDATE usuarios
    SET password_hash = ${hash}, debe_cambiar_password = false
    WHERE id = ${parseInt(user.id)}
  `

  return NextResponse.json({ ok: true })
}
