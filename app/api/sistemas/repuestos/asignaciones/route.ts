import { NextRequest, NextResponse } from 'next/server'
import { exigirAcceso } from '@/lib/acceso'
import { sql } from '@/lib/db'
import { faltaMigracion, MSG_FALTA_MIGRACION } from '@/lib/repuestos'

// GET /api/sistemas/repuestos/asignaciones
// ?estado=vigente|cerrada (vacío = todas) · ?equipo_id= · ?buscar= · ?vencidos=1 (préstamos vencidos)
export async function GET(req: NextRequest) {
  const acceso = await exigirAcceso(req, { modulos: ['repuestos_tic'] })
  if (!acceso.ok) return acceso.respuesta

  const { searchParams } = new URL(req.url)
  const estado   = searchParams.get('estado') ?? ''
  const equipoId = searchParams.get('equipo_id') ?? ''
  const buscar   = searchParams.get('buscar') ?? ''
  const vencidos = searchParams.get('vencidos') === '1'

  try {
    const like = '%' + buscar + '%'
    const rows = await sql(
      `SELECT s.id, s.articulo_codigo, a.descripcion, a.tipo, a.categoria, a.unidad, s.cantidad,
              s.equipo_id, e.tipo_equipo, e.marca AS equipo_marca, e.modelo AS equipo_modelo,
              s.persona_nombre, s.persona_area, s.es_prestamo,
              s.fecha_asignacion::text AS fecha_asignacion, s.fecha_limite_prestamo::text AS fecha_limite_prestamo,
              s.observaciones, s.estado, s.destino_retiro, s.fecha_retiro::text AS fecha_retiro,
              s.motivo_retiro, s.detalle_retiro, s.reemplaza_a, s.reemplazada_por,
              r.articulo_codigo AS reemplazada_por_codigo, ra.descripcion AS reemplazada_por_descripcion,
              s.registrado_por, s.cerrado_por,
              (s.estado = 'vigente' AND s.es_prestamo AND s.fecha_limite_prestamo < CURRENT_DATE) AS vencido
       FROM tic_articulo_asignaciones s
       JOIN tic_articulos a ON a.codigo = s.articulo_codigo
       LEFT JOIN equipos_tecnologicos e ON e.id = s.equipo_id
       LEFT JOIN tic_articulo_asignaciones r ON r.id = s.reemplazada_por
       LEFT JOIN tic_articulos ra ON ra.codigo = r.articulo_codigo
       WHERE ($1 = '' OR ($1 = 'vigente' AND s.estado = 'vigente') OR ($1 = 'cerrada' AND s.estado <> 'vigente'))
         AND ($2 = '' OR s.equipo_id = $2)
         AND ($3 = '' OR a.descripcion ILIKE $4 OR s.articulo_codigo ILIKE $4 OR s.equipo_id ILIKE $4
              OR s.persona_nombre ILIKE $4 OR s.persona_area ILIKE $4 OR a.tipo ILIKE $4)
         AND (NOT $5 OR (s.estado = 'vigente' AND s.es_prestamo AND s.fecha_limite_prestamo < CURRENT_DATE))
       ORDER BY (s.estado = 'vigente') DESC, s.fecha_asignacion DESC, s.id DESC
       LIMIT 500`,
      [estado, equipoId, buscar, like, vencidos]
    )
    return NextResponse.json(rows)
  } catch (e) {
    if (faltaMigracion(e)) return NextResponse.json({ error: MSG_FALTA_MIGRACION, falta_migracion: true }, { status: 503 })
    console.error('[asignaciones GET]', e)
    return NextResponse.json({ error: 'Error al consultar asignaciones' }, { status: 500 })
  }
}
