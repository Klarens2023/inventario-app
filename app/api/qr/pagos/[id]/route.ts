import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'

function hoyBogota(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

// PUT /api/qr/pagos/[id]
// admin: puede editar valor y/o punto_venta_id de cualquier pago, sin restricción
// pvn/pvv: solo puede editar el valor de un pago propio de hoy, con turno activo
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const id = parseInt(params.id)
  const body = await req.json()

  if (user.rol === 'admin') {
    const [existente] = await sql`SELECT id, valor, punto_venta_id, punto_venta_nombre FROM pvn_pagos_qr WHERE id = ${id}`
    if (!existente) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })

    let valorNum: number | null = null
    if (body.valor !== undefined) {
      valorNum = parseFloat(body.valor)
      if (!valorNum || valorNum <= 0) return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
    }

    let pvNuevo: { id: number; nombre: string } | null = null
    if (body.punto_venta_id !== undefined) {
      const pvId = parseInt(body.punto_venta_id)
      const [pv] = await sql`SELECT id, nombre FROM pvn_puntos_venta WHERE id = ${pvId}`
      if (!pv) return NextResponse.json({ error: 'Punto de venta inválido' }, { status: 400 })
      pvNuevo = { id: pv.id, nombre: pv.nombre }
    }

    if (valorNum === null && !pvNuevo) return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 })

    await sql`
      UPDATE pvn_pagos_qr
      SET valor = ${valorNum ?? existente.valor},
          punto_venta_id = ${pvNuevo?.id ?? existente.punto_venta_id},
          punto_venta_nombre = ${pvNuevo?.nombre ?? existente.punto_venta_nombre}
      WHERE id = ${id}
    `

    await logAudit({
      usuarioId: user.id,
      usuarioNombre: user.name,
      accion: 'PVN_PAGO_QR_EDITADO',
      descripcion: `Admin editó pago QR #${id}` +
        (valorNum !== null ? ` — valor ${existente.valor} → ${valorNum}` : '') +
        (pvNuevo ? ` — punto ${existente.punto_venta_nombre} → ${pvNuevo.nombre}` : ''),
      datos: {
        pago_id: id,
        ...(valorNum !== null ? { valor_anterior: Number(existente.valor), valor_nuevo: valorNum } : {}),
        ...(pvNuevo ? { punto_anterior: existente.punto_venta_nombre, punto_nuevo: pvNuevo.nombre } : {}),
        editado_por_admin: true,
      },
    })

    return NextResponse.json({ ok: true })
  }

  if (!['pvn', 'pvv'].includes(user.rol)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const valorNum = parseFloat(body.valor)
  if (!valorNum || valorNum <= 0) return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })

  const hoy = hoyBogota()
  const [existente] = await sql`
    SELECT p.id, p.valor, p.punto_venta_nombre, t.activo AS turno_activo
    FROM pvn_pagos_qr p
    LEFT JOIN pvn_turnos t ON t.id = p.turno_id
    WHERE p.id = ${id} AND p.usuario_id = ${parseInt(user.id)} AND p.fecha = ${hoy}::date
  `
  if (!existente) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })
  if (!existente.turno_activo) return NextResponse.json({ error: 'No se puede editar: el turno ya está cerrado' }, { status: 403 })

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

// DELETE /api/qr/pagos/[id]
// admin: puede eliminar cualquier pago, sin restricción (p. ej. duplicados por error)
// pvn/pvv: solo un pago propio de hoy, con turno activo
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const id = parseInt(params.id)

  if (user.rol === 'admin') {
    const [existente] = await sql`SELECT id, valor, punto_venta_nombre, usuario_nombre FROM pvn_pagos_qr WHERE id = ${id}`
    if (!existente) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })

    await sql`DELETE FROM pvn_pagos_qr WHERE id = ${id}`

    await logAudit({
      usuarioId: user.id,
      usuarioNombre: user.name,
      accion: 'PVN_PAGO_QR_ELIMINADO',
      descripcion: `Admin eliminó pago QR de ${existente.usuario_nombre} — ${existente.valor} en ${existente.punto_venta_nombre}`,
      datos: { pago_id: id, valor: Number(existente.valor), usuario_afectado: existente.usuario_nombre, eliminado_por_admin: true },
    })

    return NextResponse.json({ ok: true })
  }

  if (!['pvn', 'pvv'].includes(user.rol)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const hoy = hoyBogota()
  const [existente] = await sql`
    SELECT p.id, p.valor, p.punto_venta_nombre, t.activo AS turno_activo
    FROM pvn_pagos_qr p
    LEFT JOIN pvn_turnos t ON t.id = p.turno_id
    WHERE p.id = ${id} AND p.usuario_id = ${parseInt(user.id)} AND p.fecha = ${hoy}::date
  `
  if (!existente) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })
  if (!existente.turno_activo) return NextResponse.json({ error: 'No se puede eliminar: el turno ya está cerrado' }, { status: 403 })

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
