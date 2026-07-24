import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import { tieneModulo } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const rol = session.user?.rol ?? ''
  if (!tieneModulo(rol, session.user?.modulos, 'cargar') && !tieneModulo(rol, session.user?.modulos, 'consulta')) {
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const fecha = searchParams.get('fecha')
  if (!fecha) return NextResponse.json([])

  const rows = await sql`
    SELECT DISTINCT tipo FROM inventario_datos 
    WHERE fecha = ${fecha} AND tipo IS NOT NULL AND tipo != ''
    ORDER BY tipo`

  return NextResponse.json(rows.map((r: any) => r.tipo))
}