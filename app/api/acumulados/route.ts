import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import { tieneModulo } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!tieneModulo(session.user?.rol ?? '', session.user?.modulos, 'acumulados')) {
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const desde = searchParams.get('desde') || null
  const hasta  = searchParams.get('hasta') || null
  const modo   = searchParams.get('modo') || 'items'

  let rows: any[]

  if (desde && hasta) {
    rows = await sql`
      SELECT * FROM vista_acumulados
      WHERE fecha BETWEEN ${desde} AND ${hasta}
        AND modo = ${modo}
      ORDER BY fecha DESC, referencia`
  } else {
    rows = await sql`
      SELECT * FROM vista_acumulados
      WHERE modo = ${modo}
      ORDER BY fecha DESC, referencia`
  }

  const totales = {
    costo_bodega:     rows.reduce((s, r) => s + Number(r.costo_bodega_total ?? 0), 0),
    costo_diferencia: rows.reduce((s, r) => s + Number(r.costo_diferencia   ?? 0), 0),
  }

  return NextResponse.json({ rows, totales })
}
