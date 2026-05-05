import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const fecha = searchParams.get('fecha')
  if (!fecha) return NextResponse.json([])

  const rows = await sql`
    SELECT DISTINCT tipo FROM inventario_datos 
    WHERE fecha = ${fecha} AND tipo IS NOT NULL AND tipo != ''
    ORDER BY tipo`

  return NextResponse.json(rows.map((r: any) => r.tipo))
}