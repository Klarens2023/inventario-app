import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'

// Requiere confirmación explícita en el body (no solo la del doble clic en la
// UI) para que un DELETE disparado sin pasar por la pantalla no borre nada
// por accidente. Si viene desde/hasta, solo borra ese rango; si no, borra
// todo el historial (comportamiento original).
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user?.rol !== 'admin') return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

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
    usuarioId: session.user?.id ?? null,
    usuarioNombre: session.user?.name ?? 'Desconocido',
    accion: 'HISTORIAL_REINICIADO',
    descripcion: `Eliminó ${total} registro(s) de inventario${rangoTexto}`,
    datos: { registros_eliminados: Number(total), desde: hayRango ? desde : null, hasta: hayRango ? hasta : null },
  })

  return NextResponse.json({ ok: true, mensaje: 'Historial eliminado correctamente' })
}
