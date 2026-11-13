'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { OrdenCen, EstadoOrdenCen, ResultadoSincronizacion } from '@/types/ordenes-cen'
import { COMPRADORES, nombreComprador } from '@/lib/cen/compradores'
import { DetalleOrdenModal } from '@/components/ordenes-cen/DetalleOrdenModal'
import { AsignarPuntoModal } from '@/components/ordenes-cen/AsignarPuntoModal'
import { TotalesRutaModal } from '@/components/ordenes-cen/TotalesRutaModal'
import { PedidosInstitucionalesModal } from '@/components/ordenes-cen/PedidosInstitucionalesModal'
import { MenuConfiguracion } from '@/components/ordenes-cen/MenuConfiguracion'
import { CambiarRelacionModal } from '@/components/ordenes-cen/CambiarRelacionModal'
import { ElegirAvisoModal, type ModoAviso } from '@/components/ordenes-cen/ElegirAvisoModal'
import { ResultadoEnvioModal, type AvisoCorreo, type FilaResultado } from '@/components/ordenes-cen/ResultadoEnvioModal'
import { ESTADOS, fmtFecha, fmtMoneda, fmtNumero, relacion } from '@/components/ordenes-cen/utils'

type Resumen = { pendientes: number; sin_punto: number; enviadas: number; con_error: number; archivos_error: number }


/** Una sincronización registrada (tabla cen_sincronizaciones, ver lib/cen/registroSincronizacion.ts). */
type Sincronizacion = { id: number; inicio: string; origen: 'vercel-cron' | 'github' | 'manual'; ok: boolean; error: string | null; usuario: string | null }

const ORIGENES: Record<Sincronizacion['origen'], string> = { 'vercel-cron': 'automática (Vercel)', github: 'automática (GitHub)', manual: 'manual' }

/** "hace 5 min", "hace 3 h", "hace 2 días" */
function haceCuanto(fecha: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(fecha).getTime()) / 60000))
  if (min < 1) return 'hace un momento'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  return h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`
}

/** Más de 6 h sin sincronizar ya es raro: hay programadas cada ~4 h (Vercel Cron) y cada 30 min (GitHub). */
const HORAS_ALERTA = 6

// Solo se pueden enviar en lote las órdenes con sucursal asociada que aún no tienen pedido.
const enviable = (o: OrdenCen) => (o.estado === 'pendiente' || o.estado === 'error') && Boolean(o.nit)

/** Fecha de hoy en Colombia (AAAA-MM-DD) menos `dias`, para el filtro por fecha de la OC. */
function fechaBogota(dias = 0): string {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const d = new Date(`${hoy}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - dias)
  return d.toISOString().slice(0, 10)
}

// Filtro por fecha de la OC ("Fecha del documento" en el portal CEN): [desde, hasta] en días atrás desde hoy
const FECHAS_OC: Record<string, { label: string; rango: [number, number] }> = {
  hoy: { label: 'OC de hoy', rango: [0, 0] },
  ayer: { label: 'OC de ayer', rango: [1, 1] },
  semana: { label: 'OC últimos 7 días', rango: [6, 0] },
}

/** Totales de un grupo de órdenes (encabezados de ruta, de relación y de la selección). */
function resumir(os: OrdenCen[]) {
  return {
    n: os.length,
    unidades: os.reduce((s, o) => s + o.total_unidades, 0),
    valor: os.reduce((s, o) => s + o.valor_total, 0),
    peso: os.reduce((s, o) => s + (o.peso_kg ?? 0), 0),
    pesoCompleto: os.every(o => o.peso_kg !== null),
  }
}
const SIN_RELACION = 'Sin relación'
/** Agrupa por relación de despacho (RUTA-MMSS), en orden; las órdenes sin ruta van al final. */
function porRelacion(os: OrdenCen[]): { rel: string; ordenes: OrdenCen[] }[] {
  const m = new Map<string, OrdenCen[]>()
  for (const o of os) { const r = relacion(o.ruta, o.fecha_despacho) ?? SIN_RELACION; m.set(r, [...(m.get(r) ?? []), o]) }
  return Array.from(m, ([rel, ordenes]) => ({ rel, ordenes })).sort((a, b) => Number(a.rel === SIN_RELACION) - Number(b.rel === SIN_RELACION) || a.rel.localeCompare(b.rel))
}
// Con productos sin peso en el maestro se muestra lo que se conoce con * (no "peso incompleto")
const kgTexto = (t: { peso: number; pesoCompleto: boolean }) => `${fmtNumero(t.peso, 1)} kg${t.pesoCompleto ? '' : '*'}`
const TITULO_PESO = 'Peso parcial: hay productos sin peso en el maestro (Configuración → Productos)'

// Preferencia: incluir los totales por ítem y por cliente en el correo a facturación (se recuerda en el navegador)
const CLAVE_TOTALES = 'cen-correo-totales'

const sel: React.CSSProperties = { padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: '#fff' }

export default function OrdenesCenPage() {
  const [ordenes, setOrdenes] = useState<OrdenCen[]>([])
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [cargando, setCargando] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [resultadoSync, setResultadoSync] = useState<ResultadoSincronizacion[] | null>(null)
  const [error, setError] = useState('')

  const [estado, setEstado] = useState<EstadoOrdenCen | ''>('')
  const [comprador, setComprador] = useState('')
  const [fuente, setFuente] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [buscar, setBuscar] = useState('')
  const [ruta, setRuta] = useState('')
  const [fechaOc, setFechaOc] = useState('') // '' | hoy | ayer | semana
  const [orden, setOrden] = useState<'entrega' | 'oc'>('entrega')
  const [vista, setVista] = useState<'punto' | 'ruta'>('ruta')
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set()) // las secciones arrancan recogidas
  // Relaciones (ruta|relación) con el estado contrario al de arranque: abiertas si la ruta tiene varias, recogida si es la única
  const [relAlternadas, setRelAlternadas] = useState<Set<string>>(new Set())
  const [rutas, setRutas] = useState<string[]>([])

  const [detalleId, setDetalleId] = useState<number | null>(null)
  const [asignarEan, setAsignarEan] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set())
  const [envio, setEnvio] = useState<{ total: number; resultados: FilaResultado[]; enCurso: boolean; aviso?: AvisoCorreo | null } | null>(null)
  const [avisoRuta, setAvisoRuta] = useState<{ ruta: string; aviso: AvisoCorreo } | null>(null) // resultado del aviso manual de una ruta
  const [sinAviso, setSinAviso] = useState<Set<number>>(new Set()) // pedidos en Siesa sin avisar a facturación
  const [avisando, setAvisando] = useState('')
  const [totales, setTotales] = useState<{ titulo: string; ruta: string | null; ids: number[]; secciones?: { titulo: string; ids: number[] }[]; inicial?: string } | null>(null)
  const [preguntaUno, setPreguntaUno] = useState<OrdenCen | null>(null)
  const [moverRelacion, setMoverRelacion] = useState<{ ids: number[]; actual: string | null } | null>(null)
  const [sincronizaciones, setSincronizaciones] = useState<Sincronizacion[]>([])
  const [institucional, setInstitucional] = useState(false)

  // Últimas sincronizaciones (programadas y manuales); si la API falla, simplemente no se muestran
  const cargarSincronizaciones = useCallback(() => {
    fetch('/api/logistica/ordenes-cen/sincronizaciones').then(r => r.ok ? r.json() : []).then(setSincronizaciones).catch(() => {})
  }, [])
  useEffect(() => { cargarSincronizaciones() }, [cargarSincronizaciones])

  const cargar = useCallback(async () => {
    setCargando(true); setError('')
    const rango = FECHAS_OC[fechaOc]?.rango
    const qs = new URLSearchParams({
      estado, comprador, fuente, desde, hasta, buscar, ruta, orden,
      oc_desde: rango ? fechaBogota(rango[0]) : '', oc_hasta: rango ? fechaBogota(rango[1]) : '',
    })
    try {
      const res = await fetch(`/api/logistica/ordenes-cen?${qs}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudieron cargar las órdenes')
      const pendientesAviso = new Set<number>(data.sin_aviso ?? [])
      setOrdenes(data.ordenes); setResumen(data.resumen); setSinAviso(pendientesAviso)
      // Quita de la selección lo que ya no está visible o ya no se puede enviar ni avisar
      const visibles = new Set((data.ordenes as OrdenCen[]).filter(o => enviable(o) || (o.fuente === 'institucional' && pendientesAviso.has(o.id))).map(o => o.id))
      setSeleccion(prev => new Set(Array.from(prev).filter(id => visibles.has(id))))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setCargando(false)
    }
  }, [estado, comprador, fuente, desde, hasta, buscar, ruta, fechaOc, orden])

  useEffect(() => { cargar() }, [cargar])

  // La barra de selección va fija al pie de la ventana (position: fixed), alineada con el contenido de la
  // página: con sticky no funciona porque <main> del layout tiene overflow propio y no es el que se desplaza.
  const paginaRef = useRef<HTMLDivElement>(null)
  const [barra, setBarra] = useState<{ left: number; width: number } | null>(null)
  const haySeleccion = seleccion.size > 0
  useEffect(() => {
    const el = paginaRef.current
    if (!haySeleccion || !el) return
    const medir = () => {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el)
      const izq = parseFloat(cs.paddingLeft) || 0, der = parseFloat(cs.paddingRight) || 0
      setBarra({ left: r.left + izq, width: r.width - izq - der }) // mismo ancho que el contenido
    }
    medir()
    const ro = new ResizeObserver(medir); ro.observe(el)
    window.addEventListener('resize', medir)
    return () => { ro.disconnect(); window.removeEventListener('resize', medir) }
  }, [haySeleccion])

  // Con una ventana abierta (totales, detalle...) la barra fija se oculta para no quedar encima
  const hayVentana = Boolean(totales || moverRelacion || preguntaUno || detalleId !== null || asignarEan || institucional || avisoRuta || (envio && !envio.enCurso))

  const hayFiltros = Boolean(estado || comprador || fuente || desde || hasta || buscar || ruta || fechaOc || orden !== 'entrega')
  function limpiarFiltros() {
    setEstado(''); setComprador(''); setFuente(''); setDesde(''); setHasta(''); setBuscar(''); setRuta(''); setFechaOc(''); setOrden('entrega')
  }
  useEffect(() => {
    fetch('/api/logistica/ordenes-cen/reglas').then(r => r.ok ? r.json() : []).then((rs: { ruta: string }[]) =>
      setRutas(Array.from(new Set(rs.map(r => r.ruta))).sort()))
  }, [])

  async function sincronizar() {
    setSincronizando(true); setResultadoSync(null); setError('')
    try {
      const res = await fetch('/api/logistica/ordenes-cen/sincronizar', { method: 'POST' })
      // Si Vercel corta la función (tiempo máximo) responde HTML, no JSON: se avisa en vez de quedar en silencio
      const data = await res.json().catch(() => null)
      if (!data) throw new Error(`No se pudieron traer las órdenes (respuesta ${res.status}${res.status === 504 ? ': el SFTP tardó demasiado' : ''}). Vuelve a intentar en un momento.`)
      if (!res.ok) throw new Error(data.error ?? 'No se pudo sincronizar')
      setResultadoSync(data)
      await cargar()
      cargarSincronizaciones()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSincronizando(false)
    }
  }

  // Agrupa por punto de venta (sucursal de Siesa, o EAN si no está homologado) o por
  // relación de despacho (ruta + semana de entrega).
  const grupos = useMemo(() => {
    const m = new Map<string, { clave: string; titulo: string; subtitulo: string; sinPunto: boolean; ean: string; ruta: string | null; ordenes: OrdenCen[] }>()
    for (const o of ordenes) {
      let clave: string, titulo: string, subtitulo: string
      if (vista === 'ruta') {
        // Una sección por ruta; las relaciones (ruta + semana de entrega) se listan en el subtítulo.
        clave = o.ruta ?? 'sin-ruta'
        titulo = o.ruta ? `Ruta ${o.ruta}` : 'Sin ruta asignada'
        subtitulo = o.ruta ? '' : 'Asigna la ruta desde el detalle de cada orden o crea una regla'
      } else {
        clave = o.nit ? `${o.nit}/${o.sucursal}` : `ean:${o.ean_entrega}`
        titulo = o.razon_social ?? `Punto sin homologar · ${nombreComprador(o.ean_comprador)}`
        subtitulo = o.nit ? `NIT ${o.nit} · Sucursal ${o.sucursal}${o.ciudad ? ` · ${o.ciudad}` : ''}${o.ean_entrega ? ` · EAN ${o.ean_entrega}` : ''}` : `EAN de entrega ${o.ean_entrega}`
      }
      if (!m.has(clave)) m.set(clave, { clave, titulo, subtitulo, sinPunto: vista === 'punto' ? !o.nit : !o.ruta, ean: o.ean_entrega, ruta: vista === 'ruta' ? o.ruta : null, ordenes: [] })
      m.get(clave)!.ordenes.push(o)
    }
    if (vista === 'ruta') {
      for (const g of Array.from(m.values())) {
        if (!g.ruta) continue
        const rels = Array.from(new Set(g.ordenes.map(o => relacion(o.ruta, o.fecha_despacho)).filter(Boolean))).sort()
        g.subtitulo = `${rels.length === 1 ? 'Relación' : 'Relaciones'} ${rels.join(', ')}`
      }
    }
    // Primero los que necesitan atención (sin punto / sin ruta)
    return Array.from(m.values()).sort((a, b) => Number(b.sinPunto) - Number(a.sinPunto) || a.titulo.localeCompare(b.titulo))
  }, [ordenes, vista])

  // Se puede seleccionar: lo que se envía a Siesa y los PVK institucionales que aún no se han avisado
  // (no se envían a Siesa, ya existen allá: solo se incluyen en el correo a facturación)
  const esPvk = (o: OrdenCen) => o.fuente === 'institucional'
  const seleccionable = (o: OrdenCen) => enviable(o) || (esPvk(o) && sinAviso.has(o.id))

  const [totalesCorreo, setTotalesCorreo] = useState(true)
  useEffect(() => { try { setTotalesCorreo(localStorage.getItem(CLAVE_TOTALES) !== '0') } catch { /* sin almacenamiento */ } }, [])
  function cambiarTotalesCorreo(v: boolean) {
    setTotalesCorreo(v)
    try { localStorage.setItem(CLAVE_TOTALES, v ? '1' : '0') } catch { /* solo por esta vez */ }
  }

  const marcar = (ids: number[], marcado: boolean) => setSeleccion(prev => {
    const n = new Set(prev); for (const id of ids) { if (marcado) n.add(id); else n.delete(id) } return n
  })

  // Envía a Siesa las órdenes seleccionadas, una por una (cada pedido se valida igual que en el detalle), y
  // al final un solo correo a facturación con los creados y los PVK institucionales seleccionados.
  async function enviarSeleccion(modoUno?: ModoAviso) {
    const elegidas = ordenes.filter(o => seleccion.has(o.id))
    const lista = elegidas.filter(enviable)
    const pvk = elegidas.filter(o => esPvk(o) && sinAviso.has(o.id))
    if (!lista.length && !pvk.length) return
    // Un solo pedido: se avisa y se pregunta si el correo va solo o con el consolidado de su ruta
    if (lista.length === 1 && !pvk.length && !modoUno) { setPreguntaUno(lista[0]); return }
    const textoPvk = pvk.length ? `\n\n${pvk.length} pedido(s) institucional(es) (PVK) van solo en el correo a facturación: ya existen en Siesa.` : ''
    const pregunta = lista.length
      ? `Se crearán ${lista.length} pedido(s) en Siesa.\n\nLas alertas (precio, bodega por defecto, fecha vencida...) se darán por revisadas; las órdenes con bloqueos no se envían.${textoPvk}\n\n¿Continuar?`
      : `Se enviará el correo a facturación con ${pvk.length} pedido(s) institucional(es) (PVK).\n\n¿Continuar?`
    if (!modoUno && !window.confirm(pregunta)) return
    setEnvio({ total: lista.length, resultados: [], enCurso: true })
    const resultados: FilaResultado[] = []
    for (const o of lista) {
      const base = { id: o.id, oc: o.numero_orden, cliente: o.razon_social, valor: o.valor_total }
      let r: FilaResultado
      try {
        const res = await fetch(`/api/logistica/ordenes-cen/${o.id}/pedido`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmaAlertas: true, aviso: false }),
        })
        const data = await res.json()
        const bloqueos: string[] = (data.prep?.avisos ?? []).filter((a: { nivel: string }) => a.nivel === 'bloqueo').map((a: { mensaje: string }) => a.mensaje)
        r = { ...base, ok: Boolean(data.ok), pedido: data.consecutivo ?? null, retenido: data.retenido || null,
          mensaje: [data.mensaje ?? data.error ?? 'Respuesta desconocida', ...(data.ok ? [] : bloqueos)].join(' · ') }
      } catch (e) {
        r = { ...base, ok: false, mensaje: e instanceof Error ? e.message : 'Error de conexión' }
      }
      resultados.push(r)
      setEnvio(prev => prev && { ...prev, resultados: [...prev.resultados, r] })
    }
    // Un solo correo a facturación: los pedidos creados y los PVK seleccionados (solo esos)
    const paraAviso = [...resultados.filter(r => r.ok).map(r => r.id), ...pvk.map(o => o.id)]
    let aviso: AvisoCorreo | null = null
    if (paraAviso.length) {
      aviso = await fetch('/api/logistica/ordenes-cen/aviso-facturacion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modoUno === 'ruta' && lista[0]?.ruta
          ? { ruta: lista[0].ruta, totales: totalesCorreo } // consolidado de la ruta (incluye el recién creado)
          : { ids: paraAviso, solo_seleccion: true, totales: totalesCorreo }),
      }).then(r => r.json()).then(d => ({ ...d, ok: Boolean(d.ok), mensaje: d.mensaje ?? d.error ?? 'Respuesta desconocida' }))
        .catch(() => ({ ok: false, mensaje: 'No se pudo enviar el aviso a facturación: usa "Avisar a facturación" en la ruta para reintentar.' }))
    }
    setEnvio(prev => prev && { ...prev, enCurso: false, aviso })
    setSeleccion(new Set())
    await cargar()
  }

  // Aviso manual a facturación de todo lo pendiente de una ruta (reintento o institucionales agregados después)
  async function avisarRuta(ruta: string, n: number) {
    if (!window.confirm(`Se enviará a facturación el correo con ${n} pedido(s) de la ruta ${ruta} que aún no se han avisado (más los institucionales de esas relaciones).

¿Continuar?`)) return
    setAvisando(ruta); setAviso('')
    try {
      const d = await fetch('/api/logistica/ordenes-cen/aviso-facturacion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ruta, totales: totalesCorreo }),
      }).then(r => r.json())
      setAvisoRuta({ ruta, aviso: { ...d, ok: Boolean(d.ok), mensaje: d.mensaje ?? d.error ?? 'Respuesta desconocida' } })
      await cargar()
    } catch {
      setAvisoRuta({ ruta, aviso: { ok: false, mensaje: 'No se pudo enviar el aviso a facturación. Intenta de nuevo.' } })
    } finally { setAvisando('') }
  }

  const alternarRel = (clave: string) => setRelAlternadas(prev => {
    const n = new Set(prev); if (n.has(clave)) n.delete(clave); else n.add(clave); return n
  })
  const alternar = (clave: string) => setAbiertos(prev => {
    const n = new Set(prev); if (n.has(clave)) n.delete(clave); else n.add(clave); return n
  })

  // Tabla de órdenes de una sección. Compacta (7 columnas) para que quepa sin desplazamiento lateral;
  // si el espacio es angosto cada fila pasa a tarjeta (logistica.css, consulta de contenedor .cen-lista).
  // conRuta: columna Ruta/Relación (en la vista por ruta ya la da el subgrupo de la relación).
  const tablaOrdenes = (lista: OrdenCen[], conRuta: boolean) => (
    <div className="cen-scroll">
      <table className="inv-table cen-tabla cen-tarjetas cen-ordenes">
        <thead>
          <tr>
            <th style={{ width: 36 }}></th><th>OC</th><th>Punto de venta</th>{conRuta && <th>{vista === 'ruta' ? 'Relación' : 'Ruta'}</th>}
            <th>Entrega</th><th style={{ textAlign: 'right' }}>Cantidad</th><th style={{ textAlign: 'right' }}>Valor</th><th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {lista.map(o => (
            <tr key={o.id} onClick={() => setDetalleId(o.id)} style={{ cursor: 'pointer', background: seleccion.has(o.id) ? '#EFF6FF' : undefined }}>
              <td className="sel" data-label="" onClick={e => e.stopPropagation()}>
                <input type="checkbox" disabled={!seleccionable(o) || envio?.enCurso} checked={seleccion.has(o.id)}
                  title={enviable(o) ? 'Seleccionar para enviar a Siesa' : esPvk(o) ? (sinAviso.has(o.id) ? 'Incluir en el correo a facturación' : 'Ya se avisó a facturación')
                    : o.estado === 'enviado' ? 'Ya tiene pedido en Siesa' : !o.nit ? 'Sin sucursal asociada' : 'No se puede enviar'}
                  onChange={e => marcar([o.id], e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
              </td>
              <td data-label="OC" className="nw" data-orden={o.numero_orden}>
                <div>
                  <strong>{o.numero_orden}</strong>
                  <span className="sub">{nombreComprador(o.ean_comprador)}{o.locales > 0 && ` · CEDI, ${o.locales} tiendas`}</span>
                </div>
              </td>
              <td data-label="Punto" className="ancho">
                <div>
                  {o.razon_social ?? <span style={{ color: '#B45309' }}>Sin sucursal asociada</span>}
                  <span className="sub">
                    {[o.nit && `${o.nit}/${o.sucursal}`, o.ciudad, o.ean_entrega && `EAN ${o.ean_entrega}`].filter(Boolean).join(' · ')}
                  </span>
                </div>
              </td>
              {conRuta && (
                <td data-label={vista === 'ruta' ? 'Relación' : 'Ruta'} className="nw">
                  {o.ruta ? <strong>{vista === 'ruta' ? relacion(o.ruta, o.fecha_despacho) : o.ruta}{o.ruta_manual && <span title="Asignada a mano" style={{ color: 'var(--text2)' }}> ✋</span>}</strong> : <span style={{ color: '#B45309' }}>Sin ruta</span>}
                </td>
              )}
              <td data-label="Entrega" className="nw" data-orden={o.fecha_entrega ?? ''}>
                <div>{fmtFecha(o.fecha_entrega)}<span className="sub">OC {fmtFecha(o.fecha_orden)}</span></div>
              </td>
              <td data-label="Cantidad" className="num" data-orden={String(o.total_unidades)}>
                <div>{fmtNumero(o.total_unidades)} und<span className="sub">{o.peso_kg === null ? 'sin peso' : `${fmtNumero(o.peso_kg, 1)} kg`} · {o.lineas} prod.</span></div>
              </td>
              <td data-label="Valor" className="num">{fmtMoneda(o.valor_total)}</td>
              <td data-label="Estado" data-orden={ESTADOS[o.estado].label}>
                <div>
                  <span style={{ background: ESTADOS[o.estado].bg, color: ESTADOS[o.estado].color, padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {ESTADOS[o.estado].label}
                  </span>
                  {o.siesa_consecutivo && <span className="sub" style={{ fontWeight: 700, color: '#047857', fontSize: 12, marginTop: 3 }}>{o.siesa_consecutivo}</span>}
                  {o.motivos.length > 0 && <div className="cen-motivos">⚠ {o.motivos.join(' · ')}</div>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  // Cifras de un encabezado (ruta, relación): OC, unidades, peso y valor
  const cifras = (t: ReturnType<typeof resumir>, extra?: React.ReactNode) => (
    <div className="cen-cifras">
      <span><strong>{t.n}</strong> OC</span>
      <span><strong>{fmtNumero(t.unidades)}</strong> und</span>
      <span title={t.pesoCompleto ? undefined : TITULO_PESO}><strong>{fmtNumero(t.peso, 1)}</strong> kg{!t.pesoCompleto && <strong style={{ color: '#B45309' }}>*</strong>}</span>
      <span className="cen-cifra-valor"><strong>{fmtMoneda(t.valor)}</strong></span>
      {extra}
    </div>
  )

  // Casilla para marcar todas las órdenes seleccionables de una sección (por enviar a Siesa y PVK sin avisar)
  const casillaGrupo = (ids: number[], titulo: string) => {
    const marcadas = ids.filter(id => seleccion.has(id)).length
    return (
      <input type="checkbox" title={ids.length ? `Seleccionar las órdenes de ${titulo} que se pueden enviar o avisar` : `Nada de ${titulo} se puede enviar ni avisar`}
        disabled={!ids.length || envio?.enCurso} checked={ids.length > 0 && marcadas === ids.length}
        ref={el => { if (el) el.indeterminate = marcadas > 0 && marcadas < ids.length }}
        onClick={e => e.stopPropagation()} onChange={e => marcar(ids, e.target.checked)}
        style={{ width: 16, height: 16, cursor: 'pointer' }} />
    )
  }

  return (
    <div className="cen-page" ref={paginaRef} style={haySeleccion ? { paddingBottom: 140 } : undefined}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Órdenes EDI (CEN)</h1>
          <p style={{ color: 'var(--text2)', fontSize: 14 }}>Órdenes de compra de las cadenas que llegan por Carvajal y Subrik, organizadas por ruta y punto de venta.</p>
        </div>
        <div className="cen-acciones" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Uso diario a la vista; reglas y configuración agrupadas en un menú */}
          <Link href="/logistica/ordenes-cen/reportes" className="btn">📊 Reportes</Link>
          <button className="btn" onClick={() => setInstitucional(true)} title="Agregar a una ruta pedidos ya creados en Siesa">+ Pedido institucional</button>
          <button className="btn btn-primary" onClick={sincronizar} disabled={sincronizando}>
            {sincronizando ? 'Trayendo órdenes...' : '⟳ Traer órdenes'}
          </button>
          <MenuConfiguracion />
        </div>
      </div>

      {sincronizaciones.length > 0 && (() => {
        const ultima = sincronizaciones[0]
        const vieja = Date.now() - new Date(ultima.inicio).getTime() > HORAS_ALERTA * 3600_000
        const color = !ultima.ok ? 'var(--danger)' : vieja ? '#b45309' : 'var(--text2)'
        // Al pasar el mouse: las últimas 10, para ver si las programadas están corriendo
        const historial = sincronizaciones.map(s =>
          `${new Date(s.inicio).toLocaleString('es-CO')} · ${ORIGENES[s.origen]}${s.usuario ? ' (' + s.usuario + ')' : ''} · ${s.ok ? 'ok' : 'con error'}`).join('\n')
        return (
          <p title={historial} style={{ fontSize: 13, color, marginTop: -8, marginBottom: 16 }}>
            {ultima.ok ? '●' : '⚠'} Última sincronización: <strong>{haceCuanto(ultima.inicio)}</strong> · {ORIGENES[ultima.origen]}
            {!ultima.ok && ' · terminó con error, revisa las credenciales del SFTP o vuelve a intentar'}
            {ultima.ok && vieja && ` · más de ${HORAS_ALERTA} h sin sincronizar: revisa los Cron Jobs de Vercel`}
          </p>
        )
      })()}

      {resultadoSync && (
        <div className="card" style={{ marginBottom: 16, fontSize: 13 }}>
          {resultadoSync.map(r => (
            <div key={r.fuente} style={{ marginBottom: 4 }}>
              <strong>{r.fuente === 'carvajal' ? 'Carvajal (CEN)' : 'Subrik'}:</strong>{' '}
              {!r.configurada ? 'sin credenciales configuradas'
                : r.error ? <span style={{ color: 'var(--danger)' }}>no se pudo conectar ({r.error})</span>
                : <>
                    {r.nuevas} nuevas · {r.actualizadas} actualizadas
                    {r.omitidas > 0 && ` · ${r.omitidas} ya enviadas a Siesa (sin cambios)`}
                    {r.pendientesPorTraer > 0 && ` · faltan ${r.pendientesPorTraer}, vuelve a traer`}
                    {r.porRevisar.length > 0 && <span style={{ color: '#B45309', fontWeight: 600 }}> · ⚠ {r.porRevisar.length} quedaron por revisar (sin sucursal asociada): {r.porRevisar.join(', ')}</span>}
                    {r.errores.length > 0 && <span style={{ color: 'var(--danger)' }}> · {r.errores.length} archivo(s) con error: {r.errores.map(e => `${e.archivo} (${e.error})`).join('; ')}</span>}
                  </>}
            </div>
          ))}
        </div>
      )}
      {aviso && <div className="card" style={{ marginBottom: 16, color: 'var(--accent2)', fontSize: 13 }}>{aviso}</div>}
      {error && <div className="card" style={{ marginBottom: 16, color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

      {resumen && resumen.sin_punto > 0 && (
        <div className="card" style={{ marginBottom: 16, borderColor: '#F59E0B', background: '#FFFBEB', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260, fontSize: 14, color: '#92400E' }}>
            <strong>⚠ {resumen.sin_punto} orden(es) por revisar.</strong> Su punto de entrega no está asociado a una sucursal de Siesa,
            así que no se puede crear el pedido. Asigna la sucursal (o descarta la orden si no aplica).
          </div>
          <button className="btn btn-primary" onClick={() => { setEstado('sin_punto'); setVista('punto') }}>Ver órdenes por revisar</button>
        </div>
      )}

      {resumen && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
          {([
            ['pendiente', 'Pendientes de pedido', resumen.pendientes],
            ['sin_punto', 'Por revisar', resumen.sin_punto],
            ['enviado', 'Pedidos en Siesa', resumen.enviadas],
            ['error', 'Rechazadas por Siesa', resumen.con_error],
          ] as [EstadoOrdenCen, string, number][]).map(([k, label, n]) => (
            <button key={k} onClick={() => setEstado(estado === k ? '' : k)} className="card"
              style={{ textAlign: 'left', cursor: 'pointer', borderColor: estado === k ? ESTADOS[k].color : undefined }}>
              <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 700 }}>{label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: ESTADOS[k].color }}>{n}</div>
            </button>
          ))}
        </div>
      )}

      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <select value={estado} onChange={e => setEstado(e.target.value as EstadoOrdenCen | '')} style={sel}>
          <option value="">Todos los estados</option>
          {(Object.keys(ESTADOS) as EstadoOrdenCen[]).map(k => <option key={k} value={k}>{ESTADOS[k].label}</option>)}
        </select>
        <select value={comprador} onChange={e => setComprador(e.target.value)} style={sel}>
          <option value="">Todas las cadenas</option>
          {Object.entries(COMPRADORES).map(([ean, n]) => <option key={ean} value={ean}>{n}</option>)}
        </select>
        <select value={fuente} onChange={e => setFuente(e.target.value)} style={sel}>
          <option value="">Todas las fuentes</option>
          <option value="carvajal">Carvajal (CEN)</option>
          <option value="subrik">Subrik</option>
          <option value="institucional">Institucional (Siesa)</option>
        </select>
        <label style={{ fontSize: 12, color: 'var(--text2)' }}>Entrega desde <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={sel} /></label>
        <label style={{ fontSize: 12, color: 'var(--text2)' }}>hasta <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={sel} /></label>
        <select value={fechaOc} onChange={e => setFechaOc(e.target.value)} style={sel} title="Fecha de la OC (la fecha del documento en el portal CEN)">
          <option value="">OC de cualquier fecha</option>
          {Object.entries(FECHAS_OC).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
        </select>
        <select value={orden} onChange={e => setOrden(e.target.value as 'entrega' | 'oc')} style={sel}>
          <option value="entrega">Ordenar por entrega</option>
          <option value="oc">OC más recientes primero</option>
        </select>
        <select value={ruta} onChange={e => setRuta(e.target.value)} style={sel}>
          <option value="">Todas las rutas</option>
          <option value="-">Sin ruta</option>
          {rutas.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <input placeholder="Buscar OC, punto, NIT o EAN" value={buscar} onChange={e => setBuscar(e.target.value)} style={{ ...sel, flex: 1, minWidth: 200 }} />
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
          {(['ruta', 'punto'] as const).map(v => (
            <button key={v} onClick={() => setVista(v)} style={{ padding: '8px 12px', fontSize: 13, border: 'none', cursor: 'pointer', fontWeight: 600,
              background: vista === v ? 'var(--accent)' : '#fff', color: vista === v ? '#fff' : 'var(--text)' }}>
              {v === 'punto' ? 'Por punto de venta' : 'Por ruta'}
            </button>
          ))}
        </div>
        {hayFiltros && <button className="btn" onClick={limpiarFiltros} title="Quitar todos los filtros y volver al orden por entrega">✕ Limpiar filtros</button>}
        {grupos.length > 0 && (
          <button className="btn" onClick={() => {
            if (abiertos.size > 0) { setAbiertos(new Set()); setRelAlternadas(new Set()); return }
            setAbiertos(new Set(grupos.map(g => g.clave)))
            // Abre también las relaciones de las rutas que tienen varias
            setRelAlternadas(new Set(grupos.flatMap(g => {
              const rels = vista === 'ruta' && g.ruta ? porRelacion(g.ordenes) : []
              return rels.length > 1 ? rels.map(r => `${g.clave}|${r.rel}`) : []
            })))
          }}>
            {abiertos.size > 0 ? 'Recoger todas' : 'Expandir todas'}
          </button>
        )}
      </div>

      {envio?.enCurso && (
        <div className="card" style={{ marginBottom: 12, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <strong>Enviando a Siesa: {envio.resultados.length} de {envio.total}</strong>
          </div>
          {envio.resultados.map(r => (
            <div key={r.id} style={{ color: r.ok ? '#047857' : 'var(--danger)', marginBottom: 2 }}>
              {r.ok ? '✓' : '✗'} OC {r.oc}: {r.mensaje}
            </div>
          ))}
          {envio.resultados.length === envio.total && <div style={{ marginTop: 8, color: 'var(--text2)' }}>📧 Enviando el correo a facturación...</div>}
        </div>
      )}
      {envio && !envio.enCurso && (
        <ResultadoEnvioModal
          titulo={envio.total ? `Envío a Siesa terminado: ${envio.resultados.filter(r => r.ok).length} de ${envio.total} pedido(s) creado(s)` : 'Aviso a facturación de pedidos institucionales'}
          filas={envio.resultados} aviso={envio.aviso} onClose={() => setEnvio(null)} />
      )}
      {avisoRuta && (
        <ResultadoEnvioModal titulo={`Aviso a facturación · Ruta ${avisoRuta.ruta}`} filas={[]} aviso={avisoRuta.aviso} onClose={() => setAvisoRuta(null)} />
      )}

      {cargando && <div style={{ textAlign: 'center', padding: 30, color: 'var(--text2)' }}>Cargando órdenes...</div>}
      {!cargando && grupos.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text2)' }}>
          No hay órdenes con estos filtros. Usa <strong>Traer órdenes</strong> para leer las nuevas de los SFTP.
        </div>
      )}

      <div className="cen-lista">
      {!cargando && grupos.map(g => {
        const t = resumir(g.ordenes)
        const recogido = !abiertos.has(g.clave)
        const porRevisar = g.ordenes.filter(o => o.motivos.length > 0).length
        const idsEnviables = g.ordenes.filter(seleccionable).map(o => o.id)
        // En la vista por ruta, cada ruta se subagrupa por relación (RUTA-MMSS) con sus propios totales
        const rels = vista === 'ruta' && g.ruta ? porRelacion(g.ordenes) : null
        const secciones = rels?.map(r => ({ titulo: r.rel, ids: r.ordenes.map(o => o.id) }))
        const tituloTotales = vista === 'ruta' && g.ruta ? `${g.titulo} · ${g.subtitulo}` : g.titulo
        const nAviso = vista === 'ruta' && g.ruta ? g.ordenes.filter(o => sinAviso.has(o.id)).length : 0
        return (
          <section key={g.clave} className={`cen-grupo${g.sinPunto ? ' cen-grupo-alerta' : ''}`}>
            <div className="cen-grupo-cab" onClick={() => alternar(g.clave)} title={recogido ? 'Expandir' : 'Recoger'} role="button" aria-expanded={!recogido}>
              <div className="cen-cab-titulo">
                {casillaGrupo(idsEnviables, 'esta sección')}
                <span className="cen-chevron" data-abierto={!recogido}>▼</span>
                <div style={{ minWidth: 0 }}>
                  <div className="cen-grupo-nombre">{g.titulo}</div>
                  <div className="cen-grupo-sub">
                    {rels ? `${rels.length} relación(es): ${rels.map(r => r.rel).join(', ')}` : g.subtitulo}
                    {porRevisar > 0 && <span style={{ color: '#B45309', fontWeight: 700 }}> · ⚠ {porRevisar} por revisar</span>}
                  </div>
                </div>
              </div>
              {cifras(t, (
                <span className="cen-cab-botones" onClick={e => e.stopPropagation()}>
                  <button className="btn" onClick={() => setTotales({ titulo: tituloTotales, ruta: g.ruta, ids: g.ordenes.map(o => o.id), secciones })}>Totales</button>
                  {nAviso > 0 && (
                    <button className="btn" disabled={avisando === g.ruta} title="Enviar el correo a facturación con los pedidos de esta ruta que aún no se han avisado"
                      onClick={() => avisarRuta(g.ruta!, nAviso)}>
                      {avisando === g.ruta ? 'Avisando...' : `📧 Avisar (${nAviso})`}
                    </button>
                  )}
                  {g.sinPunto && vista === 'punto' && <button className="btn btn-primary" onClick={() => setAsignarEan(g.ean)}>Asignar sucursal</button>}
                </span>
              ))}
            </div>
            {!recogido && (rels
              ? rels.map(r => {
                  const clave = `${g.clave}|${r.rel}`
                  // Con una sola relación arranca abierta; con varias, recogidas (clic para abrir cada una)
                  const abierta = rels.length === 1 ? !relAlternadas.has(clave) : relAlternadas.has(clave)
                  const tr = resumir(r.ordenes)
                  const despachos = Array.from(new Set(r.ordenes.map(o => o.fecha_despacho).filter((d): d is string => Boolean(d)))).sort()
                  return (
                    <div key={r.rel} className="cen-rel">
                      <div className="cen-rel-cab" onClick={() => alternarRel(clave)} title={abierta ? 'Recoger la relación' : 'Ver las órdenes de la relación'} role="button" aria-expanded={abierta}>
                        <div className="cen-cab-titulo">
                          {casillaGrupo(r.ordenes.filter(seleccionable).map(o => o.id), `la relación ${r.rel}`)}
                          <span className="cen-chevron" data-abierto={abierta}>▼</span>
                          <div style={{ minWidth: 0 }}>
                            <div className="cen-rel-nombre">Relación {r.rel}</div>
                            {despachos.length > 0 && (
                              <div className="cen-grupo-sub">
                                Despacho {fmtFecha(despachos[0])}{despachos.length > 1 ? ` a ${fmtFecha(despachos[despachos.length - 1])}` : ''}
                              </div>
                            )}
                          </div>
                        </div>
                        {cifras(tr, (
                          <span className="cen-cab-botones" onClick={e => e.stopPropagation()}>
                            <button className="btn btn-sm" onClick={() => setTotales({ titulo: tituloTotales, ruta: g.ruta, ids: g.ordenes.map(o => o.id), secciones, inicial: r.rel })}>Totales</button>
                          </span>
                        ))}
                      </div>
                      {abierta && tablaOrdenes(r.ordenes, false)}
                    </div>
                  )
                })
              : tablaOrdenes(g.ordenes, true))}
          </section>
        )
      })}
      </div>

      {/* Selección: barra fija al pie con los totales por relación, para no tener que subir a verla */}
      {seleccion.size > 0 && !hayVentana && (() => {
        const lista = ordenes.filter(o => seleccion.has(o.id))
        const ts = resumir(lista)
        const rels = porRelacion(lista)
        const relActual = rels.length === 1 && rels[0].rel !== SIN_RELACION ? rels[0].rel : null
        const nPvk = lista.filter(esPvk).length, nSiesa = lista.filter(enviable).length
        return (
          <div className="card" style={{ position: 'fixed', bottom: 12, zIndex: 900, left: barra?.left ?? 16, width: barra?.width ?? 'calc(100% - 32px)',
            maxHeight: '40vh', overflowY: 'auto', borderColor: 'var(--accent)', boxShadow: '0 -4px 18px rgba(15,23,42,.18)', display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 14 }}>{ts.n} orden(es) seleccionada(s)</strong>
              <span style={{ fontSize: 13, color: 'var(--text2)' }} title={ts.pesoCompleto ? undefined : TITULO_PESO}>{fmtNumero(ts.unidades)} und · {kgTexto(ts)} · <strong style={{ color: 'var(--text)' }}>{fmtMoneda(ts.valor)}</strong></span>
              {nPvk > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: '#6D28D9', background: '#F3EEFF', borderRadius: 999, padding: '2px 8px' }}>{nPvk} PVK solo para el correo</span>}
              <label style={{ fontSize: 12, display: 'flex', gap: 5, alignItems: 'center', color: 'var(--text2)' }} title="Agrega al correo a facturación las tablas de totales por ítem y por cliente de cada relación">
                <input type="checkbox" checked={totalesCorreo} onChange={e => cambiarTotalesCorreo(e.target.checked)} /> Totales por ítem y cliente en el correo
              </label>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn" onClick={() => setTotales({ titulo: 'Órdenes seleccionadas', ruta: null, ids: lista.map(o => o.id), secciones: rels.map(r => ({ titulo: r.rel, ids: r.ordenes.map(o => o.id) })) })}>Totales</button>
                <button className="btn" disabled={envio?.enCurso} onClick={() => setMoverRelacion({ ids: lista.map(o => o.id), actual: relActual })}>Cambiar relación</button>
                <button className="btn" onClick={() => setSeleccion(new Set())} disabled={envio?.enCurso}>Quitar selección</button>
                <button className="btn btn-primary" onClick={() => enviarSeleccion()} disabled={envio?.enCurso}>
                  {envio?.enCurso ? `Enviando ${Math.min(envio.resultados.length + 1, envio.total)} de ${envio.total}...`
                    : nSiesa ? `Enviar ${nSiesa} a Siesa${nPvk ? ` + ${nPvk} PVK al correo` : ''}` : `📧 Avisar a facturación (${nPvk})`}
                </button>
              </div>
            </div>
            {/* Subtotal por relación de lo seleccionado */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 12 }}>
              {rels.map(r => {
                const tr = resumir(r.ordenes)
                return (
                  <span key={r.rel} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px' }}>
                    <strong>{r.rel}</strong>: {tr.n} OC · {fmtNumero(tr.unidades)} und · {kgTexto(tr)} · {fmtMoneda(tr.valor)}
                  </span>
                )
              })}
            </div>
          </div>
        )
      })()}

      {institucional && (
        <PedidosInstitucionalesModal onClose={() => setInstitucional(false)}
          onAgregados={n => { setAviso(`${n} pedido(s) institucional(es) agregado(s) a la ruta.`); cargar() }} />
      )}
      {totales && <TotalesRutaModal titulo={totales.titulo} ruta={totales.ruta} ids={totales.ids} secciones={totales.secciones} inicial={totales.inicial} onClose={() => setTotales(null)} />}
      {preguntaUno && (
        <ElegirAvisoModal oc={preguntaUno.numero_orden} cliente={preguntaUno.razon_social} ruta={preguntaUno.ruta}
          onElegir={m => { setPreguntaUno(null); if (m) enviarSeleccion(m) }} />
      )}
      {moverRelacion && (
        <CambiarRelacionModal ids={moverRelacion.ids} actual={moverRelacion.actual} onClose={() => setMoverRelacion(null)}
          onCambiado={m => { setMoverRelacion(null); setSeleccion(new Set()); setAviso(m); cargar() }} />
      )}
      {detalleId !== null && <DetalleOrdenModal id={detalleId} onClose={() => setDetalleId(null)} onCambio={cargar} />}
      {asignarEan && (
        <AsignarPuntoModal
          ean={asignarEan}
          onClose={() => setAsignarEan(null)}
          onGuardado={n => { setAsignarEan(null); setAviso(`Sucursal asignada: ${n} orden(es) quedaron asociadas.`); cargar() }}
        />
      )}
    </div>
  )
}
