import { NextRequest, NextResponse } from 'next/server'
import { exigirAcceso } from '@/lib/acceso'
import { sql } from '@/lib/db'
import { canAccessRepuestos, MOTIVO_RETORNO, esFecha, faltaMigracion, MSG_FALTA_MIGRACION } from '@/lib/repuestos'

// Movimientos que representan gasto: toda salida (consumo, asignación, reemplazo, baja) y, restando,
// lo que regresó al inventario desde una asignación. Gasto = unidades × costo vigente en ese momento.
// $1 desde · $2 hasta · $3 categoría · $4 equipo · $5 área · $6.. motivos de retorno
const BASE = `
  WITH neto AS (
    SELECT m.id, m.fecha, m.articulo_codigo, a.descripcion, a.tipo AS tipo_articulo, a.categoria, a.unidad,
           m.equipo_id, m.motivo, m.tipo,
           COALESCE(NULLIF(e.area_ubicacion, ''), NULLIF(m.destino_area, ''), 'Sin área') AS area,
           m.destino_nombre, m.registrado_por, m.costo_unitario, m.contador_paginas,
           -m.cantidad AS unidades,
           -m.cantidad * COALESCE(m.costo_unitario, 0) AS gasto,
           (m.costo_unitario IS NULL) AS sin_costo
    FROM tic_articulo_movimientos m
    JOIN tic_articulos a ON a.codigo = m.articulo_codigo
    LEFT JOIN equipos_tecnologicos e ON e.id = m.equipo_id
    WHERE (m.tipo = 'salida' OR (m.tipo = 'entrada' AND m.motivo = ANY($6::text[])))
      AND m.fecha BETWEEN $1::date AND $2::date
      AND ($3 = '' OR a.categoria = $3)
      AND ($4 = '' OR m.equipo_id = $4)
      AND ($5 = '' OR COALESCE(NULLIF(e.area_ubicacion, ''), NULLIF(m.destino_area, ''), 'Sin área') = $5)
  )`

// GET /api/sistemas/repuestos/consumo?desde=&hasta=&categoria=&equipo_id=&area=
export async function GET(req: NextRequest) {
  const acceso = await exigirAcceso(req, { modulos: ['repuestos_tic'] })
  if (!acceso.ok) return acceso.respuesta
  const { user } = acceso

  const sp = new URL(req.url).searchParams
  const desde = sp.get('desde') ?? ''
  const hasta = sp.get('hasta') ?? ''
  if (!esFecha(desde) || !esFecha(hasta) || desde > hasta) {
    return NextResponse.json({ error: 'Rango de fechas inválido' }, { status: 400 })
  }
  const params = [desde, hasta, sp.get('categoria') ?? '', sp.get('equipo_id') ?? '', sp.get('area') ?? '',
                  Object.values(MOTIVO_RETORNO)]

  try {
    const [resumen, porEquipo, porArea, porArticulo, porMes, rendimiento] = await Promise.all([
      sql(`${BASE}
        SELECT COALESCE(SUM(gasto), 0)::float AS gasto,
               COALESCE(SUM(unidades), 0)::int AS unidades,
               COUNT(*) FILTER (WHERE tipo = 'salida')::int AS salidas,
               COUNT(DISTINCT equipo_id)::int AS equipos,
               COUNT(*) FILTER (WHERE sin_costo AND tipo = 'salida')::int AS sin_costo
        FROM neto`, params),

      sql(`${BASE}
        SELECT n.equipo_id, e.tipo_equipo, e.marca, e.modelo, e.usuario_asignado,
               MAX(n.area) AS area,
               SUM(n.unidades)::int AS unidades, SUM(n.gasto)::float AS gasto,
               COUNT(*) FILTER (WHERE n.tipo = 'salida')::int AS salidas,
               MAX(n.fecha)::text AS ultimo,
               STRING_AGG(DISTINCT n.tipo_articulo, ', ') AS tipos
        FROM neto n
        LEFT JOIN equipos_tecnologicos e ON e.id = n.equipo_id
        GROUP BY n.equipo_id, e.tipo_equipo, e.marca, e.modelo, e.usuario_asignado
        ORDER BY SUM(n.gasto) DESC, SUM(n.unidades) DESC`, params),

      sql(`${BASE}
        SELECT area, SUM(unidades)::int AS unidades, SUM(gasto)::float AS gasto,
               COUNT(DISTINCT equipo_id)::int AS equipos
        FROM neto GROUP BY area ORDER BY SUM(gasto) DESC, SUM(unidades) DESC`, params),

      sql(`${BASE}
        SELECT articulo_codigo, descripcion, tipo_articulo, categoria, unidad,
               SUM(unidades)::int AS unidades, SUM(gasto)::float AS gasto,
               COUNT(DISTINCT equipo_id)::int AS equipos
        FROM neto GROUP BY articulo_codigo, descripcion, tipo_articulo, categoria, unidad
        ORDER BY SUM(gasto) DESC, SUM(unidades) DESC`, params),

      sql(`${BASE}
        SELECT to_char(fecha, 'YYYY-MM') AS mes,
               SUM(unidades) FILTER (WHERE categoria = 'Insumo')::int     AS insumos,
               SUM(unidades) FILTER (WHERE categoria = 'Repuesto')::int   AS repuestos,
               SUM(unidades) FILTER (WHERE categoria = 'Periférico')::int AS perifericos,
               SUM(gasto)::float AS gasto
        FROM neto GROUP BY 1 ORDER BY 1`, params),

      // Rendimiento real de tóner/tinta: páginas impresas entre un cambio y el siguiente del mismo
      // insumo en la misma impresora. El costo por página usa el insumo que se retiró (el anterior).
      sql(`
        WITH cambios AS (
          SELECT m.equipo_id, m.articulo_codigo, a.descripcion, m.fecha, m.contador_paginas,
                 LAG(m.contador_paginas) OVER w AS contador_prev,
                 LAG(m.fecha) OVER w AS fecha_prev,
                 LAG(-m.cantidad * m.costo_unitario) OVER w AS costo_prev
          FROM tic_articulo_movimientos m
          JOIN tic_articulos a ON a.codigo = m.articulo_codigo
          WHERE m.tipo = 'salida' AND m.contador_paginas IS NOT NULL AND m.equipo_id IS NOT NULL
            AND ($3 = '' OR a.categoria = $3) AND ($4 = '' OR m.equipo_id = $4)
          WINDOW w AS (PARTITION BY m.equipo_id, m.articulo_codigo ORDER BY m.fecha, m.id)
        )
        SELECT c.equipo_id, e.marca, e.modelo, c.articulo_codigo, c.descripcion,
               COUNT(*)::int AS cambios,
               ROUND(AVG(c.contador_paginas - c.contador_prev))::int AS paginas_promedio,
               ROUND(AVG(c.fecha - c.fecha_prev))::int AS dias_promedio,
               CASE WHEN SUM(c.contador_paginas - c.contador_prev) > 0 AND COUNT(c.costo_prev) = COUNT(*)
                    THEN (SUM(c.costo_prev) / SUM(c.contador_paginas - c.contador_prev))::float END AS costo_pagina,
               MAX(c.contador_paginas)::int AS ultimo_contador
        FROM cambios c
        LEFT JOIN equipos_tecnologicos e ON e.id = c.equipo_id
        WHERE c.contador_prev IS NOT NULL AND c.contador_paginas >= c.contador_prev
          AND c.fecha BETWEEN $1::date AND $2::date
          AND ($5 = '' OR e.area_ubicacion = $5)
        GROUP BY c.equipo_id, e.marca, e.modelo, c.articulo_codigo, c.descripcion
        ORDER BY c.equipo_id`, params.slice(0, 5)),
    ])

    // Detalle fila por fila solo para la exportación a Excel (tablas dinámicas)
    const detalle = sp.get('detalle') === '1' ? await sql(`${BASE}
      SELECT fecha::text AS fecha, tipo, motivo, articulo_codigo, descripcion, tipo_articulo, categoria,
             equipo_id, area, destino_nombre, unidades, costo_unitario::float AS costo_unitario, gasto::float AS gasto,
             contador_paginas, registrado_por
      FROM neto ORDER BY fecha, id LIMIT 20000`, params) : undefined

    return NextResponse.json({
      resumen: resumen[0], por_equipo: porEquipo, por_area: porArea,
      por_articulo: porArticulo, por_mes: porMes, rendimiento, detalle,
    })
  } catch (e) {
    if (faltaMigracion(e)) return NextResponse.json({ error: MSG_FALTA_MIGRACION, falta_migracion: true }, { status: 503 })
    console.error('[repuestos consumo GET]', e)
    return NextResponse.json({ error: 'Error al calcular el consumo' }, { status: 500 })
  }
}
