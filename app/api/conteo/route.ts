import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'

// PUT /api/conteo  → guarda conteo físico y observaciones
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id_inventario, conteo_fisico, observaciones } = await req.json()

  if (!id_inventario) {
    return NextResponse.json({ error: 'Falta id_inventario' }, { status: 400 })
  }

  const userId = session.user?.id ?? null

  // Upsert: si ya existe actualiza, si no inserta
  const existing = await sql`
    SELECT id FROM inventario_conteos WHERE id_inventario = ${id_inventario} LIMIT 1
  `

  if (existing.length > 0) {
    await sql`
      UPDATE inventario_conteos SET
        conteo_fisico = ${conteo_fisico ?? null},
        observaciones = ${observaciones ?? null},
        usuario_id    = ${userId},
        updated_at    = NOW()
      WHERE id_inventario = ${id_inventario}
    `
  } else {
    await sql`
      INSERT INTO inventario_conteos (id_inventario, conteo_fisico, observaciones, usuario_id)
      VALUES (${id_inventario}, ${conteo_fisico ?? null}, ${observaciones ?? null}, ${userId})
    `
  }

  await logAudit({
    usuarioId: userId,
    usuarioNombre: session.user?.name ?? 'Desconocido',
    accion: 'CONTEO_ACTUALIZADO',
    descripcion: `Actualizó conteo del ítem #${id_inventario}`,
    datos: { id_inventario, conteo_fisico: conteo_fisico ?? null, tiene_observacion: !!observaciones },
  })

  return NextResponse.json({ ok: true })
}
