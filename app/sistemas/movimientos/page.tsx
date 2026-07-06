'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback, useRef } from 'react'

// ─── Tipos ────────────────────────────────────────────────────────────────────
type MovimientoResumen = {
  id: string; fecha: string; movimiento: string; tipo_movimiento: string
  motivo: string; origen_nombre: string; origen_area: string
  destino_nombre: string; destino_area: string
  estado: string; registrado_por: string; total_activos: number
}
type MovimientoDetalle = MovimientoResumen & {
  origen_documento: string; destino_documento: string; observaciones: string | null
  activos: ActivoDetalle[]
}
type ActivoDetalle = {
  id: number; equipo_id: string; descripcion: string; tipo_activo: string
  cantidad: number; marca: string; modelo: string; numero_serie: string
}
type EquipoBusqueda = {
  id: string; tipo_equipo: string; marca: string; modelo: string
  numero_serie: string; usuario_asignado: string
}
type FilaActivo = {
  equipo_id: string; descripcion: string; tipo_activo: string; cantidad: number
  _busqueda: string; _resultados: EquipoBusqueda[]; _buscando: boolean
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const TIPOS_MOV = [
  'Asignación / Reasignación', 'Traslado Interno', 'Cambio de responsable',
  'Salida por mantenimiento o servicio', 'Préstamo', 'Devolución',
  'Baja / disposición final', 'Movimiento excepcional',
  'Control / movimiento de estibas', 'Herramientas y equipos menores',
]
const MOTIVOS = [
  'Inicio de Labores', 'Cambio de cargo / dependencia', 'Necesidad Operativa',
  'Mantenimiento / Reparación', 'Calibración / Verificación',
  'Evento, bienestar o actividad institucional',
  'Cumplimiento normativo / auditoría', 'Daño, obsolescencia o pérdida',
  'Control logístico de estibas', 'Control de herramientas de terceros / técnicos',
]
const AREAS = [
  'Talento Humano', 'Compras', 'Logística', 'Proyectos',
  'Contabilidad / Financiera', 'Sistemas', 'Mantenimiento', 'Producción',
  'HSE', 'Calidad', 'Auditoría', 'Comercial', 'TAT', 'Otros / Externos',
]
const TIPOS_ACTIVO = [
  'Equipo', 'Herramienta', 'Mobiliario', 'Maquinaria', 'Repuesto',
  'Elemento HSE', 'Equipo de cómputo', 'Equipo de comunicación',
  'Equipo industrial', 'Equipo de medición', 'Equipo de refrigeración',
]
const ESTADOS_COLOR: Record<string, { color: string; bg: string }> = {
  autorizado: { color: '#1e40af', bg: '#dbeafe' },
  entregado:  { color: '#92400e', bg: '#fef3c7' },
  recibido:   { color: '#065f46', bg: '#d1fae5' },
  cerrado:    { color: '#374151', bg: '#f3f4f6' },
}
const FILA_VACIA = (): FilaActivo => ({
  equipo_id: '', descripcion: '', tipo_activo: '', cantidad: 1,
  _busqueda: '', _resultados: [], _buscando: false,
})

// ─── Helpers ──────────────────────────────────────────────────────────────────
function hoy() { return new Date().toISOString().slice(0, 10) }

function Badge({ estado }: { estado: string }) {
  const c = ESTADOS_COLOR[estado] ?? { color: '#374151', bg: '#f3f4f6' }
  return (
    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      color: c.color, background: c.bg, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
      {estado}
    </span>
  )
}

// ─── Impresión ────────────────────────────────────────────────────────────────
function imprimirMovimiento(mov: MovimientoDetalle, baseUrl?: string) {
  // Opciones exactas del formato Excel (2 columnas)
  const TIPOS_COL1 = [
    'Asignación / Reasignación', 'Traslado Interno', 'Cambio de responsable',
    'Salida por mantenimiento o servicio', 'Préstamo',
  ]
  const TIPOS_COL2 = [
    'Devolución', 'Baja / disposición final', 'Movimiento excepcional',
    'Control / movimiento de estibas', 'Herramientas y equipos menores',
  ]
  const MOTIVOS_COL1 = [
    'Inicio de Labores', 'Cambio de cargo / dependencia', 'Necesidad Operativa',
    'Mantenimiento / Reparación', 'Calibración / Verificación',
  ]
  const MOTIVOS_COL2 = [
    'Evento, bienestar o actividad institucional',
    'Cumplimiento normativo / auditoría',
    'Daño, obsolescencia o pérdida',
    'Control logístico de estibas',
    'Control de herramientas de terceros / técnicos',
  ]

  const S = '#2E75B6'  // azul sección — texto blanco
  const L = '#c5d9f1'  // azul claro — etiquetas y th

  const chk = (val: boolean) =>
    `<span style="display:inline-block;width:11px;height:11px;border:1px solid #000;` +
    `text-align:center;line-height:10px;font-size:9px;font-weight:bold;">${val ? 'X' : '&nbsp;'}</span>`

  const [anio, mes, dia] = (mov.fecha || '').split('-')
  const totalActivos = mov.activos.reduce((s, a) => s + a.cantidad, 0)
  const nroConsec = mov.id.replace('TIC-', '')
  const base = baseUrl ?? ''
  const logoKlarens = `${base}/Klarens-logo.png`
  const logoHseq    = `${base}/hseq-logo.png`

  const activosRows = Array.from({ length: Math.max(10, mov.activos.length) }, (_, i) => {
    const a = mov.activos[i]
    return `<tr style="height:20px;">
      <td style="border:1px solid #000;padding:2px 4px;font-size:8pt;">${a?.equipo_id ?? ''}</td>
      <td style="border:1px solid #000;padding:2px 4px;font-size:8pt;">${a?.descripcion ?? ''}</td>
      <td style="border:1px solid #000;padding:2px 4px;font-size:8pt;text-align:center;">${a?.cantidad ?? ''}</td>
      <td style="border:1px solid #000;padding:2px 4px;font-size:8pt;">${a?.tipo_activo ?? ''}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Movimiento ${mov.id}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0;
      -webkit-print-color-adjust:exact !important;
      print-color-adjust:exact !important;
      color-adjust:exact !important; }
  body { font-family:Arial,sans-serif; font-size:8.5pt; color:#000; }
  table { border-collapse:collapse; width:100%; }
  td,th { vertical-align:middle; }
  @page { size:A4 portrait; margin:8mm; }
  @media print { body { font-size:8pt; } }
</style>
</head><body>

<!-- ═══ ENCABEZADO ═══ -->
<!-- Estructura: HSEQ(rowspan=4) | 6 cols centro | Klarens(rowspan=4) -->
<table style="margin-bottom:0;">
  <!-- Fila 1: SISTEMA INTEGRADO HSEQ -->
  <tr>
    <td rowspan="4" style="border:1px solid #000;width:14%;text-align:center;padding:4px;vertical-align:middle;">
      <img src="${logoHseq}" alt="HSEQ" style="max-width:95%;max-height:65px;object-fit:contain;"/>
    </td>
    <td colspan="6" style="border:1px solid #000;text-align:center;padding:3px 4px;font-weight:bold;font-size:8.5pt;vertical-align:middle;">
      SISTEMA INTEGRADO HSEQ
    </td>
    <td rowspan="4" style="border:1px solid #000;width:13%;text-align:center;padding:4px;vertical-align:middle;">
      <img src="${logoKlarens}" alt="Klarens" style="max-width:95%;max-height:55px;object-fit:contain;"/>
    </td>
  </tr>
  <!-- Fila 2: Título principal -->
  <tr>
    <td colspan="6" style="border:1px solid #000;text-align:center;padding:5px 4px;font-weight:bold;font-size:11pt;vertical-align:middle;">
      FORMATO UNICO PARA EL MOVIMIENTO Y CONTROL DE ACTIVOS
    </td>
  </tr>
  <!-- Fila 3: Código / Proceso / Ver -->
  <tr>
    <td style="border:1px solid #000;width:13%;font-size:7.5pt;font-weight:bold;text-align:center;padding:2px 4px;">Código</td>
    <td style="border:1px solid #000;width:20%;font-size:7.5pt;text-align:center;padding:2px 4px;">FR-AI-01</td>
    <td style="border:1px solid #000;width:13%;font-size:7.5pt;font-weight:bold;text-align:center;padding:2px 4px;">Proceso</td>
    <td style="border:1px solid #000;width:8%;font-size:7.5pt;text-align:center;padding:2px 4px;">AI</td>
    <td style="border:1px solid #000;width:8%;font-size:7.5pt;font-weight:bold;text-align:center;padding:2px 4px;">Ver</td>
    <td style="border:1px solid #000;width:7%;font-size:7.5pt;text-align:center;padding:2px 4px;">1</td>
  </tr>
  <!-- Fila 4: Fecha de Creación / Pág -->
  <tr>
    <td colspan="2" style="border:1px solid #000;font-size:7.5pt;font-weight:bold;text-align:center;padding:2px 4px;">Fecha de Creación</td>
    <td colspan="2" style="border:1px solid #000;font-size:7.5pt;text-align:center;padding:2px 4px;">16/02/2026</td>
    <td style="border:1px solid #000;font-size:7.5pt;font-weight:bold;text-align:center;padding:2px 4px;">Pág</td>
    <td style="border:1px solid #000;font-size:7.5pt;text-align:center;padding:2px 4px;">1</td>
  </tr>
</table>

<!-- ═══ FECHA / CONSECUTIVO ═══ -->
<table style="margin-top:3px;margin-bottom:0;border-collapse:collapse;">
  <!-- Fila superior: etiquetas Codigo / Número encima de los boxes -->
  <tr>
    <td colspan="5" style="border:none;padding:0;"></td>
    <td style="border:none;padding:0;"></td>
    <td style="border:none;font-size:6.5pt;font-weight:bold;text-align:center;padding:0 2px;">Codigo</td>
    <td style="border:none;font-size:6.5pt;font-weight:bold;text-align:center;padding:0 2px;">Número</td>
  </tr>
  <!-- Fila principal: FECHA y CONSECUTIVO -->
  <tr>
    <td style="border:1px solid #000;width:8%;font-weight:bold;padding:3px 5px;">FECHA:</td>
    <td style="border:1px solid #000;width:5%;text-align:center;padding:3px;">${dia}</td>
    <td style="border:1px solid #000;width:5%;text-align:center;padding:3px;">${mes}</td>
    <td style="border:1px solid #000;width:7%;text-align:center;padding:3px;">${anio}</td>
    <td style="border:none;width:37%;padding:0;"></td>
    <td style="border:1px solid #000;width:20%;font-weight:bold;text-align:right;padding:3px 6px;white-space:nowrap;">CONSECUTIVO No.</td>
    <td style="border:1px solid #000;width:9%;text-align:center;font-weight:bold;padding:3px;">TIC</td>
    <td style="border:1px solid #000;width:9%;text-align:center;padding:3px;">${nroConsec}</td>
  </tr>
</table>

<!-- ═══ MOVIMIENTO ═══ -->
<table style="margin-top:4px;margin-bottom:3px;">
  <tr>
    <td style="border:none;width:14%;font-weight:bold;padding:3px 0;">MOVIMIENTO:</td>
    <td style="border:none;width:16%;padding:3px 8px;font-weight:bold;">DEFINITIVO &nbsp;${chk(mov.movimiento==='definitivo')}</td>
    <td style="border:none;width:13%;padding:3px 8px;font-weight:bold;">TEMPORAL &nbsp;${chk(mov.movimiento==='temporal')}</td>
    <td style="border:none;padding:3px 8px;font-style:italic;font-size:8pt;">(Aplica devolución obligatoria) &nbsp;${chk(mov.movimiento==='temporal')}</td>
  </tr>
</table>

<!-- ═══ TIPO DE MOVIMIENTO ═══ -->
<table style="margin-bottom:3px;border:1px solid #000;">
  <tr>
    <td colspan="2" style="background:${S};color:#fff;font-weight:bold;font-size:8.5pt;text-align:center;padding:3px 5px;border-bottom:1px solid #000;">TIPO DE MOVIMIENTO:</td>
  </tr>
  <tr>
    <td style="width:50%;vertical-align:top;padding:2px 6px;border-right:1px solid #000;">
      ${TIPOS_COL1.map(t => `<div style="display:flex;justify-content:space-between;align-items:center;padding:1px 0;">${t}&nbsp;${chk(mov.tipo_movimiento===t)}</div>`).join('')}
    </td>
    <td style="width:50%;vertical-align:top;padding:2px 6px;">
      ${TIPOS_COL2.map(t => `<div style="display:flex;justify-content:space-between;align-items:center;padding:1px 0;">${t}&nbsp;${chk(mov.tipo_movimiento===t)}</div>`).join('')}
    </td>
  </tr>
</table>

<!-- ═══ MOTIVO ═══ -->
<table style="margin-bottom:3px;border:1px solid #000;">
  <tr>
    <td colspan="2" style="background:${S};color:#fff;font-weight:bold;font-size:8.5pt;text-align:center;padding:3px 5px;border-bottom:1px solid #000;">MOTIVO DEL MOVIMIENTO</td>
  </tr>
  <tr>
    <td style="width:50%;vertical-align:top;padding:2px 6px;border-right:1px solid #000;">
      ${MOTIVOS_COL1.map(m => `<div style="display:flex;justify-content:space-between;align-items:center;padding:1px 0;">${m}&nbsp;${chk(mov.motivo===m)}</div>`).join('')}
    </td>
    <td style="width:50%;vertical-align:top;padding:2px 6px;">
      ${MOTIVOS_COL2.map(m => `<div style="display:flex;justify-content:space-between;align-items:center;padding:1px 0;">${m}&nbsp;${chk(mov.motivo===m)}</div>`).join('')}
    </td>
  </tr>
</table>

<!-- ═══ ORIGEN / DESTINO ═══ -->
<table style="margin-bottom:0;">
  <tr>
    <td colspan="2" style="background:${S};color:#fff;font-weight:bold;font-size:8.5pt;text-align:center;padding:3px;border:1px solid #000;">DEPENDENCIA DE ORIGEN (ENTREGA)</td>
    <td colspan="2" style="background:${S};color:#fff;font-weight:bold;font-size:8.5pt;text-align:center;padding:3px;border:1px solid #000;">DESTINO (RECIBE)</td>
  </tr>
  <tr>
    <td style="border:1px solid #000;width:12%;font-weight:bold;font-size:8pt;padding:2px 5px;">Nombre</td>
    <td style="border:1px solid #000;width:38%;font-size:8pt;padding:2px 5px;text-align:center;">${mov.origen_nombre}</td>
    <td style="border:1px solid #000;width:12%;font-weight:bold;font-size:8pt;padding:2px 5px;">Nombre</td>
    <td style="border:1px solid #000;width:38%;font-size:8pt;padding:2px 5px;text-align:center;">${mov.destino_nombre}</td>
  </tr>
  <tr>
    <td style="border:1px solid #000;font-weight:bold;font-size:8pt;padding:2px 5px;">No. De Documento</td>
    <td style="border:1px solid #000;font-size:8pt;padding:2px 5px;text-align:center;">${mov.origen_documento}</td>
    <td style="border:1px solid #000;font-weight:bold;font-size:8pt;padding:2px 5px;">No. De Documento</td>
    <td style="border:1px solid #000;font-size:8pt;padding:2px 5px;text-align:center;">${mov.destino_documento}</td>
  </tr>
  <tr>
    <td style="border:1px solid #000;font-weight:bold;font-size:8pt;padding:2px 5px;">Dependencia</td>
    <td style="border:1px solid #000;font-size:8pt;padding:2px 5px;text-align:center;">${mov.origen_area}</td>
    <td style="border:1px solid #000;font-weight:bold;font-size:8pt;padding:2px 5px;">Dependencia</td>
    <td style="border:1px solid #000;font-size:8pt;padding:2px 5px;text-align:center;">${mov.destino_area}</td>
  </tr>
</table>

<!-- ═══ ACTIVOS ═══ -->
<table style="margin-bottom:0;">
  <tr>
    <td colspan="4" style="background:${S};color:#fff;font-weight:bold;font-size:8.5pt;text-align:center;padding:3px 5px;border:1px solid #000;">INFORMACION BASICA DE LOS ACTIVOS</td>
  </tr>
  <tr>
    <th style="background:${L};border:1px solid #000;padding:2px 4px;width:14%;font-size:8pt;text-align:center;vertical-align:middle;">Código (Placa de Activo)</th>
    <th style="background:${L};border:1px solid #000;padding:2px 4px;width:48%;font-size:8pt;text-align:center;">Descripción del Activo</th>
    <th style="background:${L};border:1px solid #000;padding:2px 4px;width:13%;font-size:8pt;text-align:center;">Cantidad</th>
    <th style="background:${L};border:1px solid #000;padding:2px 4px;width:25%;font-size:8pt;text-align:center;">Tipo de Activo</th>
  </tr>
  ${activosRows}
  <tr>
    <td colspan="2" style="border-top:1px solid #000;border-left:none;border-right:none;border-bottom:none;padding:3px 6px;font-weight:bold;font-size:8pt;">TOTAL ACTIVOS ENTREGADOS</td>
    <td style="border-bottom:1px solid #000;border-top:none;border-left:none;border-right:none;padding:3px;"></td>
    <td style="border:none;padding:3px;"></td>
  </tr>
</table>

<!-- ═══ CLÁUSULA ═══ -->
<table style="margin-top:3px;">
  <tr>
    <td style="background:${S};color:#fff;font-weight:bold;font-size:8.5pt;text-align:center;padding:3px;border:1px solid #000;">CLÁUSULA DE COMPROMISO</td>
  </tr>
  <tr>
    <td style="border:1px solid #000;height:32px;padding:3px 6px;font-size:8pt;">
      Me comprometo a hacer buen uso del activo recibido, responder por su cuidado y a devolverlo en las mismas condiciones en que fue entregado.
    </td>
  </tr>
</table>

<!-- ═══ OBSERVACIONES ═══ -->
<table style="margin-top:3px;margin-bottom:3px;">
  <tr>
    <td style="background:${S};color:#fff;font-weight:bold;font-size:8.5pt;text-align:center;padding:3px;border:1px solid #000;">OBSERVACIONES</td>
  </tr>
  <tr>
    <td style="border:1px solid #000;height:30px;padding:3px 6px;font-size:8.5pt;">${mov.observaciones ?? ''}</td>
  </tr>
</table>

<!-- ═══ FIRMAS ═══ -->
<table>
  <tr>
    <td style="border:1px solid #000;text-align:center;font-weight:bold;font-size:8pt;height:55px;width:25%;vertical-align:bottom;padding-bottom:4px;">FIRMA QUIEN ENTREGA</td>
    <td style="border:1px solid #000;text-align:center;font-weight:bold;font-size:8pt;width:25%;vertical-align:bottom;padding-bottom:4px;">FIRMA QUIEN RECIBE</td>
    <td style="border:1px solid #000;text-align:center;font-weight:bold;font-size:8pt;width:25%;vertical-align:bottom;padding-bottom:4px;">FIRMA AUDITORÍA</td>
    <td style="border:1px solid #000;text-align:center;font-weight:bold;font-size:8pt;width:25%;vertical-align:bottom;padding-bottom:4px;">AUTORIZA<br/>(GERENCIA / DEPENDIENTE)</td>
  </tr>
</table>

<script>window.onload = function(){ window.print(); }</script>
</body></html>`

  const w = window.open('', '_blank', 'width=900,height=700')
  if (w) { w.document.write(html); w.document.close() }
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function MovimientosTICPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const rol     = session?.user?.rol ?? ''
  const isAdmin = rol === 'admin'

  useEffect(() => {
    if (status === 'authenticated' && !['admin', 'lider', 'usuario'].includes(rol)) {
      router.replace('/dashboard')
    }
  }, [status, rol, router])

  // Vistas: 'lista' | 'nuevo' | 'detalle'
  const [vista, setVista]           = useState<'lista' | 'nuevo' | 'detalle'>('lista')
  const [lista, setLista]           = useState<MovimientoResumen[]>([])
  const [cargando, setCargando]     = useState(false)
  const [detalle, setDetalle]       = useState<MovimientoDetalle | null>(null)
  const [cargandoDet, setCargandoDet] = useState(false)

  // Filtros listado
  const [fbuscar, setFbuscar] = useState('')
  const [festado, setFestado] = useState('')
  const [fdesde,  setFdesde]  = useState('')
  const [fhasta,  setFhasta]  = useState('')

  // Próximo ID
  const [proximoId, setProximoId] = useState('')

  // Formulario nuevo movimiento
  const [fecha,            setFecha]           = useState(hoy())
  const [movimiento,       setMovimiento]       = useState('definitivo')
  const [tipoMov,          setTipoMov]          = useState('')
  const [motivo,           setMotivo]           = useState('')
  const [origenNombre,     setOrigenNombre]     = useState('')
  const [origenDoc,        setOrigenDoc]        = useState('')
  const [origenArea,       setOrigenArea]       = useState('')
  const [destinoNombre,    setDestinoNombre]    = useState('')
  const [destinoDoc,       setDestinoDoc]       = useState('')
  const [destinoArea,      setDestinoArea]      = useState('')
  const [observaciones,    setObservaciones]    = useState('')
  const [activos,          setActivos]          = useState<FilaActivo[]>([FILA_VACIA()])
  const [guardando,        setGuardando]        = useState(false)
  const [errorForm,        setErrorForm]        = useState('')
  const [exitoForm,        setExitoForm]        = useState('')

  // Cambio de estado (en detalle)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)

  // Debounce refs por fila
  const debounceRefs = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  const cargarLista = useCallback(async () => {
    setCargando(true)
    try {
      const q = new URLSearchParams()
      if (fbuscar) q.set('buscar', fbuscar)
      if (festado) q.set('estado', festado)
      if (fdesde)  q.set('desde', fdesde)
      if (fhasta)  q.set('hasta', fhasta)
      const res  = await fetch(`/api/sistemas/movimientos?${q}`)
      const data = res.ok ? await res.json() : []
      setLista(Array.isArray(data) ? data : [])
    } finally {
      setCargando(false)
    }
  }, [fbuscar, festado, fdesde, fhasta])

  useEffect(() => {
    if (status === 'authenticated') cargarLista()
  }, [status, cargarLista])

  function abrirNuevo() {
    // calcular próximo id desde la lista ya cargada
    if (lista.length > 0) {
      const last = lista[0].id.replace('TIC-', '')
      setProximoId(`TIC-${String(parseInt(last, 10) + 1).padStart(4, '0')}`)
    } else {
      setProximoId('TIC-0001')
    }
    setFecha(hoy()); setMovimiento('definitivo'); setTipoMov(''); setMotivo('')
    setOrigenNombre(''); setOrigenDoc(''); setOrigenArea('')
    setDestinoNombre(''); setDestinoDoc(''); setDestinoArea('')
    setObservaciones(''); setActivos([FILA_VACIA()])
    setErrorForm(''); setExitoForm('')
    setVista('nuevo')
  }

  async function abrirDetalle(id: string) {
    setCargandoDet(true)
    setVista('detalle')
    try {
      const data = await fetch(`/api/sistemas/movimientos/${id}`).then(r => r.json())
      setDetalle(data)
    } finally {
      setCargandoDet(false)
    }
  }

  // ── Búsqueda de equipos por placa ──────────────────────────────────────────
  function onBusquedaEquipo(idx: number, val: string) {
    setActivos(prev => prev.map((f, i) => i === idx ? { ...f, _busqueda: val, equipo_id: val } : f))
    if (debounceRefs.current[idx]) clearTimeout(debounceRefs.current[idx])
    if (val.length < 2) {
      setActivos(prev => prev.map((f, i) => i === idx ? { ...f, _resultados: [] } : f))
      return
    }
    debounceRefs.current[idx] = setTimeout(async () => {
      setActivos(prev => prev.map((f, i) => i === idx ? { ...f, _buscando: true } : f))
      const res = await fetch(`/api/sistemas/equipos?buscar=${encodeURIComponent(val)}`).then(r => r.json())
      setActivos(prev => prev.map((f, i) =>
        i === idx ? { ...f, _buscando: false, _resultados: Array.isArray(res) ? res.slice(0, 6) : [] } : f
      ))
    }, 300)
  }

  function seleccionarEquipo(idx: number, eq: EquipoBusqueda) {
    setActivos(prev => prev.map((f, i) => i === idx ? {
      ...f,
      equipo_id:   eq.id,
      descripcion: `${eq.marca} ${eq.modelo}`.trim(),
      tipo_activo: eq.tipo_equipo,
      _busqueda:   eq.id,
      _resultados: [],
    } : f))
  }

  function actualizarFila(idx: number, campo: keyof FilaActivo, val: string | number) {
    setActivos(prev => prev.map((f, i) => i === idx ? { ...f, [campo]: val } : f))
  }

  function agregarFila() { setActivos(prev => [...prev, FILA_VACIA()]) }
  function quitarFila(idx: number) {
    setActivos(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx))
  }

  // ── Guardar movimiento ─────────────────────────────────────────────────────
  async function guardar() {
    setErrorForm('')
    if (!tipoMov || !motivo) { setErrorForm('Selecciona tipo de movimiento y motivo'); return }
    if (!origenNombre || !origenDoc || !origenArea) { setErrorForm('Completa los datos de origen'); return }
    if (!destinoNombre || !destinoDoc || !destinoArea) { setErrorForm('Completa los datos de destino'); return }
    if (activos.some(a => !a.equipo_id)) { setErrorForm('Selecciona la placa de todos los activos'); return }

    setGuardando(true)
    try {
      const res = await fetch('/api/sistemas/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha, movimiento, tipo_movimiento: tipoMov, motivo,
          origen_nombre: origenNombre, origen_documento: origenDoc, origen_area: origenArea,
          destino_nombre: destinoNombre, destino_documento: destinoDoc, destino_area: destinoArea,
          observaciones: observaciones || null,
          activos: activos.map(a => ({
            equipo_id: a.equipo_id, descripcion: a.descripcion,
            tipo_activo: a.tipo_activo, cantidad: a.cantidad,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorForm(data.error ?? 'Error al guardar'); return }
      setExitoForm(`Movimiento ${data.id} registrado correctamente`)
      cargarLista()
      setTimeout(() => { setVista('lista') }, 1500)
    } finally {
      setGuardando(false)
    }
  }

  // ── Cambiar estado ─────────────────────────────────────────────────────────
  async function cambiarEstado(id: string, estado: string) {
    setCambiandoEstado(true)
    try {
      const res = await fetch(`/api/sistemas/movimientos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      })
      if (res.ok) {
        setDetalle(prev => prev ? { ...prev, estado } : prev)
        cargarLista()
      }
    } finally {
      setCambiandoEstado(false)
    }
  }

  if (status === 'loading') return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <span style={{ color: '#94a3b8' }}>Cargando...</span>
    </div>
  )

  // ══ VISTA DETALLE ══════════════════════════════════════════════════════════
  if (vista === 'detalle') return (
    <div style={{ padding: '24px 20px', maxWidth: 860, margin: '0 auto' }}>
      <button onClick={() => setVista('lista')} style={{ ...btnSec, marginBottom: 20 }}>← Volver</button>

      {cargandoDet || !detalle ? (
        <div style={{ color: '#94a3b8', textAlign: 'center', padding: 60 }}>Cargando...</div>
      ) : (
        <>
          {/* Encabezado */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>{detalle.id}</h1>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                {detalle.fecha} · Registrado por {detalle.registrado_por}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Badge estado={detalle.estado} />
              <button onClick={() => imprimirMovimiento(detalle, window.location.origin)} style={{ ...btnSec, fontSize: 13 }}>🖨️ Imprimir</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <SecCard title="Movimiento">
              <Item label="Tipo" val={detalle.movimiento === 'temporal' ? 'Temporal' : 'Definitivo'} />
              <Item label="Tipo de movimiento" val={detalle.tipo_movimiento} />
              <Item label="Motivo" val={detalle.motivo} />
            </SecCard>
            <SecCard title="Estado">
              <div style={{ marginBottom: 10 }}><Badge estado={detalle.estado} /></div>
              {isAdmin && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {['autorizado','entregado','recibido','cerrado'].map(e => (
                    <button key={e} disabled={cambiandoEstado || detalle.estado === e}
                      onClick={() => cambiarEstado(detalle.id, e)}
                      style={{ ...btnSec, fontSize: 11, padding: '4px 10px',
                        opacity: detalle.estado === e ? 0.4 : 1,
                        background: detalle.estado === e ? '#f1f5f9' : '#fff' }}>
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </SecCard>
            <SecCard title="Origen (Entrega)">
              <Item label="Nombre" val={detalle.origen_nombre} />
              <Item label="Documento" val={detalle.origen_documento} />
              <Item label="Área" val={detalle.origen_area} />
            </SecCard>
            <SecCard title="Destino (Recibe)">
              <Item label="Nombre" val={detalle.destino_nombre} />
              <Item label="Documento" val={detalle.destino_documento} />
              <Item label="Área" val={detalle.destino_area} />
            </SecCard>
          </div>

          {/* Tabla de activos */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
              Activos ({detalle.activos.length})
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Placa','Descripción','Tipo','Serie','Cantidad'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#475569', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detalle.activos.map(a => (
                    <tr key={a.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0047BA', fontFamily: 'monospace' }}>{a.equipo_id}</td>
                      <td style={{ padding: '10px 14px', color: '#1e293b' }}>{a.descripcion}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>{a.tipo_activo}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b', fontFamily: 'monospace', fontSize: 12 }}>{a.numero_serie || '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>{a.cantidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {detalle.observaciones && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' }}>Observaciones</div>
              <div style={{ fontSize: 13, color: '#334155' }}>{detalle.observaciones}</div>
            </div>
          )}
        </>
      )}
    </div>
  )

  // ══ VISTA NUEVO MOVIMIENTO ═════════════════════════════════════════════════
  if (vista === 'nuevo') return (
    <div style={{ padding: '24px 20px', maxWidth: 820, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <button onClick={() => setVista('lista')} style={btnSec}>← Volver</button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>Nuevo Movimiento</h1>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Consecutivo: <b style={{ color: '#0047BA' }}>{proximoId}</b></div>
        </div>
      </div>

      {errorForm && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#991b1b', fontSize: 13 }}>{errorForm}</div>}
      {exitoForm && <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#065f46', fontWeight: 600 }}>{exitoForm}</div>}

      {/* Encabezado del movimiento */}
      <FormSection title="Encabezado">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={lbl}>Fecha *</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Tipo de movimiento *</label>
            <select value={movimiento} onChange={e => setMovimiento(e.target.value)} style={inp}>
              <option value="definitivo">Definitivo</option>
              <option value="temporal">Temporal (requiere devolución)</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Tipo de movimiento *</label>
            <select value={tipoMov} onChange={e => setTipoMov(e.target.value)} style={inp}>
              <option value="">— Selecciona —</option>
              {TIPOS_MOV.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Motivo *</label>
            <select value={motivo} onChange={e => setMotivo(e.target.value)} style={inp}>
              <option value="">— Selecciona —</option>
              {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </FormSection>

      {/* Origen / Destino */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <FormSection title="Origen (Entrega)">
          <label style={lbl}>Nombre *</label>
          <input value={origenNombre} onChange={e => setOrigenNombre(e.target.value)} style={{ ...inp, marginBottom: 10 }} placeholder="Nombre completo" />
          <label style={lbl}>No. de Documento *</label>
          <input value={origenDoc} onChange={e => setOrigenDoc(e.target.value)} style={{ ...inp, marginBottom: 10 }} placeholder="Cédula" />
          <label style={lbl}>Área / Dependencia *</label>
          <select value={origenArea} onChange={e => setOrigenArea(e.target.value)} style={inp}>
            <option value="">— Selecciona —</option>
            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </FormSection>
        <FormSection title="Destino (Recibe)">
          <label style={lbl}>Nombre *</label>
          <input value={destinoNombre} onChange={e => setDestinoNombre(e.target.value)} style={{ ...inp, marginBottom: 10 }} placeholder="Nombre completo" />
          <label style={lbl}>No. de Documento *</label>
          <input value={destinoDoc} onChange={e => setDestinoDoc(e.target.value)} style={{ ...inp, marginBottom: 10 }} placeholder="Cédula" />
          <label style={lbl}>Área / Dependencia *</label>
          <select value={destinoArea} onChange={e => setDestinoArea(e.target.value)} style={inp}>
            <option value="">— Selecciona —</option>
            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </FormSection>
      </div>

      {/* Tabla de activos */}
      <FormSection title="Activos del movimiento">
        {activos.map((fila, idx) => (
          <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', marginBottom: 10, background: '#fafafa', position: 'relative' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 1fr 80px 32px', gap: 10, alignItems: 'start' }}>

              {/* Placa / autocomplete */}
              <div style={{ position: 'relative' }}>
                <label style={lbl}>Placa (KL-XXXX) *</label>
                <input
                  value={fila._busqueda}
                  onChange={e => onBusquedaEquipo(idx, e.target.value)}
                  placeholder="KL-0001"
                  style={{ ...inp, fontFamily: 'monospace', fontSize: 13 }}
                  autoComplete="off"
                />
                {(fila._resultados.length > 0 || fila._buscando) && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.1)', marginTop: 2 }}>
                    {fila._buscando && <div style={{ padding: '10px 12px', color: '#94a3b8', fontSize: 12 }}>Buscando...</div>}
                    {fila._resultados.map(eq => (
                      <div key={eq.id}
                        onClick={() => seleccionarEquipo(idx, eq)}
                        style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                        <b style={{ color: '#0047BA', fontFamily: 'monospace' }}>{eq.id}</b>
                        <span style={{ color: '#334155', marginLeft: 8 }}>{eq.marca} {eq.modelo}</span>
                        {eq.usuario_asignado && <span style={{ color: '#94a3b8', marginLeft: 6 }}>· {eq.usuario_asignado}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label style={lbl}>Descripción</label>
                <input value={fila.descripcion} onChange={e => actualizarFila(idx, 'descripcion', e.target.value)} style={inp} placeholder="Descripción del activo" />
              </div>
              <div>
                <label style={lbl}>Tipo de activo</label>
                <select value={fila.tipo_activo} onChange={e => actualizarFila(idx, 'tipo_activo', e.target.value)} style={inp}>
                  <option value="">— Tipo —</option>
                  {TIPOS_ACTIVO.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Cant.</label>
                <input type="number" min={1} value={fila.cantidad}
                  onChange={e => actualizarFila(idx, 'cantidad', parseInt(e.target.value) || 1)}
                  style={{ ...inp, textAlign: 'center' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 1 }}>
                <button onClick={() => quitarFila(idx)}
                  title="Quitar fila"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 18, lineHeight: 1, padding: '6px 2px' }}>
                  ×
                </button>
              </div>
            </div>
          </div>
        ))}
        <button onClick={agregarFila} style={{ ...btnSec, fontSize: 13, marginTop: 4 }}>+ Agregar equipo</button>
      </FormSection>

      {/* Observaciones */}
      <FormSection title="Observaciones">
        <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)}
          rows={3} placeholder="Notas adicionales..."
          style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
      </FormSection>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
        <button onClick={() => setVista('lista')} style={btnSec}>Cancelar</button>
        <button onClick={guardar} disabled={guardando}
          style={{ ...btnPrimary, opacity: guardando ? 0.7 : 1 }}>
          {guardando ? 'Guardando...' : 'Registrar movimiento'}
        </button>
      </div>
    </div>
  )

  // ══ VISTA LISTADO ══════════════════════════════════════════════════════════
  return (
    <div style={{ padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>Movimientos TIC</h1>
        <button onClick={abrirNuevo} style={btnPrimary}>+ Nuevo movimiento</button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <input value={fbuscar} onChange={e => setFbuscar(e.target.value)}
          placeholder="Buscar por ID, nombre, tipo..."
          style={{ ...inp, maxWidth: 260, flex: 1 }} />
        <select value={festado} onChange={e => setFestado(e.target.value)} style={{ ...inp, maxWidth: 160 }}>
          <option value="">Todos los estados</option>
          <option value="autorizado">Autorizado</option>
          <option value="entregado">Entregado</option>
          <option value="recibido">Recibido</option>
          <option value="cerrado">Cerrado</option>
        </select>
        <input type="date" value={fdesde} onChange={e => setFdesde(e.target.value)} style={{ ...inp, maxWidth: 160 }} />
        <input type="date" value={fhasta} onChange={e => setFhasta(e.target.value)} style={{ ...inp, maxWidth: 160 }} />
        <button onClick={cargarLista} style={btnSec}>Buscar</button>
      </div>

      {/* Tabla */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {cargando ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Cargando...</div>
        ) : lista.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Sin movimientos registrados</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  {['Consecutivo','Fecha','Tipo','Origen','Destino','Activos','Estado',''].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: '#475569', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map(m => (
                  <tr key={m.id} style={{ borderTop: '1px solid #f1f5f9' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#0047BA', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{m.id}</td>
                    <td style={{ padding: '12px 14px', color: '#475569', whiteSpace: 'nowrap' }}>{m.fecha}</td>
                    <td style={{ padding: '12px 14px', color: '#334155', maxWidth: 180 }}>{m.tipo_movimiento}</td>
                    <td style={{ padding: '12px 14px', color: '#334155', whiteSpace: 'nowrap' }}>{m.origen_nombre} <span style={{ color: '#94a3b8', fontSize: 11 }}>({m.origen_area})</span></td>
                    <td style={{ padding: '12px 14px', color: '#334155', whiteSpace: 'nowrap' }}>{m.destino_nombre} <span style={{ color: '#94a3b8', fontSize: 11 }}>({m.destino_area})</span></td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', color: '#475569' }}>{m.total_activos}</td>
                    <td style={{ padding: '12px 14px' }}><Badge estado={m.estado} /></td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => abrirDetalle(m.id)} style={{ ...btnSec, fontSize: 12, padding: '4px 12px' }}>Ver</button>
                        <button
                          onClick={async () => {
                            const res = await fetch(`/api/sistemas/movimientos/${m.id}`)
                            if (res.ok) imprimirMovimiento(await res.json(), window.location.origin)
                          }}
                          style={{ ...btnSec, fontSize: 12, padding: '4px 10px' }} title="Imprimir">
                          🖨️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────────────────────────
function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '16px 18px', marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#0047BA', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
      {children}
    </div>
  )
}
function SecCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#0047BA', marginBottom: 10, textTransform: 'uppercase' }}>{title}</div>
      {children}
    </div>
  )
}
function Item({ label, val }: { label: string; val: string }) {
  return (
    <div style={{ marginBottom: 7 }}>
      <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{label}: </span>
      <span style={{ fontSize: 13, color: '#1e293b' }}>{val}</span>
    </div>
  )
}

// ── Estilos ────────────────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: '100%', padding: '9px 11px', borderRadius: 8,
  border: '1px solid #e2e8f0', fontSize: 13, color: '#1e293b',
  outline: 'none', boxSizing: 'border-box', background: '#fff',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: '#475569', marginBottom: 5, textTransform: 'uppercase',
}
const btnPrimary: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 10, border: 'none',
  background: '#0047BA', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
}
const btnSec: React.CSSProperties = {
  padding: '9px 18px', borderRadius: 10, border: '1px solid #e2e8f0',
  background: '#fff', color: '#334155', fontWeight: 600, fontSize: 14, cursor: 'pointer',
}
