import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { verificarAcceso } from '@/lib/cen/acceso'
import { codigoRelacion } from '@/lib/cen/relacion'
import { hoyBogota } from '@/lib/fechas'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'

// La relación de una orden es RUTA-MMSS = su ruta + la semana de su fecha de despacho (lib/cen/relacion.ts).
// Cambiar una orden de relación = asignarle a mano la ruta y la fecha de despacho de la relación destino
// (ruta_manual = TRUE para que las reglas no la cambien, fecha_despacho fija). Puede ser de otra ruta.

// GET /api/logistica/ordenes-cen/relaciones — relaciones con órdenes no descartadas desde hace 30 días,
// para elegir el destino: [{ relacion, ruta, fecha_despacho, ordenes }]
export async function GET(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  const desde = new Date(hoyBogota() + 'T12:00:00Z'); desde.setUTCDate(desde.getUTCDate() - 30)
  const filas = await sql`
    SELECT ruta, fecha_despacho::text, COUNT(*)::int AS ordenes
    FROM (
      -- Fecha de despacho efectiva: la fijada a mano o la entrega menos los días de tránsito de la ruta
      SELECT o.ruta, COALESCE(o.fecha_despacho, COALESCE(o.fecha_entrega, o.fecha_entrega_max) - COALESCE(rt.dias_transito, 0)) AS fecha_despacho
      FROM cen_ordenes o LEFT JOIN cen_rutas rt ON rt.ruta = o.ruta
      WHERE o.ruta IS NOT NULL AND o.estado <> 'descartada'
    ) x
    WHERE fecha_despacho >= ${desde.toISOString().slice(0, 10)}::date
    GROUP BY 1, 2`
  const m = new Map<string, { relacion: string; ruta: string; fecha_despacho: string; ordenes: number }>()
  for (const f of filas) {
    const rel = codigoRelacion(f.ruta as string, f.fecha_despacho as string)
    if (!rel) continue
    const x = m.get(rel)
    // Representa la relación con su primera fecha de despacho
    if (!x) m.set(rel, { relacion: rel, ruta: f.ruta as string, fecha_despacho: f.fecha_despacho as string, ordenes: f.ordenes as number })
    else { x.ordenes += f.ordenes as number; if ((f.fecha_despacho as string) < x.fecha_despacho) x.fecha_despacho = f.fecha_despacho as string }
  }
  return NextResponse.json(Array.from(m.values()).sort((a, b) => a.relacion.localeCompare(b.relacion)))
}

// POST /api/logistica/ordenes-cen/relaciones — { ids: number[], ruta: "EXCAL", fecha_despacho: "2026-11-12" }
// Mueve las órdenes a la relación de esa ruta y semana. Las descartadas no se mueven.
export async function POST(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  const b = await req.json().catch(() => ({})) as { ids?: unknown; ruta?: unknown; fecha_despacho?: unknown }
  const ids = Array.isArray(b.ids) ? Array.from(new Set(b.ids.map(Number).filter(Number.isInteger))).slice(0, 500) : []
  const ruta = typeof b.ruta === 'string' ? b.ruta.trim().toUpperCase().slice(0, 40) : ''
  const fecha = typeof b.fecha_despacho === 'string' ? b.fecha_despacho.trim() : ''
  if (!ids.length) return NextResponse.json({ error: 'Indica las órdenes' }, { status: 400 })
  if (!ruta) return NextResponse.json({ error: 'Indica la ruta de destino' }, { status: 400 })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha))) return NextResponse.json({ error: 'Fecha de despacho inválida' }, { status: 400 })
  const relacion = codigoRelacion(ruta, fecha)!

  const movidas = await sql`
    UPDATE cen_ordenes SET ruta = ${ruta}, ruta_manual = TRUE, fecha_despacho = ${fecha}, updated_at = NOW()
    WHERE id = ANY(${ids}::int[]) AND estado <> 'descartada'
    RETURNING numero_orden`
  const ocs = movidas.map(f => f.numero_orden as string)
  if (ocs.length) {
    await logAudit({
      usuarioId: acceso.user.id, usuarioNombre: acceso.user.name, accion: 'CEN_RELACION_CAMBIADA',
      descripcion: `Movió ${ocs.length} orden(es) a la relación ${relacion}: ${ocs.join(', ')}`,
      datos: { relacion, ruta, fecha_despacho: fecha, ordenes: ocs },
    })
  }
  const omitidas = ids.length - ocs.length
  return NextResponse.json({
    ok: true, relacion, movidas: ocs.length,
    mensaje: `${ocs.length} orden(es) movida(s) a la relación ${relacion}.${omitidas ? ` ${omitidas} no se movieron (descartadas).` : ''}`,
  })
}
