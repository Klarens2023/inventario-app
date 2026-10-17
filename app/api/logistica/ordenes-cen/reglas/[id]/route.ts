import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { verificarAcceso } from '@/lib/cen/acceso'
import { recalcularRutas } from '@/lib/cen/rutas'
import { validarRegla, type ReglaEntrada } from '@/lib/cen/validarRegla'

// PUT /api/logistica/ordenes-cen/reglas/[id] — edita una regla y recalcula las rutas sugeridas
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  try {
    const r = validarRegla(await req.json() as ReglaEntrada)
    const res = await sql`
      UPDATE cen_reglas_ruta SET prioridad = ${r.prioridad}, ruta = ${r.ruta}, ean_comprador = ${r.ean_comprador},
        ciudades = ${r.ciudades}, departamentos = ${r.departamentos}, peso_min = ${r.peso_min}, peso_max = ${r.peso_max},
        descripcion = ${r.descripcion}, activo = ${r.activo}, updated_at = NOW()
      WHERE id = ${parseInt(params.id)} RETURNING id
    `
    if (!res.length) return NextResponse.json({ error: 'Regla no encontrada' }, { status: 404 })
    const cambios = await recalcularRutas()
    return NextResponse.json({ ok: true, ordenesRecalculadas: cambios })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Regla inválida' }, { status: 400 })
  }
}

// DELETE /api/logistica/ordenes-cen/reglas/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  await sql`DELETE FROM cen_reglas_ruta WHERE id = ${parseInt(params.id)}`
  const cambios = await recalcularRutas()
  return NextResponse.json({ ok: true, ordenesRecalculadas: cambios })
}
