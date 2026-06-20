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

  return NextResponse.json({ equipo, mantenimientos, incidencias, cambios })
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
