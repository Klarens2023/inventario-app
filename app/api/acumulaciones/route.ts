import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'

// POST /api/acumulaciones — bloquea una fecha para que no se pueda editar
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { fecha } = await req.json()
  if (!fecha) return NextResponse.json({ error: 'Falta la fecha' }, { status: 400 })

  // Marcar todos los registros de esa fecha como acumulados
  await sql`
    UPDATE inventario_datos SET acumulado = true
    WHERE fecha = ${fecha}
  `

  await logAudit({
    usuarioId: session.user?.id ?? null,
    usuarioNombre: session.user?.name ?? 'Desconocido',
    accion: 'CONTEO_ACUMULADO',
    descripcion: `Acumuló y bloqueó el conteo del día ${fecha}`,
    datos: { fecha },
  })

  return NextResponse.json({ ok: true, bloqueado: true })
}
