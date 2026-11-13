'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { COMPRADORES } from '@/lib/cen/compradores'
import { codigoRelacion } from '@/lib/cen/relacion'
import {
  agruparLineas, agruparOrdenes, cajasLinea, CUMPLIMIENTO, cumplimiento, lineasRelacion, pesoLinea, semanaIso, tiemposPorCadena,
  type Cumplimiento, type LineaReporte, type OrdenReporte,
} from '@/lib/cen/reportes'
import { exportarExcel, type Valor } from '@/lib/exportExcel'
import { excelRelacion } from '@/lib/cen/excelRelacion'
import { ESTADOS, fmtFecha, fmtMoneda, fmtNumero } from '@/components/ordenes-cen/utils'
import { NecesidadSemanal } from '@/components/ordenes-cen/NecesidadSemanal'
import type { EstadoOrdenCen } from '@/types/ordenes-cen'

type Datos = { hoy: string; desde: string; hasta: string; campo: string; limitado: boolean; ordenes: OrdenReporte[]; lineas: LineaReporte[] }
type Sync = {
  hoy: string
  resumen: { ejecuciones: number; fallidas: number; manuales: number; ultima_ok: string | null; ultima_fallida: string | null }
  fallos: { inicio: string; origen: string; usuario: string | null; error: string | null }[]
  porDia: { dia: string; fuente: string; archivos: number; con_error: number; espera_prom_h: number | null; espera_max_h: number | null }[]
  errores: { fuente: string; nombre: string; fecha_archivo: string; procesado_at: string; error: string }[]
}
type Pestana = 'control' | 'relacion' | 'necesidad' | 'cadenas' | 'productos' | 'tiempos' | 'sincronizacion' | 'base'

const PESTANAS: [Pestana, string][] = [
  ['control', 'Control y cumplimiento'], ['relacion', 'Relación de despacho'], ['necesidad', 'Necesidad por producto'], ['cadenas', 'Por cadena'],
  ['productos', 'Productos y puntos'], ['tiempos', 'Tiempos'], ['sincronizacion', 'Sincronización'], ['base', 'Base de datos'],
]
const sel: React.CSSProperties = { padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: '#fff' }
const masDias = (f: string, n: number) => { const d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const kg = (v: number | null, completo = true) => v === null ? '—' : `${fmtNumero(v, 1)} kg${completo ? '' : '*'}`
const fechaHora = (s: string | null) => s ? new Date(s).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

/** Indicador; con onClick funciona como botón de filtro (activo = borde y fondo del color). */
function Kpi({ titulo, valor, detalle, color, onClick, activo }: { titulo: string; valor: string | number; detalle?: string; color?: string; onClick?: () => void; activo?: boolean }) {
  const contenido = (<>
    <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 700 }}>{titulo}</div>
    <div style={{ fontSize: 24, fontWeight: 800, color: color ?? 'var(--text)' }}>{valor}</div>
    {detalle && <div style={{ fontSize: 12, color: 'var(--text2)' }}>{detalle}</div>}
  </>)
  if (!onClick) return <div className="card" style={{ padding: '12px 14px' }}>{contenido}</div>
  return (
    <button type="button" className="card" onClick={onClick} aria-pressed={activo} title={activo ? 'Quitar el filtro' : 'Ver estas órdenes'}
      style={{ padding: '12px 14px', textAlign: 'left', cursor: 'pointer', font: 'inherit', width: '100%',
        borderColor: activo ? color ?? 'var(--accent)' : undefined, boxShadow: activo ? `0 0 0 2px ${color ?? 'var(--accent)'}` : undefined }}>
      {contenido}
    </button>
  )
}

// Filtros de los indicadores de "Control y cumplimiento"
type FiltroControl = 'todas' | 'cumplidas' | 'vencida' | 'por_vencer' | 'a_tiempo' | 'descartada'
const FILTROS: Record<FiltroControl, { titulo: string; incluye: Cumplimiento[] | null }> = {
  todas: { titulo: 'Órdenes del periodo', incluye: null },
  cumplidas: { titulo: 'Cumplidas (pedido creado en Siesa)', incluye: ['cumplida_a_tiempo', 'cumplida_tarde'] },
  vencida: { titulo: 'Vencidas sin pedido', incluye: ['vencida'] },
  por_vencer: { titulo: 'Por vencer', incluye: ['por_vencer'] },
  a_tiempo: { titulo: 'Abiertas a tiempo', incluye: ['a_tiempo'] },
  descartada: { titulo: 'Descartadas', incluye: ['descartada'] },
}
function Etiqueta({ c }: { c: Cumplimiento }) {
  return <span style={{ background: CUMPLIMIENTO[c].bg, color: CUMPLIMIENTO[c].color, padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{CUMPLIMIENTO[c].label}</span>
}
function Seccion({ titulo, nota, accion, children }: { titulo: string; nota?: string; accion?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div><h2 style={{ fontSize: 16, fontWeight: 800 }}>{titulo}</h2>{nota && <div style={{ fontSize: 12, color: 'var(--text2)', maxWidth: 820 }}>{nota}</div>}</div>
        {accion}
      </div>
      {children}
    </div>
  )
}
/** Barra horizontal proporcional (para tendencias sin librería de gráficos). */
function Barra({ valor, max, color = 'var(--accent)' }: { valor: number; max: number; color?: string }) {
  return <div style={{ background: '#EEF2F7', borderRadius: 4, height: 10, minWidth: 80 }}><div style={{ width: `${max ? Math.max(2, (valor / max) * 100) : 0}%`, background: color, height: 10, borderRadius: 4 }} /></div>
}

export default function ReportesCenPage() {
  const { data: session } = useSession()
  const usuario = session?.user?.name ?? undefined
  const hoyLocal = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const [desde, setDesde] = useState(masDias(hoyLocal, -30))
  const [hasta, setHasta] = useState(masDias(hoyLocal, 15))
  const [campo, setCampo] = useState<'entrega' | 'orden'>('entrega')
  const [cadena, setCadena] = useState('')
  const [ruta, setRuta] = useState('')
  const [rutas, setRutas] = useState<string[]>([])
  const [pestana, setPestana] = useState<Pestana>('control')
  const [datos, setDatos] = useState<Datos | null>(null)
  const [sync, setSync] = useState<Sync | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  // Relación de despacho
  const [relaciones, setRelaciones] = useState<Set<string>>(new Set())
  // Control: indicador seleccionado como filtro
  const [filtro, setFiltro] = useState<FiltroControl | null>(null)
  const alternarFiltro = (f: FiltroControl) => setFiltro(prev => prev === f ? null : f)

  const cargar = useCallback(async () => {
    setCargando(true); setError('')
    const qs = new URLSearchParams({ desde, hasta, campo, cadena, ruta })
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/logistica/ordenes-cen/reportes?${qs}`),
        fetch(`/api/logistica/ordenes-cen/reportes?tipo=sincronizacion&desde=${desde > masDias(hoyLocal, 0) ? masDias(hoyLocal, -30) : desde}&hasta=${hasta < hoyLocal ? hasta : hoyLocal}`),
      ])
      const d1 = await r1.json(); if (!r1.ok) throw new Error(d1.error ?? 'No se pudieron cargar los reportes')
      setDatos(d1); setSync(r2.ok ? await r2.json() : null); setRelaciones(new Set())
    } catch (e) { setError(e instanceof Error ? e.message : 'Error') } finally { setCargando(false) }
  }, [desde, hasta, campo, cadena, ruta, hoyLocal])

  useEffect(() => { cargar() }, []) // eslint-disable-line react-hooks/exhaustive-deps -- primera carga; luego con "Consultar"
  useEffect(() => {
    fetch('/api/logistica/ordenes-cen/reglas').then(r => r.ok ? r.json() : []).then((rs: { ruta: string }[]) => setRutas(Array.from(new Set(rs.map(r => r.ruta))).sort())).catch(() => {})
  }, [])

  const hoy = datos?.hoy ?? hoyLocal
  const ordenes = useMemo(() => datos?.ordenes ?? [], [datos])
  const lineas = useMemo(() => datos?.lineas ?? [], [datos])
  const periodo = `${campo === 'entrega' ? 'Entrega' : 'Fecha OC'} del ${fmtFecha(desde)} al ${fmtFecha(hasta)}${cadena ? ` · ${COMPRADORES[cadena]}` : ''}${ruta ? ` · Ruta ${ruta === '-' ? 'sin ruta' : ruta}` : ''}`

  // ── Cálculos ───────────────────────────────────────────────────────────
  const conCumplimiento = useMemo(() => ordenes.map(o => ({ ...o, cumple: cumplimiento(o, hoy) })), [ordenes, hoy])
  const activas = useMemo(() => conCumplimiento.filter(o => o.estado !== 'descartada'), [conCumplimiento])
  const totalActivas = useMemo(() => agruparOrdenes(activas, () => 'todas').get('todas'), [activas])
  const porCumple = useMemo(() => { const m: Record<string, number> = {}; for (const o of conCumplimiento) m[o.cumple] = (m[o.cumple] ?? 0) + 1; return m }, [conCumplimiento])
  const porEstado = useMemo(() => { const m: Record<string, number> = {}; for (const o of conCumplimiento) m[o.estado] = (m[o.estado] ?? 0) + 1; return m }, [conCumplimiento])
  const atencion = useMemo(() => conCumplimiento.filter(o => o.cumple === 'vencida' || o.cumple === 'por_vencer' || o.estado === 'error' || o.estado === 'sin_punto')
    .sort((a, b) => String(a.fecha_entrega).localeCompare(String(b.fecha_entrega))), [conCumplimiento])
  const filtradas = useMemo(() => {
    if (!filtro) return []
    const incluye = FILTROS[filtro].incluye
    return conCumplimiento.filter(o => !incluye || incluye.includes(o.cumple))
      .sort((a, b) => String(a.fecha_entrega).localeCompare(String(b.fecha_entrega)))
  }, [conCumplimiento, filtro])
  const descartadas = useMemo(() => conCumplimiento.filter(o => o.estado === 'descartada'), [conCumplimiento])
  const enviadas = useMemo(() => conCumplimiento.filter(o => o.estado === 'enviado'), [conCumplimiento])

  const relacion = useMemo(() => lineasRelacion(ordenes, lineas, codigoRelacion), [ordenes, lineas])
  const listaRelaciones = useMemo(() => {
    const m = new Map<string, { ocs: Set<string>; valor: number; peso: number; completo: boolean; puntos: Set<string> }>()
    for (const f of relacion) {
      const x = m.get(f.relacion) ?? { ocs: new Set(), valor: 0, peso: 0, completo: true, puntos: new Set() }
      x.ocs.add(f.numero_orden); x.puntos.add(f.ean_entrega); x.valor += f.valor; if (f.peso === null) x.completo = false; else x.peso += f.peso
      m.set(f.relacion, x)
    }
    return Array.from(m, ([rel, x]) => ({ rel, ocs: x.ocs.size, puntos: x.puntos.size, valor: x.valor, peso: x.peso, completo: x.completo })).sort((a, b) => a.rel.localeCompare(b.rel))
  }, [relacion])
  const relacionSel = useMemo(() => relacion.filter(f => relaciones.has(f.relacion)), [relacion, relaciones])

  const porCadena = useMemo(() => Array.from(agruparOrdenes(activas, o => o.cadena)).sort((a, b) => b[1].valor - a[1].valor), [activas])
  const semanas = useMemo(() => {
    const m = new Map<string, Map<string, number>>()
    for (const o of activas) { if (!o.fecha_entrega) continue; const s = semanaIso(o.fecha_entrega); const x = m.get(s) ?? new Map(); x.set(o.cadena, (x.get(o.cadena) ?? 0) + o.valor_total); m.set(s, x) }
    return Array.from(m).sort((a, b) => a[0].localeCompare(b[0]))
  }, [activas])
  const lineasActivas = useMemo(() => { const ids = new Set(activas.map(o => o.id)); return lineas.filter(l => ids.has(l.orden_id)) }, [lineas, activas])
  const topProductos = useMemo(() => {
    const desc = new Map(lineasActivas.map(l => [l.ean_item, l])); const cad = new Map<string, Set<string>>()
    const ordenCadena = new Map(activas.map(o => [o.id, o.cadena]))
    for (const l of lineasActivas) cad.set(l.ean_item, (cad.get(l.ean_item) ?? new Set()).add(ordenCadena.get(l.orden_id) ?? ''))
    return Array.from(agruparLineas(lineasActivas, l => l.ean_item), ([ean, t]) => ({ ean, f120: desc.get(ean)?.f120_id ?? null, descripcion: desc.get(ean)?.descripcion ?? ean, cadenas: cad.get(ean)?.size ?? 0, ...t }))
      .sort((a, b) => b.valor - a.valor)
  }, [lineasActivas, activas])
  const topPuntos = useMemo(() => {
    const info = new Map(activas.map(o => [o.ean_entrega, o]))
    return Array.from(agruparOrdenes(activas, o => o.ean_entrega), ([ean, t]) => ({ ean, o: info.get(ean)!, ...t })).sort((a, b) => b.valor - a.valor)
  }, [activas])
  const tiempos = useMemo(() => tiemposPorCadena(ordenes.filter(o => o.estado !== 'descartada'), hoy), [ordenes, hoy])

  // ── Exportaciones ──────────────────────────────────────────────────────
  const ocFila = (o: OrdenReporte & { cumple: Cumplimiento }): Valor[] => [o.cadena, o.numero_orden, o.fecha_orden, o.fecha_entrega, o.razon_social ?? `EAN ${o.ean_entrega}`, o.ciudad,
    o.ruta, ESTADOS[o.estado as EstadoOrdenCen]?.label ?? o.estado, CUMPLIMIENTO[o.cumple].label, o.total_unidades, o.valor_total, o.peso_kg, o.siesa_consecutivo, o.enviado_at, o.enviado_por,
    o.descartada_at, o.descartada_por, o.motivo_descarte]
  const ocCols = ['Cadena', 'OC', 'Fecha OC', 'Entrega', 'Punto de venta', 'Ciudad', 'Ruta', 'Estado', 'Cumplimiento', 'Cant. unidades', 'Valor', 'Peso kg', 'Pedido Siesa',
    'Enviado', 'Enviado por', 'Descartada', 'Descartada por', 'Motivo descarte']
  function exportarBase() {
    const porId = new Map(conCumplimiento.map(o => [o.id, o]))
    const filas: Valor[][] = lineas.map(l => {
      const o = porId.get(l.orden_id)!
      return [o.fecha_orden, o.cadena, o.ean_comprador, o.numero_orden, o.fecha_entrega, o.fecha_entrega_max, l.ean_item, l.f120_id, l.descripcion, l.cod_comprador,
        l.cantidad, l.unidad, l.precio, l.cantidad * l.precio, pesoLinea(l), cajasLinea(l), o.ean_entrega, o.razon_social, o.nit, o.sucursal, o.ciudad, o.ruta,
        codigoRelacion(o.ruta, o.fecha_despacho), o.fecha_despacho, o.fuente, ESTADOS[o.estado as EstadoOrdenCen]?.label ?? o.estado, CUMPLIMIENTO[o.cumple].label, o.siesa_consecutivo, semanaIso(o.fecha_entrega ?? o.fecha_orden ?? hoy)]
    })
    exportarExcel(`Base_ordenes_EDI_${desde}_a_${hasta}`, ['F. OC', 'Cliente', 'EAN cliente', 'OC', 'F. mín. entrega', 'F. máx. entrega', 'EAN ítem', 'Ítem Siesa', 'Descripción', 'Cód. comprador',
      'Cantidad', 'Unidad', 'Precio', 'Valor total', 'Peso kg', 'Cajas', 'EAN punto', 'Punto de venta', 'NIT', 'Sucursal', 'Ciudad', 'Ruta', 'Relación', 'F. despacho', 'Fuente', 'Estado', 'Cumplimiento',
      'Pedido Siesa', 'Semana'], filas, usuario, 'KLARENS  —  Base de órdenes EDI')
  }

  return (
    <div className="cen-page">
      <Link href="/logistica/ordenes-cen" style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>&larr; Órdenes EDI</Link>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: '8px 0 4px' }}>Reportes de órdenes EDI</h1>
      <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 12 }}>Control de cumplimiento, relaciones de despacho, necesidad de producto y análisis por cadena. Todos los reportes se descargan en Excel.</p>

      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <select value={campo} onChange={e => setCampo(e.target.value as 'entrega' | 'orden')} style={sel}>
          <option value="entrega">Por fecha de entrega</option>
          <option value="orden">Por fecha de la OC</option>
        </select>
        <label style={{ fontSize: 12, color: 'var(--text2)' }}>desde <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={sel} /></label>
        <label style={{ fontSize: 12, color: 'var(--text2)' }}>hasta <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={sel} /></label>
        <select value={cadena} onChange={e => setCadena(e.target.value)} style={sel}>
          <option value="">Todas las cadenas</option>
          {Object.entries(COMPRADORES).map(([ean, n]) => <option key={ean} value={ean}>{n}</option>)}
        </select>
        <select value={ruta} onChange={e => setRuta(e.target.value)} style={sel}>
          <option value="">Todas las rutas</option><option value="-">Sin ruta</option>
          {rutas.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button className="btn btn-primary" onClick={cargar} disabled={cargando}>{cargando ? 'Consultando...' : 'Consultar'}</button>
        {datos && <span style={{ fontSize: 12, color: 'var(--text2)', marginLeft: 'auto' }}>{fmtNumero(ordenes.length)} órdenes · {fmtNumero(lineas.length)} líneas</span>}
      </div>
      {error && <div className="card" style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
      {datos?.limitado && <div className="card" style={{ color: '#B45309', marginBottom: 12 }}>El periodo tiene más de 20.000 órdenes: se muestran las primeras. Acorta el rango de fechas.</div>}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {PESTANAS.map(([k, t]) => (
          <button key={k} onClick={() => setPestana(k)} className="btn" style={pestana === k ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : undefined}>{t}</button>
        ))}
      </div>

      {!datos && cargando && <div className="card" style={{ textAlign: 'center', padding: 30, color: 'var(--text2)' }}>Cargando reportes...</div>}

      {datos && pestana === 'control' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 16 }}>
            <Kpi titulo="Órdenes del periodo" valor={fmtNumero(ordenes.length)} detalle={`${fmtMoneda(totalActivas?.valor ?? 0)} · ${kg(totalActivas?.peso ?? 0, totalActivas?.pesoCompleto)}`}
              onClick={() => alternarFiltro('todas')} activo={filtro === 'todas'} />
            <Kpi titulo="Cumplidas a tiempo" valor={porCumple.cumplida_a_tiempo ?? 0} color={CUMPLIMIENTO.cumplida_a_tiempo.color} detalle={`Tarde: ${porCumple.cumplida_tarde ?? 0}`}
              onClick={() => alternarFiltro('cumplidas')} activo={filtro === 'cumplidas'} />
            <Kpi titulo="Vencidas sin pedido" valor={porCumple.vencida ?? 0} color={CUMPLIMIENTO.vencida.color} detalle="La fecha de entrega ya pasó"
              onClick={() => alternarFiltro('vencida')} activo={filtro === 'vencida'} />
            <Kpi titulo="Por vencer" valor={porCumple.por_vencer ?? 0} color={CUMPLIMIENTO.por_vencer.color} detalle="Se entregan hoy o mañana"
              onClick={() => alternarFiltro('por_vencer')} activo={filtro === 'por_vencer'} />
            <Kpi titulo="Abiertas a tiempo" valor={porCumple.a_tiempo ?? 0} color={CUMPLIMIENTO.a_tiempo.color}
              onClick={() => alternarFiltro('a_tiempo')} activo={filtro === 'a_tiempo'} />
            <Kpi titulo="Descartadas" valor={porCumple.descartada ?? 0} color={CUMPLIMIENTO.descartada.color}
              onClick={() => alternarFiltro('descartada')} activo={filtro === 'descartada'} />
          </div>
          {filtro && (
            <Seccion titulo={`${FILTROS[filtro].titulo} (${fmtNumero(filtradas.length)})`} nota={`${periodo} · Haz clic otra vez en el indicador para quitar el filtro.`}
              accion={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn" disabled={!filtradas.length} onClick={() => exportarExcel(`${FILTROS[filtro].titulo.split(' (')[0].replace(/\s+/g, '_')}_${desde}_a_${hasta}`, ocCols, filtradas.map(ocFila), usuario, `KLARENS  —  ${FILTROS[filtro].titulo}`)}>Descargar Excel</button>
                <button className="btn" onClick={() => setFiltro(null)}>Quitar filtro</button>
              </div>}>
              <TablaOrdenes filas={filtradas} vacio="No hay órdenes en este grupo para el periodo." />
            </Seccion>
          )}
          <Seccion titulo="Estado de las órdenes" nota="Estado actual en la aplicación."
            accion={<button className="btn" onClick={() => exportarExcel(`Control_ordenes_EDI_${desde}_a_${hasta}`, ocCols, conCumplimiento.map(ocFila), usuario, 'KLARENS  —  Control de órdenes EDI')}>Descargar Excel (todas)</button>}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {(Object.keys(ESTADOS) as EstadoOrdenCen[]).map(k => (
                <div key={k} style={{ background: ESTADOS[k].bg, color: ESTADOS[k].color, borderRadius: 8, padding: '8px 14px', fontWeight: 700 }}>{ESTADOS[k].label}: {porEstado[k] ?? 0}</div>
              ))}
            </div>
          </Seccion>
          <Seccion titulo={`Requieren atención (${atencion.length})`} nota="Vencidas o por vencer sin pedido en Siesa, rechazadas por Siesa y órdenes sin sucursal asociada.">
            <TablaOrdenes filas={atencion} />
          </Seccion>
          <Seccion titulo={`Pedidos creados en Siesa (${enviadas.length})`} nota="Cumplida a tiempo = el pedido se creó a más tardar el día de entrega.">
            {enviadas.length ? (
              <div className="cen-scroll"><table className="inv-table cen-tabla cen-tarjetas">
                <thead><tr><th>OC</th><th>Cadena</th><th>Punto</th><th>Entrega</th><th>Pedido</th><th>Creado</th><th>Por</th><th>Cumplimiento</th></tr></thead>
                <tbody>{enviadas.map(o => (
                  <tr key={o.id}><td data-label="OC" className="nw"><strong>{o.numero_orden}</strong></td><td data-label="Cadena">{o.cadena}</td><td data-label="Punto">{o.razon_social}</td>
                    <td data-label="Entrega" className="nw">{fmtFecha(o.fecha_entrega)}</td><td data-label="Pedido" className="nw">{o.siesa_consecutivo}</td>
                    <td data-label="Creado" className="nw">{fechaHora(o.enviado_at)}</td><td data-label="Por">{o.enviado_por ?? '—'}</td><td data-label="Cumplimiento"><Etiqueta c={o.cumple} /></td></tr>
                ))}</tbody>
              </table></div>
            ) : <div style={{ color: 'var(--text2)', fontSize: 13 }}>No hay pedidos creados en este periodo.</div>}
          </Seccion>
          <Seccion titulo={`Órdenes descartadas (${descartadas.length})`} nota="Quién las descartó, cuándo y por qué. Las descartadas antes de registrar el motivo no lo tienen.">
            {descartadas.length ? (
              <div className="cen-scroll"><table className="inv-table cen-tabla cen-tarjetas">
                <thead><tr><th>OC</th><th>Cadena</th><th>Punto</th><th>Entrega</th><th style={{ textAlign: 'right' }}>Valor</th><th>Descartada</th><th>Por</th><th>Motivo</th></tr></thead>
                <tbody>{descartadas.map(o => (
                  <tr key={o.id}><td data-label="OC" className="nw"><strong>{o.numero_orden}</strong></td><td data-label="Cadena">{o.cadena}</td><td data-label="Punto">{o.razon_social ?? `EAN ${o.ean_entrega}`}</td>
                    <td data-label="Entrega" className="nw">{fmtFecha(o.fecha_entrega)}</td><td data-label="Valor" className="num">{fmtMoneda(o.valor_total)}</td>
                    <td data-label="Descartada" className="nw">{fechaHora(o.descartada_at)}</td><td data-label="Por">{o.descartada_por ?? '—'}</td><td data-label="Motivo">{o.motivo_descarte ?? '—'}</td></tr>
                ))}</tbody>
              </table></div>
            ) : <div style={{ color: 'var(--text2)', fontSize: 13 }}>No hay órdenes descartadas en este periodo.</div>}
          </Seccion>
        </>
      )}

      {datos && pestana === 'relacion' && (
        <Seccion titulo="Relación de despacho" nota="Como las hojas por ruta del libro de logística (RUTA-MMSS = ruta + mes + semana de DESPACHO; despacho = entrega − días de tránsito de la ruta). Marca una o varias relaciones para ver el detalle y descargar el Excel con totales por ítem, por cliente y la planilla de control de entrega."
          accion={<button className="btn btn-primary" disabled={!relacionSel.length} onClick={() => excelRelacion(Array.from(relaciones).sort(), relacionSel, periodo, usuario)}>Descargar Excel ({relaciones.size})</button>}>
          <div className="cen-scroll" style={{ marginBottom: 12 }}><table className="inv-table cen-tabla cen-tarjetas">
            <thead><tr><th style={{ width: 32 }}><input type="checkbox" checked={listaRelaciones.length > 0 && relaciones.size === listaRelaciones.length} onChange={e => setRelaciones(e.target.checked ? new Set(listaRelaciones.map(r => r.rel)) : new Set())} /></th>
              <th>Relación</th><th style={{ textAlign: 'right' }}>OC</th><th style={{ textAlign: 'right' }}>Puntos</th><th style={{ textAlign: 'right' }}>Valor</th><th style={{ textAlign: 'right' }}>Peso</th></tr></thead>
            <tbody>{listaRelaciones.map(r => (
              <tr key={r.rel} style={{ background: relaciones.has(r.rel) ? '#EFF6FF' : undefined }}>
                <td className="sel" data-label=""><input type="checkbox" checked={relaciones.has(r.rel)} onChange={e => setRelaciones(prev => { const n = new Set(prev); if (e.target.checked) n.add(r.rel); else n.delete(r.rel); return n })} /></td>
                <td data-label="Relación"><strong>{r.rel}</strong></td><td data-label="OC" className="num">{r.ocs}</td><td data-label="Puntos" className="num">{r.puntos}</td>
                <td data-label="Valor" className="num">{fmtMoneda(r.valor)}</td><td data-label="Peso" className="num">{kg(r.peso, r.completo)}</td></tr>
            ))}</tbody>
          </table></div>
          {relacionSel.length > 0 && (
            <div className="cen-scroll"><table className="inv-table cen-tabla cen-tarjetas">
              <thead><tr><th>Relación</th><th>OC</th><th>Cliente</th><th>Despacho</th><th>Entrega</th><th>Ciudad</th><th>Punto de venta</th><th>Ítem</th><th>Descripción</th><th style={{ textAlign: 'right' }}>Cant.</th><th style={{ textAlign: 'right' }}>Valor</th><th style={{ textAlign: 'right' }}>Peso</th><th style={{ textAlign: 'right' }}>Cajas</th><th>Pedido</th></tr></thead>
              <tbody>{relacionSel.map((f, i) => (
                <tr key={i}><td data-label="Relación" className="nw">{f.relacion}</td><td data-label="OC" className="nw"><strong>{f.numero_orden}</strong></td><td data-label="Cliente">{f.cadena}</td>
                  <td data-label="Despacho" className="nw">{fmtFecha(f.fecha_despacho)}</td><td data-label="Entrega" className="nw">{fmtFecha(f.fecha_entrega)}</td><td data-label="Ciudad">{f.ciudad}</td><td data-label="Punto" className="ancho">{f.razon_social}</td>
                  <td data-label="Ítem">{f.f120_id ?? '—'}</td><td data-label="Descripción" className="ancho">{f.descripcion}</td><td data-label="Cant." className="num">{fmtNumero(f.cantidad)}</td>
                  <td data-label="Valor" className="num">{fmtMoneda(f.valor)}</td><td data-label="Peso" className="num">{kg(f.peso)}</td><td data-label="Cajas" className="num">{f.cajas ?? '—'}</td><td data-label="Pedido">{f.pedido || '—'}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </Seccion>
      )}

      {/* Necesidad: semana de sábado a viernes con su propia consulta (respeta cadena y ruta) */}
      {pestana === 'necesidad' && <NecesidadSemanal cadena={cadena} ruta={ruta} hoy={hoyLocal} usuario={usuario} />}

      {datos && pestana === 'cadenas' && (() => {
        const maxValor = Math.max(1, ...porCadena.map(([, t]) => t.valor))
        const total = porCadena.reduce((s, [, t]) => s + t.valor, 0)
        const cadenasSem = Array.from(new Set(semanas.flatMap(([, m]) => Array.from(m.keys())))).sort()
        const maxSem = Math.max(1, ...semanas.map(([, m]) => Array.from(m.values()).reduce((s, v) => s + v, 0)))
        return (<>
          <Seccion titulo="Resumen por cadena" nota="Sin descartadas. Ticket promedio = valor ÷ número de OC."
            accion={<button className="btn" onClick={() => exportarExcel(`Por_cadena_${desde}_a_${hasta}`, ['Cadena', 'OC', 'Puntos', 'Cant. unidades', 'Valor', 'Peso kg', 'Ticket promedio', '% del valor'],
              porCadena.map(([c, t]) => [c, t.ordenes, t.puntos, t.unidades, t.valor, t.peso, t.valor / t.ordenes, total ? Math.round((t.valor / total) * 1000) / 10 : 0]), usuario, 'KLARENS  —  Órdenes EDI por cadena')}>Descargar Excel</button>}>
            <div className="cen-scroll"><table className="inv-table cen-tabla cen-tarjetas">
              <thead><tr><th>Cadena</th><th style={{ textAlign: 'right' }}>OC</th><th style={{ textAlign: 'right' }}>Puntos</th><th style={{ textAlign: 'right' }}>Unidades</th><th style={{ textAlign: 'right' }}>Valor</th><th style={{ textAlign: 'right' }}>Peso</th><th style={{ textAlign: 'right' }}>Ticket prom.</th><th>% del valor</th></tr></thead>
              <tbody>{porCadena.map(([c, t]) => (
                <tr key={c}><td data-label="Cadena"><strong>{c}</strong></td><td data-label="OC" className="num">{t.ordenes}</td><td data-label="Puntos" className="num">{t.puntos}</td>
                  <td data-label="Unidades" className="num">{fmtNumero(t.unidades)}</td><td data-label="Valor" className="num">{fmtMoneda(t.valor)}</td><td data-label="Peso" className="num">{kg(t.peso, t.pesoCompleto)}</td>
                  <td data-label="Ticket" className="num">{fmtMoneda(t.valor / t.ordenes)}</td>
                  <td data-label="%"><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Barra valor={t.valor} max={maxValor} /><span className="nw" style={{ fontSize: 12 }}>{total ? fmtNumero((t.valor / total) * 100, 1) : 0}%</span></div></td></tr>
              ))}</tbody>
            </table></div>
          </Seccion>
          <Seccion titulo="Tendencia semanal (valor por semana de entrega)" nota="Semana ISO de la fecha de entrega."
            accion={<button className="btn" onClick={() => exportarExcel(`Tendencia_semanal_${desde}_a_${hasta}`, ['Semana', ...cadenasSem.map(c => `Valor ${c}`), 'Valor total'],
              semanas.map(([s, m]) => [s, ...cadenasSem.map(c => m.get(c) ?? 0), Array.from(m.values()).reduce((a, b) => a + b, 0)]), usuario, 'KLARENS  —  Tendencia semanal de órdenes EDI')}>Descargar Excel</button>}>
            <div className="cen-scroll"><table className="inv-table cen-tabla">
              <thead><tr><th>Semana</th>{cadenasSem.map(c => <th key={c} style={{ textAlign: 'right' }}>{c}</th>)}<th style={{ textAlign: 'right' }}>Total</th><th style={{ width: 160 }}></th></tr></thead>
              <tbody>{semanas.map(([s, m]) => { const t = Array.from(m.values()).reduce((a, b) => a + b, 0); return (
                <tr key={s}><td className="nw"><strong>{s}</strong></td>{cadenasSem.map(c => <td key={c} className="num">{m.get(c) ? fmtMoneda(m.get(c)!) : ''}</td>)}<td className="num"><strong>{fmtMoneda(t)}</strong></td><td><Barra valor={t} max={maxSem} /></td></tr>
              ) })}</tbody>
            </table></div>
          </Seccion>
        </>)
      })()}

      {datos && pestana === 'productos' && (<>
        <Seccion titulo="Productos más pedidos" nota="Sin descartadas, ordenados por valor."
          accion={<button className="btn" onClick={() => exportarExcel(`Productos_${desde}_a_${hasta}`, ['Ítem Siesa', 'EAN', 'Descripción', 'OC', 'Cadenas', 'Cant. unidades', 'Valor', 'Peso kg'],
            topProductos.map(p => [p.f120, p.ean, p.descripcion, p.ordenes, p.cadenas, p.unidades, p.valor, p.pesoCompleto ? p.peso : null]), usuario, 'KLARENS  —  Productos de las órdenes EDI')}>Descargar Excel</button>}>
          <div className="cen-scroll"><table className="inv-table cen-tabla cen-tarjetas">
            <thead><tr><th>#</th><th>Producto</th><th style={{ textAlign: 'right' }}>OC</th><th style={{ textAlign: 'right' }}>Cadenas</th><th style={{ textAlign: 'right' }}>Unidades</th><th style={{ textAlign: 'right' }}>Valor</th><th style={{ textAlign: 'right' }}>Peso</th></tr></thead>
            <tbody>{topProductos.map((p, i) => (
              <tr key={p.ean}><td data-label="#">{i + 1}</td><td data-label="Producto" className="ancho"><div>{p.descripcion}<span className="sub mono">{p.f120 ? `Ítem ${p.f120} · ` : ''}EAN {p.ean}</span></div></td>
                <td data-label="OC" className="num">{p.ordenes}</td><td data-label="Cadenas" className="num">{p.cadenas}</td><td data-label="Unidades" className="num">{fmtNumero(p.unidades)}</td>
                <td data-label="Valor" className="num">{fmtMoneda(p.valor)}</td><td data-label="Peso" className="num">{kg(p.peso, p.pesoCompleto)}</td></tr>
            ))}</tbody>
          </table></div>
        </Seccion>
        <Seccion titulo="Puntos de venta con más pedidos" nota="Sin descartadas, ordenados por valor."
          accion={<button className="btn" onClick={() => exportarExcel(`Puntos_${desde}_a_${hasta}`, ['Cadena', 'EAN punto', 'Punto de venta', 'NIT', 'Sucursal', 'Ciudad', 'Ruta', 'OC', 'Cant. unidades', 'Valor', 'Peso kg'],
            topPuntos.map(p => [p.o.cadena, p.ean, p.o.razon_social, p.o.nit, p.o.sucursal, p.o.ciudad, p.o.ruta, p.ordenes, p.unidades, p.valor, p.pesoCompleto ? p.peso : null]), usuario, 'KLARENS  —  Puntos de venta de las órdenes EDI')}>Descargar Excel</button>}>
          <div className="cen-scroll"><table className="inv-table cen-tabla cen-tarjetas">
            <thead><tr><th>#</th><th>Punto de venta</th><th>Cadena</th><th>Ruta</th><th style={{ textAlign: 'right' }}>OC</th><th style={{ textAlign: 'right' }}>Valor</th><th style={{ textAlign: 'right' }}>Peso</th></tr></thead>
            <tbody>{topPuntos.slice(0, 200).map((p, i) => (
              <tr key={p.ean}><td data-label="#">{i + 1}</td><td data-label="Punto" className="ancho"><div>{p.o.razon_social ?? 'Sin sucursal'}<span className="sub">{p.o.nit ? `${p.o.nit}/${p.o.sucursal} · ` : ''}{p.o.ciudad ?? ''}</span><span className="sub mono">EAN {p.ean}</span></div></td>
                <td data-label="Cadena">{p.o.cadena}</td><td data-label="Ruta">{p.o.ruta ?? '—'}</td><td data-label="OC" className="num">{p.ordenes}</td>
                <td data-label="Valor" className="num">{fmtMoneda(p.valor)}</td><td data-label="Peso" className="num">{kg(p.peso, p.pesoCompleto)}</td></tr>
            ))}</tbody>
          </table></div>
        </Seccion>
      </>)}

      {datos && pestana === 'tiempos' && (
        <Seccion titulo="Tiempos por cadena" nota="Anticipación = días entre la fecha de la OC y la de entrega (cuánto margen da la cadena). Lectura = horas desde que el archivo llegó al SFTP hasta que la app lo leyó (Carvajal los borra a las ~30 h). Pedido = días desde que se leyó la orden hasta que se creó el pedido en Siesa."
          accion={<button className="btn" onClick={() => exportarExcel(`Tiempos_${desde}_a_${hasta}`, ['Cadena', 'OC', 'Anticipación prom. (días)', 'Anticipación mín.', 'Anticipación máx.', 'Lectura prom. (horas)', 'Lectura máx. (horas)', 'Pedido prom. (días)', 'Pedidos creados', 'A tiempo'],
            tiempos.map(t => [t.cadena, t.ordenes, t.anticipacionProm, t.anticipacionMin, t.anticipacionMax, t.lecturaHorasProm, t.lecturaHorasMax, t.envioDiasProm, t.enviadas, t.aTiempo]), usuario, 'KLARENS  —  Tiempos de órdenes EDI')}>Descargar Excel</button>}>
          <div className="cen-scroll"><table className="inv-table cen-tabla cen-tarjetas">
            <thead><tr><th>Cadena</th><th style={{ textAlign: 'right' }}>OC</th><th style={{ textAlign: 'right' }}>Anticipación prom.</th><th style={{ textAlign: 'right' }}>Mín. / máx.</th><th style={{ textAlign: 'right' }}>Lectura prom.</th><th style={{ textAlign: 'right' }}>Lectura máx.</th><th style={{ textAlign: 'right' }}>Pedido prom.</th><th style={{ textAlign: 'right' }}>A tiempo</th></tr></thead>
            <tbody>{tiempos.map(t => (
              <tr key={t.cadena}><td data-label="Cadena"><strong>{t.cadena}</strong></td><td data-label="OC" className="num">{t.ordenes}</td>
                <td data-label="Anticipación" className="num">{t.anticipacionProm === null ? '—' : `${fmtNumero(t.anticipacionProm, 1)} días`}</td>
                <td data-label="Mín. / máx." className="num">{t.anticipacionMin === null ? '—' : `${t.anticipacionMin} / ${t.anticipacionMax}`}</td>
                <td data-label="Lectura prom." className="num">{t.lecturaHorasProm === null ? '—' : `${fmtNumero(t.lecturaHorasProm, 1)} h`}</td>
                <td data-label="Lectura máx." className="num" style={{ color: (t.lecturaHorasMax ?? 0) > 24 ? 'var(--danger)' : undefined }}>{t.lecturaHorasMax === null ? '—' : `${fmtNumero(t.lecturaHorasMax, 1)} h`}</td>
                <td data-label="Pedido prom." className="num">{t.envioDiasProm === null ? '—' : `${fmtNumero(t.envioDiasProm, 1)} días`}</td>
                <td data-label="A tiempo" className="num">{t.enviadas ? `${t.aTiempo} de ${t.enviadas}` : '—'}</td></tr>
            ))}</tbody>
          </table></div>
        </Seccion>
      )}

      {datos && pestana === 'sincronizacion' && (
        !sync ? <div className="card" style={{ color: 'var(--text2)' }}>No se pudo cargar el control de sincronización.</div> : (<>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 16 }}>
            <Kpi titulo="Sincronizaciones" valor={sync.resumen.ejecuciones} detalle={`${sync.resumen.manuales} manuales`} />
            <Kpi titulo="Fallidas" valor={sync.resumen.fallidas} color={sync.resumen.fallidas ? 'var(--danger)' : undefined} />
            <Kpi titulo="Última correcta" valor={sync.resumen.ultima_ok ? fechaHora(sync.resumen.ultima_ok) : '—'} />
            <Kpi titulo="Archivos con error" valor={sync.errores.length} color={sync.errores.length ? 'var(--danger)' : undefined} />
          </div>
          <Seccion titulo="Archivos leídos por día" nota="Espera = horas que el archivo estuvo en el SFTP antes de leerse. Por encima de 24 h hay riesgo de que Carvajal lo borre antes de leerlo."
            accion={<button className="btn" onClick={() => exportarExcel('Sincronizacion_archivos', ['Día', 'Fuente', 'Archivos', 'Con error', 'Espera prom. (h)', 'Espera máx. (h)'],
              sync.porDia.map(d => [d.dia, d.fuente, d.archivos, d.con_error, d.espera_prom_h, d.espera_max_h]), usuario, 'KLARENS  —  Lectura de archivos EDI')}>Descargar Excel</button>}>
            <div className="cen-scroll"><table className="inv-table cen-tabla cen-tarjetas">
              <thead><tr><th>Día</th><th>Fuente</th><th style={{ textAlign: 'right' }}>Archivos</th><th style={{ textAlign: 'right' }}>Con error</th><th style={{ textAlign: 'right' }}>Espera prom.</th><th style={{ textAlign: 'right' }}>Espera máx.</th></tr></thead>
              <tbody>{sync.porDia.map(d => (
                <tr key={d.dia + d.fuente}><td data-label="Día" className="nw">{fmtFecha(d.dia)}</td><td data-label="Fuente">{d.fuente === 'carvajal' ? 'Carvajal' : 'Subrik'}</td>
                  <td data-label="Archivos" className="num">{d.archivos}</td><td data-label="Con error" className="num" style={{ color: d.con_error ? 'var(--danger)' : undefined }}>{d.con_error}</td>
                  <td data-label="Espera prom." className="num">{d.espera_prom_h === null ? '—' : `${fmtNumero(d.espera_prom_h, 1)} h`}</td>
                  <td data-label="Espera máx." className="num" style={{ color: (d.espera_max_h ?? 0) > 24 ? 'var(--danger)' : undefined }}>{d.espera_max_h === null ? '—' : `${fmtNumero(d.espera_max_h, 1)} h`}</td></tr>
              ))}</tbody>
            </table></div>
          </Seccion>
          {(sync.fallos.length > 0 || sync.errores.length > 0) && (
            <Seccion titulo="Fallos y archivos con error">
              {sync.fallos.map((f, i) => <div key={i} style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 4 }}>{fechaHora(f.inicio)} · {f.origen}{f.usuario ? ` (${f.usuario})` : ''}: {f.error}</div>)}
              {sync.errores.map((e, i) => <div key={i} style={{ fontSize: 13, marginBottom: 4 }}><strong>{e.fuente}</strong> {e.nombre}: <span style={{ color: 'var(--danger)' }}>{e.error}</span></div>)}
            </Seccion>
          )}
        </>)
      )}

      {datos && pestana === 'base' && (
        <Seccion titulo="Base de datos de órdenes" nota="Todas las líneas del periodo, una fila por producto de cada OC (como la hoja BASE DATOS del libro de logística), con punto, ruta, relación, estado, cumplimiento y pedido de Siesa."
          accion={<button className="btn btn-primary" disabled={!lineas.length} onClick={exportarBase}>Descargar Excel ({fmtNumero(lineas.length)} líneas)</button>}>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>{fmtNumero(ordenes.length)} órdenes · {fmtNumero(lineas.length)} líneas · {periodo}</div>
        </Seccion>
      )}
    </div>
  )
}

function TablaOrdenes({ filas, vacio = 'Nada pendiente de atención en este periodo.' }: { filas: (OrdenReporte & { cumple: Cumplimiento })[]; vacio?: string }) {
  if (!filas.length) return <div style={{ color: 'var(--text2)', fontSize: 13 }}>{vacio}</div>
  return (
    <div className="cen-scroll"><table className="inv-table cen-tabla cen-tarjetas">
      <thead><tr><th>OC</th><th>Cadena</th><th>Punto</th><th>Ruta</th><th>Entrega</th><th style={{ textAlign: 'right' }}>Valor</th><th>Estado</th><th>Cumplimiento</th></tr></thead>
      <tbody>{filas.map(o => (
        <tr key={o.id}><td data-label="OC" className="nw"><strong>{o.numero_orden}</strong></td><td data-label="Cadena">{o.cadena}</td>
          <td data-label="Punto" className="ancho"><div>{o.razon_social ?? 'Sin sucursal'}<span className="sub mono">EAN {o.ean_entrega}</span></div></td>
          <td data-label="Ruta">{o.ruta ?? '—'}</td><td data-label="Entrega" className="nw">{fmtFecha(o.fecha_entrega)}</td><td data-label="Valor" className="num">{fmtMoneda(o.valor_total)}</td>
          <td data-label="Estado"><span style={{ background: ESTADOS[o.estado as EstadoOrdenCen]?.bg, color: ESTADOS[o.estado as EstadoOrdenCen]?.color, padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{ESTADOS[o.estado as EstadoOrdenCen]?.label ?? o.estado}</span></td>
          <td data-label="Cumplimiento"><Etiqueta c={o.cumple} /></td></tr>
      ))}</tbody>
    </table></div>
  )
}
