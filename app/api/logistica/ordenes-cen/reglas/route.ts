import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { verificarAcceso } from '@/lib/cen/acceso'
import { cargarReglas, recalcularRutas } from '@/lib/cen/rutas'
import { validarRegla, type ReglaEntrada } from '@/lib/cen/validarRegla'

// GET /api/logistica/ordenes-cen/reglas — reglas de ruta por prioridad
export async function GET(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  return NextResponse.json(await cargarReglas())
}

// POST /api/logistica/ordenes-cen/reglas — crea una regla y recalcula las rutas sugeridas
export async function POST(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  try {
    const r = validarRegla(await req.json() as ReglaEntrada)
    await sql`
      INSERT INTO cen_reglas_ruta (prioridad, ruta, ean_comprador, ciudades, departamentos, peso_min, peso_max, descripcion, activo)
      VALUES (${r.prioridad}, ${r.ruta}, ${r.ean_comprador}, ${r.ciudades}, ${r.departamentos}, ${r.peso_min}, ${r.peso_max}, ${r.descripcion}, ${r.activo})
    `
    const cambios = await recalcularRutas()
    return NextResponse.json({ ok: true, ordenesRecalculadas: cambios })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Regla inválida' }, { status: 400 })
  }
}
