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

async function generarId(): Promise<string> {
  const rows = await sql`SELECT id FROM equipos_tecnologicos ORDER BY id DESC LIMIT 1`
  if (rows.length === 0) return 'KL-0001'
  const lastNum = parseInt((rows[0].id as string).replace('KL-', ''), 10)
  return `KL-${String(lastNum + 1).padStart(4, '0')}`
}

// GET /api/sistemas/equipos — lista con filtros opcionales
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!canAccess(session)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const buscar = searchParams.get('buscar') ?? ''
  const tipo   = searchParams.get('tipo')   ?? ''
  const estado = searchParams.get('estado') ?? ''

  const rows = await sql`
    SELECT
      id, tipo_equipo, marca, modelo, numero_serie, numero_interno,
      sede, area_ubicacion, usuario_asignado, responsable,
      estado, condicion_fisica, fecha_adquisicion,
      proximo_mantenimiento, fecha_registro, usuario_registro
    FROM equipos_tecnologicos
    WHERE
      (${buscar} = '' OR
        id ILIKE ${'%' + buscar + '%'} OR
        marca ILIKE ${'%' + buscar + '%'} OR
        modelo ILIKE ${'%' + buscar + '%'} OR
        numero_serie ILIKE ${'%' + buscar + '%'} OR
        usuario_asignado ILIKE ${'%' + buscar + '%'} OR
        hostname ILIKE ${'%' + buscar + '%'}
      )
      AND (${tipo} = '' OR tipo_equipo = ${tipo})
      AND (${estado} = '' OR estado = ${estado})
    ORDER BY fecha_registro DESC
  `
  return NextResponse.json(rows)
}

// POST /api/sistemas/equipos — crear equipo
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!canAccess(session)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const body = await req.json()
  const { tipo_equipo, marca } = body

  if (!tipo_equipo?.trim() || !marca?.trim()) {
    return NextResponse.json({ error: 'Tipo de equipo y marca son obligatorios' }, { status: 400 })
  }

  if (body.numero_serie?.trim()) {
    const dup = await sql`SELECT id FROM equipos_tecnologicos WHERE numero_serie = ${body.numero_serie.trim()} LIMIT 1`
    if (dup.length > 0) {
      return NextResponse.json({ error: `Ya existe un equipo con ese número de serie (${dup[0].id})` }, { status: 409 })
    }
  }

  const id = await generarId()

  const [nuevo] = await sql`
    INSERT INTO equipos_tecnologicos (
      id, placa_activo, cod_barras, tipo_equipo, marca, modelo, numero_serie, numero_interno,
      procesador, nucleos_procesador, velocidad_procesador, ram_capacidad, ram_tipo,
      disco_tipo, disco_capacidad, disco_secundario, unidad_optica, camara_integrada, tarjeta_video, fuente_poder,
      monitor_marca, monitor_modelo, monitor_serial, monitor_pulgadas, monitor_resolucion, monitor_tipo_panel,
      impresora_tipo, toner_referencia, toner_rendimiento, toner_ultimo_cambio, toner_proximo_cambio, impresora_en_red,
      ip_asignada, mascara_subred, gateway, dns_primario, mac_address, tipo_conexion, hostname, dominio,
      sistema_operativo, version_so, licencia_so, office_version, licencia_office,
      antivirus, version_antivirus, licencia_antivirus, software_adicional,
      sede, area_ubicacion, departamento_ubicacion, responsable, cargo_responsable,
      usuario_asignado, ext_telefonica, piso_oficina, puesto_trabajo,
      estado, condicion_fisica, forma_adquisicion, fecha_adquisicion, valor_adquisicion,
      proveedor, tipo_garantia, fecha_inicio_garantia, fecha_fin_garantia, en_garantia, contrato_numero,
      tipo_mantenimiento, frecuencia_mantenimiento, ultimo_mantenimiento, proximo_mantenimiento,
      tecnico_responsable, contrato_mantenimiento,
      observaciones, usuario_registro
    ) VALUES (
      ${id},
      ${body.placa_activo || null}, ${body.cod_barras || null},
      ${tipo_equipo.trim()}, ${marca.trim()},
      ${body.modelo || null}, ${body.numero_serie || null}, ${body.numero_interno || null},
      ${body.procesador || null}, ${body.nucleos_procesador || null}, ${body.velocidad_procesador || null},
      ${body.ram_capacidad || null}, ${body.ram_tipo || null},
      ${body.disco_tipo || null}, ${body.disco_capacidad || null}, ${body.disco_secundario || null},
      ${body.unidad_optica || null}, ${body.camara_integrada ?? false}, ${body.tarjeta_video || null}, ${body.fuente_poder || null},
      ${body.monitor_marca || null}, ${body.monitor_modelo || null}, ${body.monitor_serial || null},
      ${body.monitor_pulgadas || null}, ${body.monitor_resolucion || null}, ${body.monitor_tipo_panel || null},
      ${body.impresora_tipo || null}, ${body.toner_referencia || null}, ${body.toner_rendimiento || null},
      ${body.toner_ultimo_cambio || null}, ${body.toner_proximo_cambio || null}, ${body.impresora_en_red ?? false},
      ${body.ip_asignada || null}, ${body.mascara_subred || null}, ${body.gateway || null},
      ${body.dns_primario || null}, ${body.mac_address || null}, ${body.tipo_conexion || null},
      ${body.hostname || null}, ${body.dominio || null},
      ${body.sistema_operativo || null}, ${body.version_so || null}, ${body.licencia_so || null},
      ${body.office_version || null}, ${body.licencia_office || null},
      ${body.antivirus || null}, ${body.version_antivirus || null}, ${body.licencia_antivirus || null},
      ${body.software_adicional || null},
      ${body.sede || null}, ${body.area_ubicacion || null}, ${body.departamento_ubicacion || null},
      ${body.responsable || null}, ${body.cargo_responsable || null},
      ${body.usuario_asignado || null}, ${body.ext_telefonica || null},
      ${body.piso_oficina || null}, ${body.puesto_trabajo || null},
      ${body.estado || 'Activo'}, ${body.condicion_fisica || null},
      ${body.forma_adquisicion || null}, ${body.fecha_adquisicion || null}, ${body.valor_adquisicion || null},
      ${body.proveedor || null}, ${body.tipo_garantia || null},
      ${body.fecha_inicio_garantia || null}, ${body.fecha_fin_garantia || null},
      ${body.en_garantia ?? false}, ${body.contrato_numero || null},
      ${body.tipo_mantenimiento || null}, ${body.frecuencia_mantenimiento || null},
      ${body.ultimo_mantenimiento || null}, ${body.proximo_mantenimiento || null},
      ${body.tecnico_responsable || null}, ${body.contrato_mantenimiento || null},
      ${body.observaciones || null}, ${session.user?.name ?? 'Sistema'}
    )
    RETURNING id
  `

  await logAudit({
    usuarioId: session.user?.id ?? null,
    usuarioNombre: session.user?.name ?? 'Desconocido',
    accion: 'EQUIPO_CREADO',
    descripcion: `Registró equipo ${id}: ${marca.trim()} ${body.modelo ?? ''} (${tipo_equipo.trim()})`,
    datos: { id, tipo_equipo, marca },
  })

  return NextResponse.json({ id: nuevo.id }, { status: 201 })
}
