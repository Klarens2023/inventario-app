import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { canAccessRepuestos, CATEGORIAS_VALIDAS, enteroNoNegativo, numeroOpcional, texto } from '@/lib/repuestos'

// PUT /api/sistemas/repuestos/[codigo] — editar datos del artículo.
// El stock NO se edita aquí: solo cambia con movimientos (entrada / salida / ajuste).
export async function PUT(req: NextRequest, { params }: { params: { codigo: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!canAccessRepuestos(session)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const body = await req.json()

  // Activar / desactivar sin tocar lo demás
  if (typeof body.activo === 'boolean' && Object.keys(body).length === 1) {
    const rows = await sql`
      UPDATE tic_articulos SET activo = ${body.activo}, actualizado_en = NOW()
      WHERE codigo = ${params.codigo} RETURNING codigo
    `
    if (rows.length === 0) return NextResponse.json({ error: 'Artículo no encontrado' }, { status: 404 })
    await logAudit({
      usuarioId: session.user?.id ?? null,
      usuarioNombre: session.user?.name ?? 'Desconocido',
      accion: 'TIC_ARTICULO_ACTUALIZADO',
      descripcion: `${body.activo ? 'Reactivó' : 'Desactivó'} el artículo ${params.codigo}`,
      datos: { codigo: params.codigo, activo: body.activo },
    })
    return NextResponse.json({ ok: true })
  }

  const categoria   = texto(body.categoria)
  const tipo        = texto(body.tipo)
  const descripcion = texto(body.descripcion)
  if (!categoria || !CATEGORIAS_VALIDAS.includes(categoria)) return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 })
  if (!tipo || !descripcion) return NextResponse.json({ error: 'Tipo y descripción son obligatorios' }, { status: 400 })
  const stockMinimo = enteroNoNegativo(body.stock_minimo)
  if (stockMinimo === null) return NextResponse.json({ error: 'El stock mínimo debe ser un número entero sin signo' }, { status: 400 })

  const rows = await sql`
    UPDATE tic_articulos SET
      categoria = ${categoria}, tipo = ${tipo}, descripcion = ${descripcion},
      marca = ${texto(body.marca)}, referencia = ${texto(body.referencia)},
      compatible_con = ${texto(body.compatible_con)}, unidad = ${texto(body.unidad) ?? 'Unidad'},
      stock_minimo = ${stockMinimo}, ubicacion = ${texto(body.ubicacion)},
      costo_unitario = ${numeroOpcional(body.costo_unitario)}, observaciones = ${texto(body.observaciones)},
      actualizado_en = NOW()
    WHERE codigo = ${params.codigo}
    RETURNING codigo
  `
  if (rows.length === 0) return NextResponse.json({ error: 'Artículo no encontrado' }, { status: 404 })

  await logAudit({
    usuarioId: session.user?.id ?? null,
    usuarioNombre: session.user?.name ?? 'Desconocido',
    accion: 'TIC_ARTICULO_ACTUALIZADO',
    descripcion: `Editó el artículo ${params.codigo}: ${descripcion}`,
    datos: { codigo: params.codigo },
  })
  return NextResponse.json({ ok: true })
}
