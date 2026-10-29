import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { sql } from '@/lib/db'
import { registrarInicioSesion } from '@/lib/audit'
import { segundoFactorLogin } from '@/lib/dosPasos'
import { CODIGO_2FA_INCORRECTO } from '@/lib/dosPasosConstantes'
import {
  compararSenuelo, ipCliente, mensajeBloqueoIp, minutosBloqueoIp, minutosRestantesBloqueo,
  registrarFalloIp, registrarIntentoFallido, resetearIntentosFallidos,
} from '@/lib/loginBruteForce'

// Login para la app móvil (PVN/PVV) — emite un JWT propio, independiente de la
// sesión por cookie de NextAuth (no accesible desde React Native).
export async function POST(req: NextRequest) {
  // Cuerpo JSON { username, password }; si no es JSON válido queda vacío → 400
  // codigo: solo administradores con verificación en dos pasos (6 dígitos o de recuperación)
  const { username, password, codigo } = await req.json().catch(() => ({})) as { username?: string; password?: string; codigo?: string }
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
           u.bloqueado_hasta, u.acceso_movil,
           -- to_jsonb: NULL en vez de error si la migración de 2FA aún no se corrió
           COALESCE((to_jsonb(u) ->> 'totp_activo')::boolean, false) AS totp_activo
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
    const quedoBloqueado = await registrarIntentoFallido(user.id)
    await registrarFalloIp(ip)
    await registrarInicioSesion({
      resultado: quedoBloqueado ? 'bloqueado' : 'fallido', usuarioId: user.id, username: user.username,
      canal: 'movil', ip, navegador: req.headers.get('user-agent'), motivo: 'contraseña incorrecta',
    })
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
  }
  // Segundo paso (solo administradores). La app muestra el campo del código
  // cuando la respuesta trae requiere2fa: true.
  const factor = await segundoFactorLogin(user as { id: number; rol: string; totp_activo: boolean }, codigo)
  if (factor === 'sin-configurar') {
    // La activación (QR) se hace en la web; sin ella el admin no entra a la app
    return NextResponse.json({ error: 'Activa primero la verificación en dos pasos desde la web (Seguridad de mi cuenta)' }, { status: 403 })
  }
  if (factor === 'falta-codigo') {
    return NextResponse.json({ error: 'Ingresa el código de verificación de tu app autenticadora', requiere2fa: true }, { status: 401 })
  }
  if (factor === 'invalido') {
    // Cuenta como intento fallido: a los 5 se bloquea la cuenta
    const quedoBloqueado = await registrarIntentoFallido(user.id)
    await registrarFalloIp(ip)
    await registrarInicioSesion({
      resultado: quedoBloqueado ? 'bloqueado' : 'fallido', usuarioId: user.id, username: user.username,
      canal: 'movil', ip, navegador: req.headers.get('user-agent'), motivo: 'código de verificación incorrecto',
    })
    return NextResponse.json({ error: CODIGO_2FA_INCORRECTO, requiere2fa: true }, { status: 401 })
  }

  await resetearIntentosFallidos(user.id)

  // Se valida DESPUÉS de la contraseña para no revelar a un tercero qué
  // usuarios existen y cuáles tienen la app habilitada
  if (!user.acceso_movil) {
    await registrarInicioSesion({
      resultado: 'fallido', usuarioId: user.id, username: user.username,
      canal: 'movil', ip, navegador: req.headers.get('user-agent'), motivo: 'sin acceso a la app móvil',
    })
    return NextResponse.json({ error: 'Este usuario no tiene acceso a la app móvil' }, { status: 403 })
  }

  // try/catch: si la migración de usuario_modulos aún no se ha corrido, no debe
  // romper el login — solo pvn/pvv/admin/usuario con módulo movimientos_tic lo necesitan.
  let modulos: string[] = []
  try {
    const modulosRows = await sql`SELECT modulo FROM usuario_modulos WHERE usuario_id = ${user.id}`
    modulos = modulosRows.map(r => r.modulo as string)
  } catch {}

  // Rastro del ingreso (quién, cuándo, desde qué IP): ver /auditoria
  await registrarInicioSesion({
    resultado: 'exitoso', usuarioId: user.id, username: user.username,
    canal: 'movil', ip, navegador: req.headers.get('user-agent'),
    motivo: factor === 'recuperacion' ? 'con código de recuperación' : factor === 'totp' ? 'con verificación en dos pasos' : undefined,
  })

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
