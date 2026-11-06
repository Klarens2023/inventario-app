import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { verificarAcceso } from '@/lib/cen/acceso'

// GET /api/logistica/ordenes-cen/rutas — rutas con sus días de tránsito (despacho = entrega − tránsito; la semana
// del despacho da el consecutivo de la relación RUTA-MMSS) y cuántas órdenes abiertas tienen.
export async function GET(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  const rows = await sql`
    SELECT r.ruta, r.dias_transito, r.totales,
           (SELECT COUNT(*)::int FROM cen_ordenes o WHERE o.ruta = r.ruta AND o.estado IN ('pendiente', 'sin_punto', 'error')) AS abiertas
    FROM cen_rutas r ORDER BY r.ruta
  `
  return NextResponse.json(rows)
}

// PUT /api/logistica/ordenes-cen/rutas — días de tránsito de una ruta. Body: { ruta, dias_transito }
export async function PUT(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  const { ruta, dias_transito } = await req.json() as { ruta?: string; dias_transito?: number | string }
  const nombre = String(ruta ?? '').trim().toUpperCase().slice(0, 30)
  const dias = Number(dias_transito)
  if (!nombre) return NextResponse.json({ error: 'Ruta inválida' }, { status: 400 })
  if (!Number.isInteger(dias) || dias < 0 || dias > 30) return NextResponse.json({ error: 'Los días de tránsito van de 0 a 30' }, { status: 400 })
  await sql`
    INSERT INTO cen_rutas (ruta, dias_transito) VALUES (${nombre}, ${dias})
    ON CONFLICT (ruta) DO UPDATE SET dias_transito = EXCLUDED.dias_transito, updated_at = NOW()
  `
  return NextResponse.json({ ok: true })
}
