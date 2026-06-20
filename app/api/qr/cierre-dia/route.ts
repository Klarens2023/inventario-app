import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'

function hoyBogota(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

// POST /api/qr/cierre-dia — confirmación de cierre de turno (solo módulo QR).
// No bloquea nada: es un registro de auditoría con el resumen del día.
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!['pvn', 'pvv'].includes(user.rol)) {
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })
  }

  const hoy = hoyBogota()
  const [resumen] = await sql`
    SELECT COUNT(*)::int AS total_pagos, COALESCE(SUM(valor), 0) AS total_valor
    FROM pvn_pagos_qr
    WHERE usuario_id = ${parseInt(user.id)} AND fecha = ${hoy}::date
  `

  await logAudit({
    usuarioId: user.id,
    usuarioNombre: user.name,
    accion: 'PVN_QR_CIERRE_DIA',
    descripcion: `Cerró el día de pagos QR (${hoy}) — ${resumen.total_pagos} pagos, total ${resumen.total_valor}`,
    datos: { fecha: hoy, total_pagos: resumen.total_pagos, total_valor: resumen.total_valor },
  })

  return NextResponse.json({ ok: true, fecha: hoy, total_pagos: resumen.total_pagos, total_valor: Number(resumen.total_valor) })
}
