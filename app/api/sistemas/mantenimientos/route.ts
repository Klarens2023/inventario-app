import { NextRequest, NextResponse } from 'next/server'
import { exigirAcceso } from '@/lib/acceso'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'


// GET /api/sistemas/mantenimientos — equipos con mantenimiento programado, ordenados por próxima fecha
export async function GET(req: NextRequest) {
  const acceso = await exigirAcceso(req, { modulos: ['equipos'] })
  if (!acceso.ok) return acceso.respuesta
  const { user } = acceso

  const { searchParams } = new URL(req.url)
  const buscar = searchParams.get('buscar') ?? ''

  const rows = await sql`
    SELECT
      id, tipo_equipo, marca, modelo, sede, area_ubicacion, responsable, estado,
      tipo_mantenimiento, frecuencia_mantenimiento, tecnico_responsable,
      ultimo_mantenimiento::text AS ultimo_mantenimiento,
      proximo_mantenimiento::text AS proximo_mantenimiento
    FROM equipos_tecnologicos
    WHERE (ultimo_mantenimiento IS NOT NULL OR proximo_mantenimiento IS NOT NULL)
      AND (${buscar} = '' OR
        id ILIKE ${'%' + buscar + '%'} OR
        marca ILIKE ${'%' + buscar + '%'} OR
        modelo ILIKE ${'%' + buscar + '%'} OR
        responsable ILIKE ${'%' + buscar + '%'}
      )
    ORDER BY proximo_mantenimiento ASC NULLS LAST
  `
  return NextResponse.json(rows)
}

// POST /api/sistemas/mantenimientos — registrar si un mantenimiento programado se realizó o no
export async function POST(req: NextRequest) {
  const acceso = await exigirAcceso(req, { modulos: ['equipos'] })
  if (!acceso.ok) return acceso.respuesta
  const { user } = acceso

  const body = await req.json()
  const { equipo_id, fecha, realizado } = body

  if (!equipo_id || !fecha || typeof realizado !== 'boolean') {
    return NextResponse.json({ error: 'equipo_id, fecha y realizado son obligatorios' }, { status: 400 })
  }

  const [equipo] = await sql`SELECT id FROM equipos_tecnologicos WHERE id = ${equipo_id}`
  if (!equipo) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })

  const [registro] = await sql`
    INSERT INTO equipos_mantenimientos (equipo_id, fecha, tipo, descripcion, tecnico, proxima_fecha, observaciones, realizado)
    VALUES (${equipo_id}, ${fecha}, ${'Preventivo'}, ${body.descripcion || null},
            ${body.tecnico || null}, ${body.proxima_fecha || null}, ${body.observaciones || null}, ${realizado})
    RETURNING *
  `

  if (realizado) {
    await sql`
      UPDATE equipos_tecnologicos SET
        ultimo_mantenimiento = ${fecha}::date,
        proximo_mantenimiento = COALESCE(${body.proxima_fecha || null}::date, proximo_mantenimiento),
        tecnico_responsable = COALESCE(${body.tecnico || null}, tecnico_responsable)
      WHERE id = ${equipo_id}
    `
  } else if (body.proxima_fecha) {
    await sql`UPDATE equipos_tecnologicos SET proximo_mantenimiento = ${body.proxima_fecha}::date WHERE id = ${equipo_id}`
  }

  await logAudit({
    usuarioId: user.id ?? null,
    usuarioNombre: user.name ?? 'Desconocido',
    accion: realizado ? 'MANTENIMIENTO_REALIZADO' : 'MANTENIMIENTO_NO_REALIZADO',
    descripcion: `${realizado ? 'Registró mantenimiento realizado' : 'Registró mantenimiento NO realizado'} en equipo ${equipo_id}`,
    datos: { equipo_id, fecha, realizado },
  })

  return NextResponse.json(registro, { status: 201 })
}
