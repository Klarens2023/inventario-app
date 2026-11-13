import { NextRequest, NextResponse } from 'next/server'
import { verificarAcceso } from '@/lib/cen/acceso'
import { consultarTodo, siesaConfigurado, type ConexionSiesa } from '@/lib/siesa/connekta'
import { condicionInventario, existenciasPorItem } from '@/lib/cen/inventario'

export const runtime = 'nodejs'
export const maxDuration = 60

// Conexión de Siesa para el inventario: producción ("real", con permiso desde el 13/11/2026), porque el
// reporte compara con la existencia real. SIESA_INVENTARIO_CONEXION=qa lo devuelve a QA.
const CONEXION = (): ConexionSiesa => process.env.SIESA_INVENTARIO_CONEXION === 'qa' || !siesaConfigurado('real') ? 'qa' : 'real'

// GET /api/logistica/ordenes-cen/inventario?items=3348,3218 — existencia actual en Siesa de esos ítems,
// total y por bodega (la página suma las bodegas que el usuario elige).
export async function GET(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  const conexion = CONEXION()
  if (!siesaConfigurado(conexion)) return NextResponse.json({ error: 'La API de Siesa no está configurada.' }, { status: 503 })
  const items = (req.nextUrl.searchParams.get('items') ?? '').split(',').map(Number).filter(n => Number.isInteger(n) && n > 0).slice(0, 400)
  const condicion = condicionInventario(items)
  if (!condicion) return NextResponse.json({ items: [], conexion, consultado_at: new Date().toISOString() })
  try {
    const filas = await consultarTodo<Record<string, unknown>>('API_v2_Inventarios_InvFecha', condicion, 100, conexion)
    return NextResponse.json({ items: Array.from(existenciasPorItem(filas).values()), conexion, consultado_at: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ error: `No se pudo consultar el inventario en Siesa: ${e instanceof Error ? e.message : e}` }, { status: 502 })
  }
}
