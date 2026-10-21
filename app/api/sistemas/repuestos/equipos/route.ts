import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import { canAccessRepuestos } from '@/lib/repuestos'

// GET /api/sistemas/repuestos/equipos?buscar= — buscador de equipos para ligar una salida.
// Va aparte de /api/sistemas/equipos para no exigir el módulo de Equipos TI.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!canAccessRepuestos(session)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const buscar = (new URL(req.url).searchParams.get('buscar') ?? '').trim()
  if (buscar.length < 2) return NextResponse.json([])
  const like = '%' + buscar + '%'

  const rows = await sql`
    SELECT id, tipo_equipo, marca, modelo, usuario_asignado, area_ubicacion
    FROM equipos_tecnologicos
    WHERE id ILIKE ${like} OR hostname ILIKE ${like} OR numero_serie ILIKE ${like}
       OR placa_activo ILIKE ${like} OR usuario_asignado ILIKE ${like}
    ORDER BY id
    LIMIT 15
  `
  return NextResponse.json(rows)
}
