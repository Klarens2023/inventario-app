import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { tieneModulo } from '@/lib/permissions'

function puedeVer(rol: string, modulos: string[]) {
  return rol === 'admin' || tieneModulo(rol, modulos, 'pvn_pagos_qr')
}

// GET /api/qr/turno/activos — turnos abiertos ahora mismo, de cualquier usuario
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { rol, modulos } = session.user
  if (!puedeVer(rol, modulos ?? [])) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

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
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { rol, name, id } = session.user
  if (rol !== 'admin') return NextResponse.json({ error: 'Solo un administrador puede cerrar el turno de otro usuario' }, { status: 403 })

  const { turno_id } = await req.json()
  const turnoId = parseInt(turno_id)
  if (!turnoId) return NextResponse.json({ error: 'Falta turno_id' }, { status: 400 })

  const [turno] = await sql`
    UPDATE pvn_turnos
    SET activo = FALSE, cerrado_at = NOW()
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
