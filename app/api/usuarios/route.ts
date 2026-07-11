import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { modulosPorDefecto } from '@/lib/permissions'
import bcrypt from 'bcryptjs'

const PASSWORD_GENERICA = '123456'

const SELECT_CON_MODULOS = `
  SELECT u.id, u.username, u.nombre, u.rol, u.area, u.activo, u.debe_cambiar_password, u.created_at,
         u.punto_venta_id, pv.nombre AS punto_venta_nombre,
         COALESCE(
           (SELECT json_agg(m.modulo) FROM usuario_modulos m WHERE m.usuario_id = u.id),
           '[]'
         ) AS modulos
  FROM usuarios u
  LEFT JOIN pvn_puntos_venta pv ON pv.id = u.punto_venta_id
`

// GET /api/usuarios
// admin → todos; lider → solo su área
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const rol = session.user?.rol
  if (!['admin', 'lider'].includes(rol)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  let rows
  if (rol === 'admin') {
    rows = await sql(`${SELECT_CON_MODULOS} ORDER BY u.area, u.created_at DESC`, [])
  } else {
    const area = session.user?.area ?? 'logistica'
    rows = await sql(`${SELECT_CON_MODULOS} WHERE u.area = $1 ORDER BY u.created_at DESC`, [area])
  }
  return NextResponse.json(rows)
}

// POST /api/usuarios
// admin → cualquier área y rol; lider → solo su área, no puede crear admins
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const rol = session.user?.rol
  if (!['admin', 'lider'].includes(rol)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const { username, nombre, rol: rolNuevo, area: areaNueva, punto_venta_id: pvId, modulos: modulosBody } = await req.json()

  if (!username?.trim() || !nombre?.trim()) {
    return NextResponse.json({ error: 'Usuario y nombre son obligatorios' }, { status: 400 })
  }

  if (rol === 'lider' && rolNuevo === 'admin') {
    return NextResponse.json({ error: 'No tienes permiso para crear administradores' }, { status: 403 })
  }

  const areaFinal = rol === 'admin' ? (areaNueva ?? 'logistica') : (session.user?.area ?? 'logistica')
  const rolFinal  = ['admin', 'lider', 'usuario', 'pvn', 'pvv'].includes(rolNuevo) ? rolNuevo : 'usuario'

  const existe = await sql`SELECT id FROM usuarios WHERE username = ${username.trim()} LIMIT 1`
  if (existe.length > 0) {
    return NextResponse.json({ error: 'El nombre de usuario ya existe' }, { status: 409 })
  }

  const hash = await bcrypt.hash(PASSWORD_GENERICA, 10)

  const puntoVentaId = (['pvn', 'pvv'].includes(rolFinal) && pvId) ? parseInt(pvId) : null

  const [nuevo] = await sql`
    INSERT INTO usuarios (username, password_hash, nombre, rol, area, activo, debe_cambiar_password, punto_venta_id)
    VALUES (${username.trim()}, ${hash}, ${nombre.trim()}, ${rolFinal}, ${areaFinal}, true, true, ${puntoVentaId})
    RETURNING id, username, nombre, rol, area, activo, debe_cambiar_password, created_at
  `

  const modulosFinal: string[] = Array.isArray(modulosBody) ? modulosBody : modulosPorDefecto(rolFinal, areaFinal)
  for (const m of modulosFinal) {
    await sql`INSERT INTO usuario_modulos (usuario_id, modulo) VALUES (${nuevo.id}, ${m}) ON CONFLICT DO NOTHING`
  }

  await logAudit({
    usuarioId: session.user?.id ?? null,
    usuarioNombre: session.user?.name ?? 'Desconocido',
    accion: 'USUARIO_CREADO',
    descripcion: `Creó el usuario "${nombre.trim()}" (${username.trim()}) — área: ${areaFinal}`,
    datos: { usuario_creado: username.trim(), rol: rolFinal, area: areaFinal },
  })

  return NextResponse.json(nuevo, { status: 201 })
}
