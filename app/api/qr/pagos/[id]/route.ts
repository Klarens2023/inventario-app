import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'

function hoyBogota(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

// PUT /api/qr/pagos/[id] — editar el valor de un pago propio registrado hoy
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!['pvn', 'pvv'].includes(user.rol)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const id = parseInt(params.id)
  const { valor } = await req.json()
  const valorNum = parseFloat(valor)
  if (!valorNum || valorNum <= 0) return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })

  const hoy = hoyBogota()
  const [existente] = await sql`
    SELECT id, valor, punto_venta_nombre FROM pvn_pagos_qr
    WHERE id = ${id} AND usuario_id = ${parseInt(user.id)} AND fecha = ${hoy}::date
  `
  if (!existente) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })

  await sql`UPDATE pvn_pagos_qr SET valor = ${valorNum} WHERE id = ${id}`

  await logAudit({
    usuarioId: user.id,
    usuarioNombre: user.name,
    accion: 'PVN_PAGO_QR_EDITADO',
    descripcion: `Editó pago QR de ${existente.valor} a ${valorNum} en ${existente.punto_venta_nombre}`,
    datos: { pago_id: id, valor_anterior: Number(existente.valor), valor_nuevo: valorNum },
  })

  return NextResponse.json({ ok: true })
}

// DELETE /api/qr/pagos/[id] — eliminar un pago propio registrado hoy
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!['pvn', 'pvv'].includes(user.rol)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const id = parseInt(params.id)
  const hoy = hoyBogota()
  const [existente] = await sql`
    SELECT id, valor, punto_venta_nombre FROM pvn_pagos_qr
    WHERE id = ${id} AND usuario_id = ${parseInt(user.id)} AND fecha = ${hoy}::date
  `
  if (!existente) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })

  await sql`DELETE FROM pvn_pagos_qr WHERE id = ${id}`

  await logAudit({
    usuarioId: user.id,
    usuarioNombre: user.name,
    accion: 'PVN_PAGO_QR_ELIMINADO',
    descripcion: `Eliminó pago QR de ${existente.valor} en ${existente.punto_venta_nombre}`,
    datos: { pago_id: id, valor: Number(existente.valor) },
  })

  return NextResponse.json({ ok: true })
}
