import { NextRequest, NextResponse } from 'next/server'
import { exigirAcceso } from '@/lib/acceso'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'

// Requiere confirmación explícita en el body (no solo la del doble clic en la
// UI) para que un DELETE disparado sin pasar por la pantalla no borre nada
// por accidente. Si viene desde/hasta, solo borra ese rango; si no, borra
// todo el historial (comportamiento original).
export async function DELETE(req: NextRequest) {
  const acceso = await exigirAcceso(req, { roles: ['admin'] })
  if (!acceso.ok) return acceso.respuesta
  const { user } = acceso

  const { confirmar, desde, hasta } = await req.json().catch(() => ({} as Record<string, unknown>))
  if (confirmar !== 'ELIMINAR') {
    return NextResponse.json({ error: 'Falta confirmación' }, { status: 400 })
  }

  const hayRango = typeof desde === 'string' && desde && typeof hasta === 'string' && hasta

  const conteo = hayRango
    ? await sql`SELECT COUNT(*) AS total FROM inventario_datos WHERE fecha BETWEEN ${desde}::date AND ${hasta}::date`
    : await sql`SELECT COUNT(*) AS total FROM inventario_datos`
  const total = conteo[0]?.total ?? 0

  // Borrar en cascada (conteos se eliminan por FK ON DELETE CASCADE)
  if (hayRango) {
    await sql`DELETE FROM inventario_datos WHERE fecha BETWEEN ${desde}::date AND ${hasta}::date`
  } else {
    await sql`DELETE FROM inventario_datos`
  }

  const rangoTexto = hayRango ? ` entre ${desde} y ${hasta}` : ''
  await logAudit({
    usuarioId: user.id ?? null,
    usuarioNombre: user.name ?? 'Desconocido',
    accion: 'HISTORIAL_REINICIADO',
    descripcion: `Eliminó ${total} registro(s) de inventario${rangoTexto}`,
    datos: { registros_eliminados: Number(total), desde: hayRango ? desde : null, hasta: hayRango ? hasta : null },
  })

  return NextResponse.json({ ok: true, mensaje: 'Historial eliminado correctamente' })
}
