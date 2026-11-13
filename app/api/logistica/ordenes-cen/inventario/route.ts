import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { verificarAcceso } from '@/lib/cen/acceso'
import { consultarTodo, siesaConfigurado, type ConexionSiesa } from '@/lib/siesa/connekta'
import { existenciasPorItem, type ExistenciaItem } from '@/lib/cen/inventario'

export const runtime = 'nodejs'
export const maxDuration = 60

// Inventario de Siesa para el reporte de necesidad por producto. Se consulta en Siesa SOLO cuando alguien
// presiona "Actualizar inventario" (POST) y la foto queda guardada (tablas de scripts/migrate-add-cen-inventario.js);
// el reporte lee esa foto (GET) con la fecha y el usuario de la última actualización.
//
// Conexión: producción ("real", con permiso desde el 13/11/2026). SIESA_INVENTARIO_CONEXION=qa la devuelve a QA.
const CONEXION = (): ConexionSiesa => process.env.SIESA_INVENTARIO_CONEXION === 'qa' || !siesaConfigurado('real') ? 'qa' : 'real'
const SIN_TABLA = 'Falta correr scripts/migrate-add-cen-inventario.js en la base.'
const sinTabla = (e: unknown) => /cen_inventario/.test(String(e)) && /exist/i.test(String(e))

// GET ?items=3348,3218 — existencia guardada de esos ítems y datos de la última actualización
export async function GET(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  const items = (req.nextUrl.searchParams.get('items') ?? '').split(',').map(Number).filter(n => Number.isInteger(n) && n > 0).slice(0, 1000)
  try {
    const [estado] = await sql`SELECT actualizado_at, actualizado_por, conexion, items FROM cen_inventario_estado WHERE id = 1`
    const filas = items.length ? await sql`
      SELECT f120_id, unidad, existencia::float AS existencia, comprometida::float AS comprometida, por_bodega
      FROM cen_inventario WHERE f120_id = ANY(${items}::int[])` : []
    return NextResponse.json({
      items: filas.map(f => ({ f120_id: f.f120_id, unidad: f.unidad, existencia: f.existencia, comprometida: f.comprometida, porBodega: f.por_bodega })) as ExistenciaItem[],
      actualizado_at: estado?.actualizado_at ?? null, actualizado_por: estado?.actualizado_por ?? null,
      conexion: estado?.conexion ?? null, total_items: estado?.items ?? 0,
    })
  } catch (e) {
    if (sinTabla(e)) return NextResponse.json({ items: [], actualizado_at: null, error: SIN_TABLA })
    throw e
  }
}

// POST — consulta TODO el inventario con existencia en Siesa (~15 s) y reemplaza la foto guardada
export async function POST(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  const conexion = CONEXION()
  if (!siesaConfigurado(conexion)) return NextResponse.json({ error: 'La API de Siesa no está configurada.' }, { status: 503 })
  let items: ExistenciaItem[]
  try {
    const filas = await consultarTodo<Record<string, unknown>>('API_v2_Inventarios_InvFecha', 'f400_cant_existencia_1 <> 0', 400, conexion)
    items = Array.from(existenciasPorItem(filas).values())
  } catch (e) {
    return NextResponse.json({ error: `No se pudo consultar el inventario en Siesa: ${e instanceof Error ? e.message : e}` }, { status: 502 })
  }
  try {
    // Todo o nada: si algo falla queda la foto anterior
    await sql.transaction([
      sql`DELETE FROM cen_inventario`,
      sql`INSERT INTO cen_inventario (f120_id, unidad, existencia, comprometida, por_bodega)
          SELECT i, u, e, c, b::jsonb FROM unnest(
            ${items.map(x => x.f120_id)}::int[], ${items.map(x => x.unidad.slice(0, 6))}::text[], ${items.map(x => x.existencia)}::numeric[],
            ${items.map(x => x.comprometida)}::numeric[], ${items.map(x => JSON.stringify(x.porBodega))}::text[]
          ) AS t(i, u, e, c, b)`,
      sql`INSERT INTO cen_inventario_estado (id, actualizado_at, actualizado_por, conexion, items)
          VALUES (1, NOW(), ${acceso.user.name.slice(0, 120)}, ${conexion}, ${items.length})
          ON CONFLICT (id) DO UPDATE SET actualizado_at = EXCLUDED.actualizado_at, actualizado_por = EXCLUDED.actualizado_por,
            conexion = EXCLUDED.conexion, items = EXCLUDED.items`,
    ])
  } catch (e) {
    if (sinTabla(e)) return NextResponse.json({ error: SIN_TABLA }, { status: 409 })
    throw e
  }
  return NextResponse.json({ ok: true, items: items.length, mensaje: `Inventario actualizado: ${items.length} ítems con existencia en Siesa.` })
}
