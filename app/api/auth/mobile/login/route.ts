import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { sql } from '@/lib/db'
import {
  compararSenuelo, ipCliente, mensajeBloqueoIp, minutosBloqueoIp, minutosRestantesBloqueo,
  registrarFalloIp, registrarIntentoFallido, resetearIntentosFallidos,
} from '@/lib/loginBruteForce'

// Login para la app móvil (PVN/PVV) — emite un JWT propio, independiente de la
// sesión por cookie de NextAuth (no accesible desde React Native).
export async function POST(req: NextRequest) {
  // Cuerpo JSON { username, password }; si no es JSON válido queda vacío → 400
  const { username, password } = await req.json().catch(() => ({})) as { username?: string; password?: string }
  if (!username || !password) {
    return NextResponse.json({ error: 'Usuario y contraseña requeridos' }, { status: 400 })
  }

  // Límite por IP antes de tocar la BD de usuarios o bcrypt (ver lib/loginBruteForce.ts)
  const ip = ipCliente(req.headers)
  const minutosIp = await minutosBloqueoIp(ip)
  if (minutosIp > 0) return NextResponse.json({ error: mensajeBloqueoIp(minutosIp) }, { status: 429 })

  // Usuario activo con su punto de venta (la app muestra el nombre del punto)
  const rows = await sql`
    SELECT u.id, u.username, u.password_hash, u.nombre, u.rol, u.area, u.activo,
           u.punto_venta_id, pv.nombre AS punto_venta_nombre, u.debe_cambiar_password,
           u.bloqueado_hasta, u.acceso_movil
    FROM usuarios u
    LEFT JOIN pvn_puntos_venta pv ON pv.id = u.punto_venta_id
    WHERE u.username = ${username} AND u.activo = true
    LIMIT 1
  `
  if (rows.length === 0) {
    // Mismo tiempo de respuesta que con un usuario real (no revela si existe)
    await compararSenuelo(password)
    await registrarFalloIp(ip)
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
  }

  const user = rows[0]

  // Cuenta bloqueada por fallos seguidos
  const minutosRestantes = minutosRestantesBloqueo({ bloqueado_hasta: user.bloqueado_hasta })
  if (minutosRestantes > 0) {
    return NextResponse.json(
      { error: `Demasiados intentos fallidos. Intenta de nuevo en ${minutosRestantes} minuto(s).` },
      { status: 429 },
    )
  }

  // Contraseña contra el hash bcrypt guardado
  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    await registrarIntentoFallido(user.id)
    await registrarFalloIp(ip)
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
  }
  await resetearIntentosFallidos(user.id)

  // Se valida DESPUÉS de la contraseña para no revelar a un tercero qué
  // usuarios existen y cuáles tienen la app habilitada
  if (!user.acceso_movil) {
    return NextResponse.json({ error: 'Este usuario no tiene acceso a la app móvil' }, { status: 403 })
  }

  // try/catch: si la migración de usuario_modulos aún no se ha corrido, no debe
  // romper el login — solo pvn/pvv/admin/usuario con módulo movimientos_tic lo necesitan.
  let modulos: string[] = []
  try {
    const modulosRows = await sql`SELECT modulo FROM usuario_modulos WHERE usuario_id = ${user.id}`
    modulos = modulosRows.map(r => r.modulo as string)
  } catch {}

  // Datos que la app guarda para mostrar (nombre, punto de venta, módulos)
  const payload = {
    id: String(user.id),
    name: user.nombre,
    rol: user.rol as string,
    area: user.area ?? 'logistica',
    punto_venta_id: user.punto_venta_id ?? null,
    punto_venta_nombre: user.punto_venta_nombre ?? null,
    debe_cambiar_password: user.debe_cambiar_password ?? false,
    modulos,
  }

  // El token lleva rol/módulos solo como referencia para la app: getAuthUser
  // (lib/api-auth.ts) los vuelve a leer de la BD en cada petición, así que
  // desactivar al usuario o cambiarle permisos aplica de inmediato.
  const token = jwt.sign(payload, process.env.NEXTAUTH_SECRET as string, { expiresIn: '30d', algorithm: 'HS256' })

  return NextResponse.json({ token, user: payload })
}
