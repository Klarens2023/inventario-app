import { NextRequest, NextResponse } from 'next/server'
import { exigirAcceso } from '@/lib/acceso'
import { hoyBogota } from '@/lib/fechas'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'



// GET /api/qr/turno/activos — turnos abiertos ahora mismo, de cualquier usuario
export async function GET(req: NextRequest) {
  const acceso = await exigirAcceso(req, { modulos: ['pvn_pagos_qr'] })
  if (!acceso.ok) return acceso.respuesta
  const { user } = acceso
  const { rol, modulos } = user

  const turnos = await sql`
    SELECT id, usuario_id, usuario_nombre, punto_venta_id, punto_venta_nombre, fecha::text AS fecha, abierto_at
    FROM pvn_turnos
    WHERE activo = TRUE
    ORDER BY abierto_at ASC
  `
  return NextResponse.json(turnos)
}

// POST /api/qr/turno/activos { turno_id } — cierre forzado por un admin
export async function POST(req: NextRequest) {
  const acceso = await exigirAcceso(req, { roles: ['admin'] })
  if (!acceso.ok) return acceso.respuesta
  const { user } = acceso
  const { rol, name, id } = user

  const { turno_id } = await req.json()
  const turnoId = parseInt(turno_id)
  if (!turnoId) return NextResponse.json({ error: 'Falta turno_id' }, { status: 400 })

  const [turno] = await sql`
    UPDATE pvn_turnos
    SET activo = FALSE, cerrado_at = NOW(), fecha_cierre = ${hoyBogota()}::date
    WHERE id = ${turnoId} AND activo = TRUE
    RETURNING id, usuario_id, usuario_nombre, punto_venta_nombre, fecha::text AS fecha
  `
  if (!turno) return NextResponse.json({ error: 'Turno no encontrado o ya cerrado' }, { status: 404 })

  const [resumen] = await sql`
    SELECT COUNT(*)::int AS total_pagos, COALESCE(SUM(valor), 0) AS total_valor
    FROM pvn_pagos_qr
    WHERE turno_id = ${turnoId}
  `

  await logAudit({
    usuarioId: id,
    usuarioNombre: name,
    accion: 'PVN_TURNO_CERRADO',
    descripcion: `Admin cerró el turno de ${turno.usuario_nombre} en ${turno.punto_venta_nombre} — ${resumen.total_pagos} pagos, total ${resumen.total_valor}`,
    datos: { usuario_afectado: turno.usuario_nombre, punto_venta: turno.punto_venta_nombre, fecha: turno.fecha, total_pagos: resumen.total_pagos, total_valor: resumen.total_valor, cerrado_por_admin: true },
  })

  return NextResponse.json({ ok: true })
}
