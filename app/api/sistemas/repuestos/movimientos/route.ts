import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import {
  canAccessRepuestos, TIPOS_MOV_VALIDOS, DESTINOS_SALIDA, DESTINOS_RETIRO, MOTIVO_RETORNO, MOTIVO_BAJA,
  enteroNoNegativo, numeroOpcional, texto, esFecha,
  faltaMigracion, MSG_FALTA_MIGRACION,
} from '@/lib/repuestos'
import { reservarIds, qMovimientoStock, qCerrarAsignacion, esErrorStock, ETIQUETA_DESTINO, type Query } from '@/lib/repuestos-db'

// GET /api/sistemas/repuestos/movimientos — kardex (opcional ?articulo=REP-0001)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!canAccessRepuestos(session)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const articulo = searchParams.get('articulo') ?? ''
  const buscar   = searchParams.get('buscar') ?? ''
  const tipo     = searchParams.get('tipo') ?? ''
  const desde    = searchParams.get('desde') || null
  const hasta    = searchParams.get('hasta') || null

  try {
    const like = '%' + buscar + '%'
    const rows = await sql(
      `SELECT m.id, m.articulo_codigo, a.descripcion, a.categoria, a.unidad,
              m.fecha::text AS fecha, m.tipo, m.motivo, m.cantidad, m.stock_anterior, m.stock_resultante,
              m.equipo_id, m.destino_nombre, m.destino_area, m.proveedor, m.documento_ref,
              m.costo_unitario, m.observaciones, m.registrado_por
       FROM tic_articulo_movimientos m
       JOIN tic_articulos a ON a.codigo = m.articulo_codigo
       WHERE ($1 = '' OR m.articulo_codigo = $1)
         AND ($2 = '' OR a.descripcion ILIKE $3 OR m.articulo_codigo ILIKE $3 OR m.equipo_id ILIKE $3
              OR m.destino_nombre ILIKE $3 OR m.proveedor ILIKE $3 OR m.documento_ref ILIKE $3)
         AND ($4 = '' OR m.tipo = $4)
         AND ($5::text IS NULL OR m.fecha >= $5::date)
         AND ($6::text IS NULL OR m.fecha <= $6::date)
       ORDER BY m.fecha DESC, m.id DESC
       LIMIT 500`,
      [articulo, buscar, like, tipo, desde, hasta]
    )
    return NextResponse.json(rows)
  } catch (e) {
    if (faltaMigracion(e)) return NextResponse.json({ error: MSG_FALTA_MIGRACION, falta_migracion: true }, { status: 503 })
    console.error('[repuestos movimientos GET]', e)
    return NextResponse.json({ error: 'Error al consultar el kardex' }, { status: 500 })
  }
}

// POST /api/sistemas/repuestos/movimientos — registra entrada, salida o ajuste y actualiza el stock
// entrada: cantidad = unidades que ingresan · salida: unidades que salen · ajuste: stock contado real
// Salida con destino 'equipo' o 'persona' crea además una asignación (y puede reemplazar otra);
// destino 'consumo' (tóner, elementos gastados) solo descuenta stock.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!canAccessRepuestos(session)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const body = await req.json()
  const codigo = texto(body.articulo_codigo)
  const tipo   = texto(body.tipo)
  const motivo = texto(body.motivo)
  const fecha  = texto(body.fecha)
  const cantidad = enteroNoNegativo(body.cantidad)

  if (!codigo) return NextResponse.json({ error: 'Falta el artículo' }, { status: 400 })
  if (!tipo || !TIPOS_MOV_VALIDOS.includes(tipo)) return NextResponse.json({ error: 'Tipo de movimiento inválido' }, { status: 400 })
  if (!motivo || !esFecha(fecha)) return NextResponse.json({ error: 'Fecha y motivo son obligatorios' }, { status: 400 })
  if (cantidad === null || (tipo !== 'ajuste' && cantidad === 0)) {
    return NextResponse.json({ error: 'La cantidad debe ser un número entero mayor que cero' }, { status: 400 })
  }

  const destino = tipo === 'salida' ? texto(body.destino) : null
  if (tipo === 'salida' && (!destino || !DESTINOS_SALIDA.includes(destino))) {
    return NextResponse.json({ error: 'Indica si la salida va a un equipo, a una persona o es consumo' }, { status: 400 })
  }

  const equipoId = texto(body.equipo_id)
  if (equipoId) {
    const [eq] = await sql`SELECT id FROM equipos_tecnologicos WHERE id = ${equipoId}`
    if (!eq) return NextResponse.json({ error: `El equipo ${equipoId} no existe` }, { status: 400 })
  }

  if (destino === 'consumo' && !equipoId && motivo !== MOTIVO_BAJA) {
    return NextResponse.json({ error: 'Indica en qué equipo se consumió (para el análisis de gasto por equipo)' }, { status: 400 })
  }
  const hayContador = body.contador_paginas !== '' && body.contador_paginas != null
  const contador = hayContador ? enteroNoNegativo(body.contador_paginas) : null
  if (hayContador && contador === null) {
    return NextResponse.json({ error: 'El contador de páginas debe ser un número entero' }, { status: 400 })
  }

  const usuario = session.user?.name ?? 'Sistema'

  if (destino === 'equipo' || destino === 'persona') {
    return salidaConAsignacion({ body, session, usuario, codigo, fecha, motivo, cantidad, destino, equipoId })
  }

  // Entrada, ajuste o salida por consumo: lectura, validación de stock, actualización y registro en un solo statement
  const rows = await sql(
    `WITH ant AS (
       SELECT codigo, stock_actual FROM tic_articulos WHERE codigo = $1 AND activo FOR UPDATE
     ), upd AS (
       UPDATE tic_articulos a SET
         stock_actual = CASE $2 WHEN 'entrada' THEN ant.stock_actual + $3::int
                                WHEN 'salida'  THEN ant.stock_actual - $3::int
                                ELSE $3::int END,
         -- La última compra con costo actualiza el costo del artículo
         costo_unitario = CASE WHEN $2 = 'entrada' AND $11::numeric IS NOT NULL THEN $11::numeric ELSE a.costo_unitario END,
         actualizado_en = NOW()
       FROM ant
       WHERE a.codigo = ant.codigo AND ($2 <> 'salida' OR ant.stock_actual >= $3::int)
       RETURNING a.codigo, a.stock_actual AS nuevo, ant.stock_actual AS anterior, a.costo_unitario AS costo
     )
     INSERT INTO tic_articulo_movimientos (articulo_codigo, fecha, tipo, motivo, cantidad, stock_anterior,
                                           stock_resultante, equipo_id, destino_nombre, destino_area,
                                           proveedor, documento_ref, costo_unitario, contador_paginas,
                                           observaciones, registrado_por)
     SELECT codigo, $4::date, $2::text, $5::text, nuevo - anterior, anterior, nuevo, $6::text, $7::text, $8::text,
            $9::text, $10::text, costo, $14::int, $12::text, $13::text
     FROM upd
     RETURNING id, cantidad, stock_resultante`,
    [codigo, tipo, cantidad, fecha, motivo, equipoId, texto(body.destino_nombre), texto(body.destino_area),
     texto(body.proveedor), texto(body.documento_ref), numeroOpcional(body.costo_unitario),
     texto(body.observaciones), usuario, destino === 'consumo' ? contador : null]
  )

  if (rows.length === 0) {
    const [art] = await sql`SELECT stock_actual, activo FROM tic_articulos WHERE codigo = ${codigo}`
    if (!art) return NextResponse.json({ error: 'Artículo no encontrado' }, { status: 404 })
    if (!art.activo) return NextResponse.json({ error: 'El artículo está inactivo' }, { status: 400 })
    return NextResponse.json({ error: `Stock insuficiente: hay ${art.stock_actual} y se intentan sacar ${cantidad}` }, { status: 409 })
  }

  const mov = rows[0]
  await logAudit({
    usuarioId: session.user?.id ?? null,
    usuarioNombre: usuario,
    accion: 'TIC_ARTICULO_MOVIMIENTO',
    descripcion: `${tipo[0].toUpperCase() + tipo.slice(1)} de ${codigo} (${motivo}): ${mov.cantidad > 0 ? '+' : ''}${mov.cantidad}, stock queda en ${mov.stock_resultante}`
      + (equipoId ? ` · equipo ${equipoId}` : ''),
    datos: { movimiento_id: mov.id, codigo, tipo, cantidad: mov.cantidad, equipo_id: equipoId },
  })

  return NextResponse.json(mov, { status: 201 })
}

type DatosSalida = {
  body: Record<string, unknown>
  session: { user?: { id?: string; name?: string | null } }
  usuario: string
  codigo: string
  fecha: string
  motivo: string
  cantidad: number
  destino: 'equipo' | 'persona'
  equipoId: string | null
}

// Salida que queda asignada a un equipo o a una persona. Si el equipo ya tiene asignado un artículo
// del mismo tipo, exige decidir si es reemplazo (y qué pasa con el anterior) o una asignación adicional.
async function salidaConAsignacion(d: DatosSalida) {
  const { body, session, usuario, codigo, fecha, motivo, cantidad, destino, equipoId } = d
  const personaNombre = texto(body.destino_nombre)
  const personaArea   = texto(body.destino_area)
  const observaciones = texto(body.observaciones)
  const esPrestamo    = body.es_prestamo === true
  const fechaLimite   = esPrestamo ? texto(body.fecha_limite_prestamo) : null

  if (destino === 'equipo' && !equipoId) return NextResponse.json({ error: 'Selecciona el equipo' }, { status: 400 })
  if (destino === 'persona') {
    if (!personaNombre) return NextResponse.json({ error: 'Indica el nombre de la persona que recibe' }, { status: 400 })
    if (!observaciones) return NextResponse.json({ error: 'Cuando se entrega a una persona sin equipo, la observación es obligatoria (para qué se entrega)' }, { status: 400 })
  }
  if (esPrestamo && (!esFecha(fechaLimite) || fechaLimite < fecha)) {
    return NextResponse.json({ error: 'Indica hasta cuándo es el préstamo (fecha igual o posterior a la entrega)' }, { status: 400 })
  }

  const [art] = await sql`SELECT codigo, descripcion, tipo, categoria, stock_actual, activo FROM tic_articulos WHERE codigo = ${codigo}`
  if (!art) return NextResponse.json({ error: 'Artículo no encontrado' }, { status: 404 })
  if (!art.activo) return NextResponse.json({ error: 'El artículo está inactivo' }, { status: 400 })
  if (art.stock_actual < cantidad) {
    return NextResponse.json({ error: `Stock insuficiente: hay ${art.stock_actual} y se intentan sacar ${cantidad}` }, { status: 409 })
  }

  // ¿El equipo ya tiene algo del mismo tipo?
  type Reemplazo = { anterior: Record<string, unknown>; motivo: string; detalle: string | null; destinoRetiro: string }
  let reemplazo: Reemplazo | null = null
  if (destino === 'equipo') {
    const vigentes = await sql`
      SELECT s.id, s.articulo_codigo, a.descripcion, s.cantidad, s.fecha_asignacion::text AS fecha_asignacion,
             s.persona_nombre, s.es_prestamo, m.costo_unitario AS costo_salida
      FROM tic_articulo_asignaciones s
      JOIN tic_articulos a ON a.codigo = s.articulo_codigo
      JOIN tic_articulo_movimientos m ON m.id = s.movimiento_salida_id
      WHERE s.equipo_id = ${equipoId} AND s.estado = 'vigente'
        AND a.tipo = ${art.tipo} AND a.categoria = ${art.categoria}
      ORDER BY s.fecha_asignacion
    `
    const decision = (body.reemplazo ?? null) as Record<string, unknown> | null
    if (vigentes.length > 0 && !decision) {
      return NextResponse.json({
        error: `El equipo ${equipoId} ya tiene asignado: ${art.tipo}. Indica si es un reemplazo o una asignación adicional.`,
        requiere_decision: true, vigentes,
      }, { status: 409 })
    }
    if (decision?.decision === 'reemplazo') {
      const anterior = vigentes.find(v => v.id === Number(decision.asignacion_id))
      const motivoR  = texto(decision.motivo)
      const destinoR = texto(decision.destino_retiro)
      if (!anterior) return NextResponse.json({ error: 'Selecciona cuál de los asignados se reemplaza' }, { status: 400 })
      if (!motivoR) return NextResponse.json({ error: 'Indica el motivo del reemplazo' }, { status: 400 })
      if (!destinoR || !DESTINOS_RETIRO.includes(destinoR)) return NextResponse.json({ error: 'Indica qué pasa con el artículo anterior' }, { status: 400 })
      reemplazo = { anterior, motivo: motivoR, detalle: texto(decision.detalle), destinoRetiro: destinoR }
    } else if (decision && decision.decision !== 'adicional') {
      return NextResponse.json({ error: 'Decisión de reemplazo inválida' }, { status: 400 })
    }
  }

  const ids = await reservarIds()
  const motivoSalida = reemplazo ? `Reemplazo: ${reemplazo.motivo}` : motivo
  const queries: Query[] = [
    qMovimientoStock({
      id: ids.movSalida, codigo, tipo: 'salida', cantidad, fecha, motivo: motivoSalida, equipoId,
      destinoNombre: personaNombre, destinoArea: personaArea, observaciones, usuario,
    }),
    sql`
      INSERT INTO tic_articulo_asignaciones (id, articulo_codigo, cantidad, equipo_id, persona_nombre, persona_area,
        es_prestamo, fecha_asignacion, fecha_limite_prestamo, observaciones, reemplaza_a, movimiento_salida_id, registrado_por)
      VALUES (${ids.asignacion}, ${codigo}, ${cantidad}, ${equipoId}, ${personaNombre}, ${personaArea},
        ${esPrestamo}, ${fecha}, ${fechaLimite}, ${observaciones}, ${reemplazo ? Number(reemplazo.anterior.id) : null},
        ${ids.movSalida}, ${usuario})
    `,
  ]
  if (reemplazo) {
    const ant = reemplazo.anterior
    const vuelve = reemplazo.destinoRetiro === 'inventario'
    if (vuelve) {
      queries.push(qMovimientoStock({
        id: ids.movRetorno, codigo: String(ant.articulo_codigo), tipo: 'entrada', cantidad: Number(ant.cantidad),
        fecha, motivo: MOTIVO_RETORNO.reemplazo, equipoId, destinoNombre: (ant.persona_nombre as string | null) ?? null,
        destinoArea: null, observaciones: `Retirado del equipo ${equipoId} al reemplazarlo por ${codigo}. Motivo: ${reemplazo.motivo}`,
        usuario, exigirActivo: false, costo: ant.costo_salida == null ? null : Number(ant.costo_salida),
      }))
    }
    queries.push(qCerrarAsignacion({
      asignacionId: Number(ant.id), estado: 'reemplazado', destino: reemplazo.destinoRetiro, fecha,
      motivo: reemplazo.motivo, detalle: reemplazo.detalle, reemplazadaPor: ids.asignacion,
      movRetornoId: vuelve ? ids.movRetorno : null, usuario,
    }))
  }

  try {
    await sql.transaction(queries)
  } catch (e) {
    if (esErrorStock(e)) return NextResponse.json({ error: 'Stock insuficiente (otro usuario acaba de registrar una salida)' }, { status: 409 })
    console.error('[repuestos salida con asignación]', e)
    return NextResponse.json({ error: 'No se pudo registrar la salida' }, { status: 500 })
  }

  const destinoTxt = destino === 'equipo' ? `equipo ${equipoId}` : `${personaNombre} (sin equipo)`
  await logAudit({
    usuarioId: session.user?.id ?? null,
    usuarioNombre: usuario,
    accion: 'TIC_ARTICULO_MOVIMIENTO',
    descripcion: `Asignó ${cantidad} × ${codigo} (${art.descripcion}) a ${destinoTxt}`
      + (esPrestamo ? ` en préstamo hasta ${fechaLimite}` : '')
      + (reemplazo ? ` reemplazando asignación #${reemplazo.anterior.id} (${reemplazo.anterior.articulo_codigo}): ${reemplazo.motivo}; el anterior ${ETIQUETA_DESTINO[reemplazo.destinoRetiro]}` : ''),
    datos: { asignacion_id: ids.asignacion, movimiento_id: ids.movSalida, codigo, equipo_id: equipoId,
             reemplaza_a: reemplazo?.anterior.id ?? null, destino_retiro: reemplazo?.destinoRetiro ?? null },
  })

  return NextResponse.json({ id: ids.movSalida, asignacion_id: ids.asignacion }, { status: 201 })
}
