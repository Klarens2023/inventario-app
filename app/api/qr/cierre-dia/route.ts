import { NextRequest, NextResponse } from 'next/server'
import { exigirAcceso } from '@/lib/acceso'
import { hoyBogota } from '@/lib/fechas'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'


// POST /api/qr/cierre-dia — confirmación de cierre de turno (solo módulo QR).
// No bloquea nada: es un registro de auditoría con el resumen del día.
export async function POST(req: NextRequest) {
  const acceso = await exigirAcceso(req, { roles: ['pvn', 'pvv'], movil: true })
  if (!acceso.ok) return acceso.respuesta
  const { user } = acceso

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
