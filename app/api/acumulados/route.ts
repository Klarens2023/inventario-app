import { NextRequest, NextResponse } from 'next/server'
import { exigirAcceso } from '@/lib/acceso'
import { sql } from '@/lib/db'

export async function GET(req: NextRequest) {
  const acceso = await exigirAcceso(req, { modulos: ['acumulados'] })
  if (!acceso.ok) return acceso.respuesta
  const { user } = acceso

  const { searchParams } = new URL(req.url)
  const desde = searchParams.get('desde') || null
  const hasta  = searchParams.get('hasta') || null
  const modo   = searchParams.get('modo') || 'items'

  let rows: Record<string, unknown>[]

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
