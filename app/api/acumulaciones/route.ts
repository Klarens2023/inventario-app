import { NextRequest, NextResponse } from 'next/server'
import { exigirAcceso } from '@/lib/acceso'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'

// POST /api/acumulaciones — bloquea los IDs indicados
export async function POST(req: NextRequest) {
  const acceso = await exigirAcceso(req, { modulos: ['acumulados'] })
  if (!acceso.ok) return acceso.respuesta
  const { user } = acceso

  const { ids, fecha } = await req.json()
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Falta la lista de IDs' }, { status: 400 })
  }

  // Validar que todos los IDs sean enteros
  const idsValidos = ids.map((id: unknown) => parseInt(String(id))).filter(id => !isNaN(id))
  if (idsValidos.length !== ids.length) {
    return NextResponse.json({ error: 'IDs inválidos' }, { status: 400 })
  }

  // Si no es admin, verificar que solo acumule filas que él subió
  if (user.rol !== 'admin') {
    const userId = parseInt(user.id ?? '0')
    const filas = await sql`
      SELECT id, cargado_por FROM inventario_datos
      WHERE id = ANY(${idsValidos}::int[])
    `
    const noAutorizados = filas.filter(r => Number(r.cargado_por) !== userId)
    if (noAutorizados.length > 0) {
      return NextResponse.json({ error: 'No tienes permiso para acumular registros que no subiste' }, { status: 403 })
    }
  }

  await sql`
    UPDATE inventario_datos SET acumulado = true
    WHERE id = ANY(${idsValidos}::int[])
  `

  await logAudit({
    usuarioId: user.id ?? null,
    usuarioNombre: user.name ?? 'Desconocido',
    accion: 'CONTEO_ACUMULADO',
    descripcion: `Acumuló y bloqueó ${ids.length} registros del día ${fecha ?? ''}`,
    datos: { ids_count: ids.length, fecha },
  })

  return NextResponse.json({ ok: true })
}
