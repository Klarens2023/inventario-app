import { NextRequest, NextResponse } from 'next/server'
import { exigirAcceso } from '@/lib/acceso'
import { sql } from '@/lib/db'

export async function GET(req: NextRequest) {
  const acceso = await exigirAcceso(req, { modulos: ['cargar', 'consulta'] })
  if (!acceso.ok) return acceso.respuesta

  const { searchParams } = new URL(req.url)
  const fecha = searchParams.get('fecha')
  if (!fecha) return NextResponse.json([])

  const rows = await sql`
    SELECT DISTINCT tipo FROM inventario_datos 
    WHERE fecha = ${fecha} AND tipo IS NOT NULL AND tipo != ''
    ORDER BY tipo`

  return NextResponse.json(rows.map(r => r.tipo as string))
}