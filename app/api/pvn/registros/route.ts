import { NextRequest, NextResponse } from 'next/server'
import { exigirAcceso } from '@/lib/acceso'
import { hoyBogota } from '@/lib/fechas'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { tieneModulo } from '@/lib/permissions'


const SELECT_SQL = `
  SELECT r.id, r.fecha::text AS fecha, r.turno, r.usuario_nombre, r.observaciones, r.created_at,
         r.punto_venta_id, r.punto_venta_nombre,
         COALESCE(SUM(d.cantidad), 0)::int AS total_unidades,
         COUNT(d.id)::int AS total_productos,
         COALESCE(
           json_agg(
             json_build_object(
               'producto_id', d.producto_id,
               'producto_nombre', d.producto_nombre,
               'cantidad', d.cantidad
             ) ORDER BY d.producto_nombre
           ) FILTER (WHERE d.id IS NOT NULL),
           '[]'
         ) AS detalle
  FROM pvn_registros r
  LEFT JOIN pvn_registros_detalle d ON d.registro_id = r.id
`

export async function GET(req: NextRequest) {
  const acceso = await exigirAcceso(req, { roles: ['pvn'], modulos: ['pvn_historial'], movil: true })
  if (!acceso.ok) return acceso.respuesta
  const { user } = acceso

  const { rol, modulos } = user
  const { searchParams } = req.nextUrl
  const desde = searchParams.get('desde')
  const hasta  = searchParams.get('hasta')
  const pvnId  = searchParams.get('punto_venta_id')

  if (rol === 'pvn') {
    const rows = await sql(
      `${SELECT_SQL}
       WHERE r.usuario_id = $1
       GROUP BY r.id
       ORDER BY r.fecha DESC, r.created_at DESC
       LIMIT 30`,
      [parseInt(user.id)]
    )
    return NextResponse.json(rows)
  }

  if (!tieneModulo(rol, modulos, 'pvn_historial')) {
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })
  }

  const desdeVal    = desde ?? null
  const hastaVal    = hasta ?? null
  const pvnIdVal    = pvnId ? parseInt(pvnId) : null
  const hasDateRange = !!(desde && hasta)

  const rows = await sql(
    `${SELECT_SQL}
     WHERE ($1::date IS NULL OR r.fecha >= $1::date)
       AND ($2::date IS NULL OR r.fecha <= $2::date)
       AND ($3::int IS NULL OR r.punto_venta_id = $3::int)
     GROUP BY r.id
     ORDER BY r.fecha DESC, r.created_at DESC
     ${hasDateRange ? '' : 'LIMIT 100'}`,
    [desdeVal, hastaVal, pvnIdVal]
  )
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const acceso = await exigirAcceso(req, { roles: ['pvn', 'admin', 'lider'], movil: true })
  if (!acceso.ok) return acceso.respuesta
  const { user } = acceso

  const { rol } = user
  if (!['pvn', 'admin', 'lider'].includes(rol)) {
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })
  }

  const body = await req.json()
  const { fecha, turno, observaciones, detalle } = body as {
    fecha?: string
    turno: string
    observaciones?: string
    detalle: Array<{ producto_id: number; producto_nombre: string; cantidad: number }>
  }

  if (!turno) return NextResponse.json({ error: 'El turno es obligatorio' }, { status: 400 })
  // Number(): la app móvil puede enviar los números como texto ("3"), como antes se aceptaba.
  const items = (Array.isArray(detalle) ? detalle : [])
    .map(d => ({ producto_id: Number(d?.producto_id), producto_nombre: String(d?.producto_nombre ?? ''), cantidad: Number(d?.cantidad) }))
    .filter(d => d.cantidad > 0)
  if (items.length === 0) return NextResponse.json({ error: 'Registra al menos un producto vendido' }, { status: 400 })
  // Rango de INTEGER de PostgreSQL: un valor mayor hacía fallar el INSERT con un 500.
  const MAX_INT = 2_147_483_647
  if (items.some(d => !Number.isInteger(d.cantidad) || !Number.isInteger(d.producto_id) || d.cantidad > MAX_INT || d.producto_id <= 0 || d.producto_id > MAX_INT)) {
    return NextResponse.json({ error: 'Detalle inválido: cantidades y productos deben ser números enteros' }, { status: 400 })
  }

  const hoy = hoyBogota()
  // pvn solo puede registrar el día en curso (hora Colombia)
  if (rol === 'pvn' && fecha && fecha !== hoy) {
    return NextResponse.json({ error: `Solo puedes registrar ventas del día de hoy (${hoy})` }, { status: 400 })
  }
  const fechaFinal = rol === 'pvn' ? hoy : (fecha ?? hoy)

  const dup = await sql`
    SELECT id FROM pvn_registros
    WHERE usuario_id = ${parseInt(user.id)}
      AND fecha = ${fechaFinal}::date AND turno = ${turno}
    LIMIT 1
  `
  if (dup.length > 0) {
    return NextResponse.json({ error: `Ya existe un registro para el ${fechaFinal} en el turno ${turno}` }, { status: 409 })
  }

  const [userInfo] = await sql`
    SELECT u.punto_venta_id, pv.nombre AS punto_venta_nombre
    FROM usuarios u
    LEFT JOIN pvn_puntos_venta pv ON pv.id = u.punto_venta_id
    WHERE u.id = ${parseInt(user.id)}
    LIMIT 1
  `

  // Encabezado y detalle en una sola sentencia (CTE): antes eran un INSERT por
  // producto y, si uno fallaba, quedaba un registro sin detalle que además
  // bloqueaba reintentar (el chequeo de duplicado de arriba ya lo encontraba).
  let registro
  try {
    ;[registro] = await sql`
      WITH reg AS (
        INSERT INTO pvn_registros (usuario_id, usuario_nombre, fecha, turno, observaciones, punto_venta_id, punto_venta_nombre)
        VALUES (
          ${parseInt(user.id)},
          ${user.name ?? 'PVN'},
          ${fechaFinal}::date,
          ${turno},
          ${observaciones ?? null},
          ${userInfo?.punto_venta_id ?? null},
          ${userInfo?.punto_venta_nombre ?? null}
        )
        RETURNING id
      ), det AS (
        INSERT INTO pvn_registros_detalle (registro_id, producto_id, producto_nombre, cantidad)
        SELECT reg.id, d.pid, d.pnom, d.cant
        FROM reg, unnest(${items.map(i => i.producto_id)}::int[], ${items.map(i => i.producto_nombre)}::text[],
                         ${items.map(i => i.cantidad)}::int[]) AS d(pid, pnom, cant)
      )
      SELECT id FROM reg
    `
  } catch (e) {
    // 23505 = ux_pvn_registros_turno (scripts/migrate-add-indices-unicos.js): envío doble simultáneo
    if ((e as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: `Ya existe un registro para el ${fechaFinal} en el turno ${turno}` }, { status: 409 })
    }
    throw e
  }

  await logAudit({
    usuarioId: user.id ?? null,
    usuarioNombre: user.name ?? 'PVN',
    accion: 'PVN_REGISTRO_CREADO',
    descripcion: `Registró ventas del ${fechaFinal} (${turno}) — ${items.length} productos, ${items.reduce((s, d) => s + d.cantidad, 0)} unidades`,
    datos: { fecha: fechaFinal, turno, productos: items.length, punto_venta: userInfo?.punto_venta_nombre },
  })

  return NextResponse.json({ id: registro.id }, { status: 201 })
}
