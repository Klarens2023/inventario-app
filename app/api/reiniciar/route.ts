import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user?.rol !== 'admin') return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const conteo = await sql`SELECT COUNT(*) AS total FROM inventario_datos`
  const total = conteo[0]?.total ?? 0

  // Borrar en cascada (conteos se eliminan por FK ON DELETE CASCADE)
  await sql`DELETE FROM inventario_datos`

  await logAudit({
    usuarioId: session.user?.id ?? null,
    usuarioNombre: session.user?.name ?? 'Desconocido',
    accion: 'HISTORIAL_REINICIADO',
    descripcion: `Eliminó todo el historial de inventario (${total} registros)`,
    datos: { registros_eliminados: Number(total) },
  })

  return NextResponse.json({ ok: true, mensaje: 'Historial eliminado correctamente' })
}
