import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { verificarAcceso } from '@/lib/cen/acceso'
import { actualizarItemsSiesa } from '@/lib/cen/itemsSiesa'
import { siesaConfigurado } from '@/lib/siesa/connekta'

export const runtime = 'nodejs'
export const maxDuration = 60

// GET /api/logistica/ordenes-cen/items?buscar= — busca en la copia local de ítems de venta de Siesa
export async function GET(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  const q = (req.nextUrl.searchParams.get('buscar') ?? '').trim()
  const rows = await sql`
    SELECT f120_id, referencia, descripcion, codigo_anterior, unidad
    FROM cen_items_siesa
    WHERE ${q} = '' OR descripcion ILIKE ${'%' + q + '%'} OR referencia ILIKE ${q + '%'}
       OR codigo_anterior = ${q} OR f120_id::text = ${q}
    ORDER BY descripcion
    LIMIT 40
  `
  const [info] = await sql`SELECT COUNT(*)::int AS total, MAX(actualizado_at) AS actualizado FROM cen_items_siesa`
  return NextResponse.json({ items: rows, ...info })
}

// POST /api/logistica/ordenes-cen/items — vuelve a traer los ítems de Siesa y asigna los que coincidan
export async function POST(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  if (!siesaConfigurado()) return NextResponse.json({ error: 'La API de Siesa no está configurada' }, { status: 503 })
  try {
    const n = await actualizarItemsSiesa()
    const [s] = await sql`SELECT COUNT(*) FILTER (WHERE f120_id IS NULL)::int AS sin_item FROM cen_productos`
    return NextResponse.json({ ok: true, items: n, productosSinItem: s.sin_item })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudieron traer los ítems' }, { status: 502 })
  }
}
