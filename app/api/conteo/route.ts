import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { tieneModulo } from '@/lib/permissions'

// PUT /api/conteo  → guarda conteo físico y observaciones
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!tieneModulo(session.user?.rol ?? '', session.user?.modulos, 'consulta')) {
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })
  }

  const { id_inventario, conteo_fisico, observaciones } = await req.json()

  if (!id_inventario) {
    return NextResponse.json({ error: 'Falta id_inventario' }, { status: 400 })
  }

  const userId = session.user?.id ?? null

  // Validar que el item no esté acumulado y que el usuario tenga permiso
  const [item] = await sql`
    SELECT cargado_por, acumulado FROM inventario_datos WHERE id = ${id_inventario} LIMIT 1
  `
  if (!item) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })
  if (item.acumulado) return NextResponse.json({ error: 'Este conteo ya fue acumulado y no puede modificarse' }, { status: 403 })
  if (session.user?.rol !== 'admin' && String(item.cargado_por) !== userId) {
    return NextResponse.json({ error: 'Solo puede modificar el conteo quien subió este inventario' }, { status: 403 })
  }

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
