import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { canAccessRepuestos, DESTINOS_RETIRO, MOTIVO_RETORNO, texto, esFecha } from '@/lib/repuestos'
import { reservarIds, qMovimientoStock, qCerrarAsignacion, asignacionVigente, ETIQUETA_DESTINO, type Query } from '@/lib/repuestos-db'

// GET /api/sistemas/repuestos/asignaciones/[id] — detalle completo (para el acta impresa)
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!canAccessRepuestos(session)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const id = parseInt(params.id, 10)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Asignación no encontrada' }, { status: 404 })
  const [row] = await sql`
    SELECT s.id, s.articulo_codigo, s.cantidad, s.equipo_id, s.persona_nombre, s.persona_area, s.es_prestamo,
           s.fecha_asignacion::text AS fecha_asignacion, s.fecha_limite_prestamo::text AS fecha_limite_prestamo,
           s.observaciones, s.estado, s.destino_retiro, s.fecha_retiro::text AS fecha_retiro, s.motivo_retiro,
           s.detalle_retiro, s.reemplaza_a, s.reemplazada_por, s.registrado_por, s.cerrado_por,
           a.descripcion, a.tipo, a.categoria, a.marca, a.referencia, a.unidad,
           ms.costo_unitario::float AS costo_unitario, ms.motivo AS motivo_entrega,
           e.tipo_equipo, e.marca AS equipo_marca, e.modelo AS equipo_modelo, e.numero_serie AS equipo_serie,
           e.hostname AS equipo_hostname, e.placa_activo AS equipo_placa, e.area_ubicacion AS equipo_area,
           e.usuario_asignado AS equipo_usuario,
           ant.articulo_codigo AS ant_codigo, aa.descripcion AS ant_descripcion, ant.cantidad AS ant_cantidad,
           ant.fecha_asignacion::text AS ant_fecha, ant.destino_retiro AS ant_destino, ant.motivo_retiro AS ant_motivo,
           ant.detalle_retiro AS ant_detalle,
           nue.articulo_codigo AS nue_codigo, an.descripcion AS nue_descripcion, nue.fecha_asignacion::text AS nue_fecha
    FROM tic_articulo_asignaciones s
    JOIN tic_articulos a ON a.codigo = s.articulo_codigo
    JOIN tic_articulo_movimientos ms ON ms.id = s.movimiento_salida_id
    LEFT JOIN equipos_tecnologicos e ON e.id = s.equipo_id
    LEFT JOIN tic_articulo_asignaciones ant ON ant.id = s.reemplaza_a
    LEFT JOIN tic_articulos aa ON aa.codigo = ant.articulo_codigo
    LEFT JOIN tic_articulo_asignaciones nue ON nue.id = s.reemplazada_por
    LEFT JOIN tic_articulos an ON an.codigo = nue.articulo_codigo
    WHERE s.id = ${id}
  `
  if (!row) return NextResponse.json({ error: 'Asignación no encontrada' }, { status: 404 })
  return NextResponse.json(row)
}

// POST /api/sistemas/repuestos/asignaciones/[id] — retira una asignación vigente (devolución de préstamo,
// devolución del usuario, daño, pérdida...). Si regresa al inventario, el stock sube y queda la entrada en el kardex.
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!canAccessRepuestos(session)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const id = parseInt(params.id, 10)
  const asig = Number.isInteger(id) ? await asignacionVigente(id) : null
  if (!asig) return NextResponse.json({ error: 'La asignación no existe o ya fue cerrada' }, { status: 404 })

  const body = await req.json()
  const destino = texto(body.destino_retiro)
  const motivo  = texto(body.motivo)
  const fecha   = texto(body.fecha)
  if (!destino || !DESTINOS_RETIRO.includes(destino)) return NextResponse.json({ error: 'Indica qué pasa con el artículo' }, { status: 400 })
  if (!motivo || !esFecha(fecha)) return NextResponse.json({ error: 'Fecha y motivo son obligatorios' }, { status: 400 })

  const usuario = session.user?.name ?? 'Sistema'
  const vuelve  = destino === 'inventario'
  const ids     = vuelve ? await reservarIds() : null
  const detalle = texto(body.detalle)
  const donde   = asig.equipo_id ? `equipo ${asig.equipo_id}` : asig.persona_nombre

  const queries: Query[] = []
  if (ids) {
    queries.push(qMovimientoStock({
      id: ids.movRetorno, codigo: asig.articulo_codigo, tipo: 'entrada', cantidad: asig.cantidad, fecha,
      motivo: MOTIVO_RETORNO.devolucion, equipoId: asig.equipo_id, destinoNombre: asig.persona_nombre,
      destinoArea: asig.persona_area, observaciones: `Devuelto por ${donde}. Motivo: ${motivo}${detalle ? ` — ${detalle}` : ''}`,
      usuario, exigirActivo: false, costo: asig.costo_salida == null ? null : Number(asig.costo_salida),
    }))
  }
  queries.push(qCerrarAsignacion({
    asignacionId: id, estado: 'devuelto', destino, fecha, motivo, detalle,
    reemplazadaPor: null, movRetornoId: ids?.movRetorno ?? null, usuario,
  }))

  try {
    await sql.transaction(queries)
  } catch (e) {
    console.error('[asignación retiro]', e)
    return NextResponse.json({ error: 'No se pudo registrar el retiro' }, { status: 500 })
  }

  await logAudit({
    usuarioId: session.user?.id ?? null,
    usuarioNombre: usuario,
    accion: 'TIC_ARTICULO_MOVIMIENTO',
    descripcion: `Retiró asignación #${id}: ${asig.cantidad} × ${asig.articulo_codigo} (${asig.descripcion}) de ${donde}; ${ETIQUETA_DESTINO[destino]}. Motivo: ${motivo}`,
    datos: { asignacion_id: id, destino_retiro: destino, movimiento_id: ids?.movRetorno ?? null },
  })

  return NextResponse.json({ ok: true })
}
