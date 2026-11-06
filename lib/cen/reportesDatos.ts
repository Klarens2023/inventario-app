// Consultas de los reportes de órdenes EDI (la API /api/logistica/ordenes-cen/reportes). Los reportes
// se arman con lib/cen/reportes.ts a partir de estas órdenes y líneas.
// Las horas se guardan en UTC: aquí se pasan a hora de Colombia (el cumplimiento compara días).
import { sql } from '@/lib/db'
import { nombreComprador } from './compradores'

export type FiltrosReporte = { desde: string; hasta: string; campo: 'entrega' | 'orden'; cadena: string; ruta: string }
export const LIMITE_ORDENES = 20000

/** Órdenes del periodo (con su punto, archivo y trazabilidad) y sus líneas con el producto de la cadena. */
export async function datosReportes({ desde, hasta, campo, cadena, ruta }: FiltrosReporte) {
  const ordenes = await sql`
    SELECT o.id, o.numero_orden, o.fuente, o.ean_comprador, o.fecha_orden::text, o.fecha_entrega::text, o.fecha_entrega_max::text,
           o.ean_entrega, o.nit, o.sucursal, o.razon_social, pe.ciudad, o.ruta, o.estado,
           COALESCE(o.fecha_despacho, COALESCE(o.fecha_entrega, o.fecha_entrega_max) - COALESCE(rt.dias_transito, 0))::text AS fecha_despacho,
           o.total_unidades::float AS total_unidades, o.valor_total::float AS valor_total, o.peso_kg::float AS peso_kg,
           (SELECT COUNT(DISTINCT d.ean_local)::int FROM cen_orden_distribucion d JOIN cen_orden_lineas l ON l.id = d.linea_id WHERE l.orden_id = o.id) AS locales,
           o.siesa_consecutivo, o.enviado_por, o.descartada_por, o.motivo_descarte,
           to_char((o.enviado_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD"T"HH24:MI:SS') AS enviado_at,
           to_char((o.descartada_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD"T"HH24:MI:SS') AS descartada_at,
           to_char((a.fecha_archivo AT TIME ZONE 'UTC') AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD"T"HH24:MI:SS') AS recibida_at,
           to_char((a.procesado_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD"T"HH24:MI:SS') AS leida_at
    FROM cen_ordenes o
    LEFT JOIN cen_puntos_ean pe ON pe.ean = o.ean_entrega
    LEFT JOIN cen_archivos a ON a.id = o.archivo_id
    LEFT JOIN cen_rutas rt ON rt.ruta = o.ruta
    WHERE (CASE WHEN ${campo} = 'orden' THEN o.fecha_orden ELSE COALESCE(o.fecha_entrega, o.fecha_entrega_max) END) BETWEEN ${desde}::date AND ${hasta}::date
      AND (${cadena} = '' OR o.ean_comprador = ${cadena})
      AND (${ruta} = '' OR (${ruta} = '-' AND o.ruta IS NULL) OR o.ruta = ${ruta})
    ORDER BY o.fecha_entrega NULLS LAST, o.numero_orden
    LIMIT ${LIMITE_ORDENES}
  `
  const ids = ordenes.map(o => o.id as number)
  const lineas = ids.length ? await sql`
    SELECT l.orden_id, l.nro_linea, l.ean_item, p.f120_id, COALESCE(p.descripcion, l.descripcion, l.ean_item) AS descripcion, l.cod_comprador,
           l.cantidad::float AS cantidad, l.precio::float AS precio, l.unidad, p.peso_kg::float AS peso_unitario, p.und_caja
    FROM cen_orden_lineas l
    JOIN cen_lineas_producto p ON p.linea_id = l.id -- producto de la cadena o del maestro
    WHERE l.orden_id = ANY(${ids})
    ORDER BY l.orden_id, l.nro_linea
  ` : []
  return { ordenes: ordenes.map(o => ({ ...o, cadena: nombreComprador(o.ean_comprador) })), lineas, limitado: ordenes.length === LIMITE_ORDENES }
}

/** Control de lectura de los SFTP: ejecuciones, fallos, archivos por día y archivos con error. */
export async function datosSincronizacion(desde: string, hasta: string) {
  const [resumen] = await sql`
    SELECT COUNT(*)::int AS ejecuciones, COUNT(*) FILTER (WHERE NOT ok)::int AS fallidas,
           COUNT(*) FILTER (WHERE origen = 'manual')::int AS manuales,
           MAX(inicio) FILTER (WHERE ok) AS ultima_ok, MAX(inicio) FILTER (WHERE NOT ok) AS ultima_fallida
    FROM cen_sincronizaciones
    WHERE (inicio AT TIME ZONE 'America/Bogota')::date BETWEEN ${desde}::date AND ${hasta}::date
  `
  const fallos = await sql`
    SELECT inicio, origen, usuario, error FROM cen_sincronizaciones
    WHERE NOT ok AND (inicio AT TIME ZONE 'America/Bogota')::date BETWEEN ${desde}::date AND ${hasta}::date
    ORDER BY inicio DESC LIMIT 50
  `
  // Archivos leídos por día y fuente, y cuántas horas esperaron en el SFTP antes de leerse
  const porDia = await sql`
    SELECT ((procesado_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Bogota')::date::text AS dia, fuente, COUNT(*)::int AS archivos,
           COUNT(*) FILTER (WHERE estado = 'error')::int AS con_error,
           ROUND(AVG(EXTRACT(EPOCH FROM procesado_at - fecha_archivo) / 3600)::numeric, 1)::float AS espera_prom_h,
           ROUND(MAX(EXTRACT(EPOCH FROM procesado_at - fecha_archivo) / 3600)::numeric, 1)::float AS espera_max_h
    FROM cen_archivos
    WHERE ((procesado_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Bogota')::date BETWEEN ${desde}::date AND ${hasta}::date
    GROUP BY 1, 2 ORDER BY 1 DESC, 2
  `
  const errores = await sql`
    SELECT fuente, nombre, fecha_archivo, procesado_at, error FROM cen_archivos
    WHERE estado = 'error' AND ((procesado_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Bogota')::date BETWEEN ${desde}::date AND ${hasta}::date
    ORDER BY procesado_at DESC LIMIT 100
  `
  return { resumen, fallos, porDia, errores }
}
