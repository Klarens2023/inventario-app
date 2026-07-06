import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import { tieneModulo } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'

function canAccess(session: { user?: { rol?: string; modulos?: string[] } } | null) {
  if (!session?.user) return false
  return tieneModulo(session.user.rol ?? '', session.user.modulos, 'movimientos_tic')
}

async function generarId(): Promise<string> {
  const rows = await sql`SELECT id FROM tic_movimientos ORDER BY id DESC LIMIT 1`
  if (rows.length === 0) return 'TIC-0001'
  const last = (rows[0].id as string).replace('TIC-', '')
  return `TIC-${String(parseInt(last, 10) + 1).padStart(4, '0')}`
}

// GET /api/sistemas/movimientos
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!canAccess(session)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const buscar = searchParams.get('buscar') ?? ''
  const estado = searchParams.get('estado') ?? ''
  const desde  = searchParams.get('desde') || null
  const hasta  = searchParams.get('hasta') || null

  try {
    const like = '%' + buscar + '%'
    const movimientos = await sql(
      `SELECT
        m.id, m.fecha::text AS fecha, m.movimiento, m.tipo_movimiento, m.motivo,
        m.origen_nombre, m.origen_area, m.destino_nombre, m.destino_area,
        m.estado, m.registrado_por, m.created_at,
        COUNT(a.id)::int AS total_activos
      FROM tic_movimientos m
      LEFT JOIN tic_movimiento_activos a ON a.movimiento_id = m.id
      WHERE
        ($1 = '' OR m.id ILIKE $2 OR m.origen_nombre ILIKE $2
          OR m.destino_nombre ILIKE $2 OR m.tipo_movimiento ILIKE $2)
        AND ($3 = '' OR m.estado = $3)
        AND ($4::text IS NULL OR m.fecha >= $4::date)
        AND ($5::text IS NULL OR m.fecha <= $5::date)
      GROUP BY m.id
      ORDER BY m.created_at DESC
      LIMIT 200`,
      [buscar, like, estado, desde, hasta]
    )
    return NextResponse.json(movimientos)
  } catch (e) {
    console.error('[movimientos GET]', e)
    return NextResponse.json({ error: 'Error al consultar movimientos' }, { status: 500 })
  }
}

// POST /api/sistemas/movimientos
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!canAccess(session)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const body = await req.json()
  const {
    fecha, movimiento, tipo_movimiento, motivo,
    origen_nombre, origen_documento, origen_area,
    destino_nombre, destino_documento, destino_area,
    observaciones, activos,
  } = body

  if (!fecha || !movimiento || !tipo_movimiento || !motivo) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
  }
  if (!origen_nombre || !origen_documento || !origen_area) {
    return NextResponse.json({ error: 'Datos de origen incompletos' }, { status: 400 })
  }
  if (!destino_nombre || !destino_documento || !destino_area) {
    return NextResponse.json({ error: 'Datos de destino incompletos' }, { status: 400 })
  }
  if (!Array.isArray(activos) || activos.length === 0) {
    return NextResponse.json({ error: 'Debes agregar al menos un activo' }, { status: 400 })
  }

  const id = await generarId()
  const registradoPor = session.user?.name ?? 'Sistema'

  await sql`
    INSERT INTO tic_movimientos
      (id, fecha, movimiento, tipo_movimiento, motivo,
       origen_nombre, origen_documento, origen_area,
       destino_nombre, destino_documento, destino_area,
       observaciones, registrado_por)
    VALUES
      (${id}, ${fecha}::date, ${movimiento}, ${tipo_movimiento}, ${motivo},
       ${origen_nombre}, ${origen_documento}, ${origen_area},
       ${destino_nombre}, ${destino_documento}, ${destino_area},
       ${observaciones ?? null}, ${registradoPor})
  `

  for (const a of activos) {
    await sql`
      INSERT INTO tic_movimiento_activos (movimiento_id, equipo_id, descripcion, tipo_activo, cantidad)
      VALUES (${id}, ${a.equipo_id}, ${a.descripcion}, ${a.tipo_activo}, ${a.cantidad ?? 1})
    `
  }

  await logAudit({
    usuarioId: session.user?.id ?? null,
    usuarioNombre: registradoPor,
    accion: 'TIC_MOVIMIENTO_CREADO',
    descripcion: `Creó movimiento ${id} (${tipo_movimiento}) — ${activos.length} activo(s)`,
    datos: { id, tipo_movimiento, motivo, origen_area, destino_area },
  })

  return NextResponse.json({ id }, { status: 201 })
}
