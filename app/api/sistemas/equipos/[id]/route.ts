import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { tieneModulo } from '@/lib/permissions'

function canAccess(session: { user?: { rol?: string; modulos?: string[] } } | null) {
  if (!session?.user) return false
  return tieneModulo(session.user.rol ?? '', session.user.modulos, 'equipos')
}

// GET /api/sistemas/equipos/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!canAccess(session)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const [equipo] = await sql`SELECT * FROM equipos_tecnologicos WHERE id = ${params.id}`
  if (!equipo) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })

  const mantenimientos = await sql`SELECT * FROM equipos_mantenimientos WHERE equipo_id = ${params.id} ORDER BY fecha DESC`
  const incidencias    = await sql`SELECT * FROM equipos_incidencias WHERE equipo_id = ${params.id} ORDER BY fecha_apertura DESC`
  const cambios        = await sql`SELECT * FROM equipos_cambios_componentes WHERE equipo_id = ${params.id} ORDER BY fecha DESC`
  const movimientos    = await sql`
    SELECT m.id, m.fecha::text AS fecha, m.movimiento, m.tipo_movimiento, m.motivo,
           m.origen_nombre, m.destino_nombre, m.estado, a.descripcion, a.cantidad
    FROM tic_movimientos m
    JOIN tic_movimiento_activos a ON a.movimiento_id = m.id
    WHERE a.equipo_id = ${params.id}
    ORDER BY m.fecha DESC
  `

  // Si aún no se corrió la migración de repuestos, la hoja de vida carga igual sin esta sección
  // Asignaciones (vigentes primero, con su historial de reemplazo/devolución) + consumos sin asignación (tóner, etc.)
  const repuestos = await sql`
    SELECT * FROM (
      SELECT s.id, 'asignacion' AS clase, s.fecha_asignacion::text AS fecha, s.articulo_codigo, a.descripcion,
             a.categoria, s.cantidad, s.persona_nombre, s.es_prestamo, s.fecha_limite_prestamo::text AS fecha_limite_prestamo,
             s.estado, s.destino_retiro, s.fecha_retiro::text AS fecha_retiro, s.motivo_retiro, s.detalle_retiro,
             s.reemplaza_a, s.reemplazada_por, r.articulo_codigo AS reemplazada_por_codigo, s.observaciones,
             (s.estado = 'vigente' AND s.es_prestamo AND s.fecha_limite_prestamo < CURRENT_DATE) AS vencido,
             (s.cantidad * ms.costo_unitario)::float AS costo
      FROM tic_articulo_asignaciones s
      JOIN tic_articulos a ON a.codigo = s.articulo_codigo
      JOIN tic_articulo_movimientos ms ON ms.id = s.movimiento_salida_id
      LEFT JOIN tic_articulo_asignaciones r ON r.id = s.reemplazada_por
      WHERE s.equipo_id = ${params.id}
      UNION ALL
      SELECT m.id, 'consumo', m.fecha::text, m.articulo_codigo, a.descripcion, a.categoria, -m.cantidad, m.destino_nombre,
             FALSE, NULL, 'consumo', NULL, NULL, m.motivo, NULL, NULL, NULL, NULL, m.observaciones, FALSE,
             (-m.cantidad * m.costo_unitario)::float
      FROM tic_articulo_movimientos m
      JOIN tic_articulos a ON a.codigo = m.articulo_codigo
      WHERE m.equipo_id = ${params.id} AND m.tipo = 'salida'
        AND NOT EXISTS (SELECT 1 FROM tic_articulo_asignaciones s WHERE s.movimiento_salida_id = m.id)
    ) x
    ORDER BY (estado = 'vigente') DESC, fecha DESC, id DESC
  `.catch(() => [])

  return NextResponse.json({ equipo, mantenimientos, incidencias, cambios, movimientos, repuestos })
}

// PUT /api/sistemas/equipos/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!canAccess(session)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const [existe] = await sql`SELECT id FROM equipos_tecnologicos WHERE id = ${params.id}`
  if (!existe) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })

  const body = await req.json()

  await sql`
    UPDATE equipos_tecnologicos SET
      placa_activo = ${body.placa_activo || null},
      cod_barras = ${body.cod_barras || null},
      tipo_equipo = ${body.tipo_equipo},
      marca = ${body.marca},
      modelo = ${body.modelo || null},
      numero_serie = ${body.numero_serie || null},
      numero_interno = ${body.numero_interno || null},
      procesador = ${body.procesador || null},
      nucleos_procesador = ${body.nucleos_procesador || null},
      velocidad_procesador = ${body.velocidad_procesador || null},
      ram_capacidad = ${body.ram_capacidad || null},
      ram_tipo = ${body.ram_tipo || null},
      disco_tipo = ${body.disco_tipo || null},
      disco_capacidad = ${body.disco_capacidad || null},
      disco_secundario = ${body.disco_secundario || null},
      unidad_optica = ${body.unidad_optica || null},
      camara_integrada = ${body.camara_integrada ?? false},
      tarjeta_video = ${body.tarjeta_video || null},
      fuente_poder = ${body.fuente_poder || null},
      monitor_marca = ${body.monitor_marca || null},
      monitor_modelo = ${body.monitor_modelo || null},
      monitor_serial = ${body.monitor_serial || null},
      monitor_pulgadas = ${body.monitor_pulgadas || null},
      monitor_resolucion = ${body.monitor_resolucion || null},
      monitor_tipo_panel = ${body.monitor_tipo_panel || null},
      impresora_tipo = ${body.impresora_tipo || null},
      toner_referencia = ${body.toner_referencia || null},
      toner_rendimiento = ${body.toner_rendimiento || null},
      toner_ultimo_cambio = ${body.toner_ultimo_cambio || null},
      toner_proximo_cambio = ${body.toner_proximo_cambio || null},
      impresora_en_red = ${body.impresora_en_red ?? false},
      ip_asignada = ${body.ip_asignada || null},
      mascara_subred = ${body.mascara_subred || null},
      gateway = ${body.gateway || null},
      dns_primario = ${body.dns_primario || null},
      mac_address = ${body.mac_address || null},
      tipo_conexion = ${body.tipo_conexion || null},
      hostname = ${body.hostname || null},
      dominio = ${body.dominio || null},
      ip_asignada_2 = ${body.ip_asignada_2 || null},
      mascara_subred_2 = ${body.mascara_subred_2 || null},
      gateway_2 = ${body.gateway_2 || null},
      dns_primario_2 = ${body.dns_primario_2 || null},
      mac_address_2 = ${body.mac_address_2 || null},
      tipo_conexion_2 = ${body.tipo_conexion_2 || null},
      sistema_operativo = ${body.sistema_operativo || null},
      version_so = ${body.version_so || null},
      licencia_so = ${body.licencia_so || null},
      office_version = ${body.office_version || null},
      licencia_office = ${body.licencia_office || null},
      antivirus = ${body.antivirus || null},
      version_antivirus = ${body.version_antivirus || null},
      licencia_antivirus = ${body.licencia_antivirus || null},
      software_adicional = ${body.software_adicional || null},
      sede = ${body.sede || null},
      area_ubicacion = ${body.area_ubicacion || null},
      departamento_ubicacion = ${body.departamento_ubicacion || null},
      responsable = ${body.responsable || null},
      cargo_responsable = ${body.cargo_responsable || null},
      usuario_asignado = ${body.usuario_asignado || null},
      ext_telefonica = ${body.ext_telefonica || null},
      piso_oficina = ${body.piso_oficina || null},
      puesto_trabajo = ${body.puesto_trabajo || null},
      estado = ${body.estado || 'Activo'},
      condicion_fisica = ${body.condicion_fisica || null},
      forma_adquisicion = ${body.forma_adquisicion || null},
      fecha_adquisicion = ${body.fecha_adquisicion || null},
      valor_adquisicion = ${body.valor_adquisicion || null},
      proveedor = ${body.proveedor || null},
      tipo_garantia = ${body.tipo_garantia || null},
      fecha_inicio_garantia = ${body.fecha_inicio_garantia || null},
      fecha_fin_garantia = ${body.fecha_fin_garantia || null},
      en_garantia = ${body.en_garantia ?? false},
      contrato_numero = ${body.contrato_numero || null},
      tipo_mantenimiento = ${body.tipo_mantenimiento || null},
      frecuencia_mantenimiento = ${body.frecuencia_mantenimiento || null},
      ultimo_mantenimiento = ${body.ultimo_mantenimiento || null},
      proximo_mantenimiento = ${body.proximo_mantenimiento || null},
      tecnico_responsable = ${body.tecnico_responsable || null},
      contrato_mantenimiento = ${body.contrato_mantenimiento || null},
      observaciones = ${body.observaciones || null},
      fecha_actualizacion = NOW(),
      usuario_actualizacion = ${session.user?.name ?? 'Sistema'}
    WHERE id = ${params.id}
  `

  await logAudit({
    usuarioId: session.user?.id ?? null,
    usuarioNombre: session.user?.name ?? 'Desconocido',
    accion: 'EQUIPO_ACTUALIZADO',
    descripcion: `Actualizó equipo ${params.id}: ${body.marca} ${body.modelo ?? ''}`,
    datos: { id: params.id },
  })

  return NextResponse.json({ id: params.id })
}

// DELETE /api/sistemas/equipos/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user?.rol !== 'admin') return NextResponse.json({ error: 'Solo el admin puede eliminar equipos' }, { status: 403 })

  const [existe] = await sql`SELECT id, marca, modelo FROM equipos_tecnologicos WHERE id = ${params.id}`
  if (!existe) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })

  await sql`DELETE FROM equipos_tecnologicos WHERE id = ${params.id}`

  await logAudit({
    usuarioId: session.user?.id ?? null,
    usuarioNombre: session.user?.name ?? 'Desconocido',
    accion: 'EQUIPO_ELIMINADO',
    descripcion: `Eliminó equipo ${params.id}: ${existe.marca} ${existe.modelo ?? ''}`,
    datos: { id: params.id },
  })

  return NextResponse.json({ ok: true })
}
