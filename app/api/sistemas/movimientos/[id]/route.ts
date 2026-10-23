import { NextRequest, NextResponse } from 'next/server'
import { exigirAcceso } from '@/lib/acceso'
import { getAuthUser } from '@/lib/api-auth'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { aUrlProxy } from '@/lib/google-drive'


// GET /api/sistemas/movimientos/[id] — getAuthUser (no solo sesión web) para
// que la app móvil también pueda consultar el movimiento antes de subir la foto.
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const acceso = await exigirAcceso(req, { modulos: ['movimientos_tic'], movil: true })
  if (!acceso.ok) return acceso.respuesta
  const { user } = acceso

  const [mov] = await sql`
    SELECT *, fecha::text AS fecha FROM tic_movimientos WHERE id = ${params.id}
  `
  if (!mov) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const activos = await sql`
    SELECT a.*, e.marca, e.modelo, e.numero_serie
    FROM tic_movimiento_activos a
    -- LEFT JOIN: la placa se puede escribir a mano (estibas, herramientas) y con JOIN
    -- ese activo desaparecía del detalle y del formato impreso.
    LEFT JOIN equipos_tecnologicos e ON e.id = a.equipo_id
    WHERE a.movimiento_id = ${params.id}
    ORDER BY a.id
  `

  return NextResponse.json(aUrlProxy({ ...mov, activos }, req.nextUrl.origin, 'foto_autorizacion_url'))
}

// PATCH /api/sistemas/movimientos/[id] — actualizar estado
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const acceso = await exigirAcceso(req, { modulos: ['movimientos_tic'] })
  if (!acceso.ok) return acceso.respuesta
  const { user } = acceso

  const { estado } = await req.json()
  const validos = ['autorizado', 'entregado', 'recibido', 'cerrado']
  if (!validos.includes(estado)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }

  const [upd] = await sql`
    UPDATE tic_movimientos SET estado = ${estado}
    WHERE id = ${params.id}
    RETURNING id, estado
  `
  if (!upd) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  await logAudit({
    usuarioId: user.id ?? null,
    usuarioNombre: user.name ?? 'Sistema',
    accion: 'TIC_MOVIMIENTO_ESTADO',
    descripcion: `Cambió estado de ${params.id} a "${estado}"`,
    datos: { id: params.id, estado },
  })

  return NextResponse.json(upd)
}
