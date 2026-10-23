import { NextRequest, NextResponse } from 'next/server'
import { exigirAcceso } from '@/lib/acceso'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { MODULOS, modulosPorDefecto, type AreaInfo } from '@/lib/permissions'
import bcrypt from 'bcryptjs'
import { generarPasswordTemporal } from '@/lib/passwordTemporal'

const SELECT_CON_MODULOS = `
  SELECT u.id, u.username, u.nombre, u.rol, u.area, u.activo, u.debe_cambiar_password, u.created_at,
         u.punto_venta_id, pv.nombre AS punto_venta_nombre, u.acceso_movil,
         COALESCE(
           (SELECT json_agg(m.modulo) FROM usuario_modulos m WHERE m.usuario_id = u.id),
           '[]'
         ) AS modulos
  FROM usuarios u
  LEFT JOIN pvn_puntos_venta pv ON pv.id = u.punto_venta_id
`

// GET /api/usuarios
// admin → todos; lider → solo su área
// ?rol=pvn_pvv → todos los usuarios pvn/pvv sin importar área (los trabajadores
// de punto de venta viven en su propia área "puntos_venta", distinta a la de
// cualquier líder; el filtro de usuario en Pagos QR necesita verlos igual).
export async function GET(req: NextRequest) {
  const acceso = await exigirAcceso(req, { roles: ['admin', 'lider'] })
  if (!acceso.ok) return acceso.respuesta
  const { user } = acceso

  const rol = user.rol
  if (!['admin', 'lider'].includes(rol)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const soloPvnPvv = req.nextUrl.searchParams.get('rol') === 'pvn_pvv'

  let rows
  if (rol === 'admin') {
    rows = await sql(`${SELECT_CON_MODULOS} ORDER BY u.area, u.created_at DESC`, [])
  } else if (soloPvnPvv) {
    rows = await sql(`${SELECT_CON_MODULOS} WHERE u.rol IN ('pvn','pvv') ORDER BY u.area, u.created_at DESC`, [])
  } else {
    const area = user.area ?? 'logistica'
    rows = await sql(`${SELECT_CON_MODULOS} WHERE u.area = $1 ORDER BY u.created_at DESC`, [area])
  }
  return NextResponse.json(rows)
}

// POST /api/usuarios
// admin → cualquier área y rol; lider → solo su área, no puede crear admins
export async function POST(req: NextRequest) {
  const acceso = await exigirAcceso(req, { roles: ['admin', 'lider'] })
  if (!acceso.ok) return acceso.respuesta
  const { user } = acceso

  const rol = user.rol
  if (!['admin', 'lider'].includes(rol)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const { username, nombre, rol: rolNuevo, area: areaNueva, punto_venta_id: pvId, modulos: modulosBody, acceso_movil: accesoMovilBody } = await req.json()

  if (!username?.trim() || !nombre?.trim()) {
    return NextResponse.json({ error: 'Usuario y nombre son obligatorios' }, { status: 400 })
  }

  // AUD-16: un líder solo crea usuarios de rol usuario, pvn o pvv
  if (rol === 'lider' && ['admin', 'lider'].includes(rolNuevo)) {
    return NextResponse.json({ error: 'Solo un administrador puede crear administradores o líderes' }, { status: 403 })
  }

  const areaFinal = rol === 'admin' ? (areaNueva ?? 'logistica') : (user.area ?? 'logistica')
  const rolFinal  = ['admin', 'lider', 'usuario', 'pvn', 'pvv'].includes(rolNuevo) ? rolNuevo : 'usuario'
  // Por defecto pvn/pvv/usuario/admin entran a la app móvil y lider no,
  // pero el checkbox de Crear Usuario siempre puede sobreescribir esto.
  const accesoMovilFinal = typeof accesoMovilBody === 'boolean' ? accesoMovilBody : rolFinal !== 'lider'

  const existe = await sql`SELECT id FROM usuarios WHERE username = ${username.trim()} LIMIT 1`
  if (existe.length > 0) {
    return NextResponse.json({ error: 'El nombre de usuario ya existe' }, { status: 409 })
  }

  // Contraseña temporal aleatoria por usuario (antes "123456" para todos): se guarda
  // solo el hash y se devuelve en claro una única vez en esta respuesta.
  const passwordTemporal = generarPasswordTemporal()
  const hash = await bcrypt.hash(passwordTemporal, 10)

  const puntoVentaId = (['pvn', 'pvv'].includes(rolFinal) && pvId) ? parseInt(pvId) : null

  const [areaInfo] = await sql`SELECT * FROM areas WHERE key = ${areaFinal}`

  let modulosFinal: string[]
  if (Array.isArray(modulosBody)) {
    // Un líder solo puede conceder módulos ya habilitados para el área del
    // usuario nuevo (tabla `areas`); un admin puede darle cualquier módulo.
    if (rol === 'lider') {
      const info = areaInfo as AreaInfo | undefined
      const permitido = new Set([...(info?.modulos_usuario ?? []), ...(info?.modulos_lider ?? [])])
      modulosFinal = modulosBody.filter((m: string) => permitido.has(m))
    } else {
      modulosFinal = modulosBody
    }
  } else {
    modulosFinal = modulosPorDefecto(rolFinal, areaInfo as AreaInfo | undefined)
  }
  // Solo módulos que existen en el catálogo (antes se guardaba cualquier texto).
  modulosFinal = modulosFinal.filter(m => (MODULOS as readonly string[]).includes(m))

  // Usuario y módulos en una sola sentencia (AUD-22): antes eran un INSERT por
  // módulo y un fallo a mitad dejaba al usuario creado con módulos incompletos.
  let nuevo
  try {
    ;[nuevo] = await sql`
      WITH nuevo AS (
        INSERT INTO usuarios (username, password_hash, nombre, rol, area, activo, debe_cambiar_password, punto_venta_id, acceso_movil)
        VALUES (${username.trim()}, ${hash}, ${nombre.trim()}, ${rolFinal}, ${areaFinal}, true, true, ${puntoVentaId}, ${accesoMovilFinal})
        RETURNING id, username, nombre, rol, area, activo, debe_cambiar_password, created_at, acceso_movil
      ), mods AS (
        INSERT INTO usuario_modulos (usuario_id, modulo)
        SELECT nuevo.id, m FROM nuevo, unnest(${modulosFinal}::text[]) AS m
        ON CONFLICT DO NOTHING
      )
      SELECT * FROM nuevo
    `
  } catch (e) {
    // 23505: otro admin creó el mismo usuario entre el chequeo de arriba y este INSERT
    if ((e as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: 'El nombre de usuario ya existe' }, { status: 409 })
    }
    throw e
  }

  await logAudit({
    usuarioId: user.id ?? null,
    usuarioNombre: user.name ?? 'Desconocido',
    accion: 'USUARIO_CREADO',
    descripcion: `Creó el usuario "${nombre.trim()}" (${username.trim()}) — área: ${areaFinal}`,
    datos: { usuario_creado: username.trim(), rol: rolFinal, area: areaFinal },
  })

  // no-store: la respuesta lleva la contraseña temporal en claro
  return NextResponse.json({ ...nuevo, password_temporal: passwordTemporal }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}
