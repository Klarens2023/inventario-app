'use client'
import { useEffect, useMemo, useState } from 'react'
import { diasDeSemana, necesidadSemanal, sabadoDeSemana, MARGEN_PRODUCCION, type FilaNecesidadSemanal, type LineaReporte, type OrdenReporte } from '@/lib/cen/reportes'
import { codigoRelacion } from '@/lib/cen/relacion'
import { exportarExcel } from '@/lib/exportExcel'
import { ESTADOS, fmtFecha, fmtMoneda, fmtNumero } from './utils'
import type { EstadoOrdenCen } from '@/types/ordenes-cen'
import type { ExistenciaItem } from '@/lib/cen/inventario'

type Datos = { ordenes: OrdenReporte[]; lineas: LineaReporte[]; limitado: boolean }
// Foto del inventario guardada en la app: se consulta en Siesa solo con el botón "Actualizar inventario"
type Inventario = { items: ExistenciaItem[]; actualizado_at: string | null; actualizado_por: string | null; conexion: string | null; error?: string }

/** "13 nov, 2:30 p. m. (hace 2 h)" */
function cuando(fecha: string): string {
  const d = new Date(fecha)
  const min = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000))
  const hace = min < 1 ? 'hace un momento' : min < 60 ? `hace ${min} min` : min < 48 * 60 ? `hace ${Math.round(min / 60)} h` : `hace ${Math.round(min / 1440)} días`
  return `${d.toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} (${hace})`
}

// Bodegas que el usuario eligió para el inventario (se recuerdan en este navegador); vacío = todas
const CLAVE_BODEGAS = 'cen-necesidad-bodegas'
function leerBodegas(): string[] {
  try { const v = JSON.parse(localStorage.getItem(CLAVE_BODEGAS) ?? '[]'); return Array.isArray(v) ? v.map(String) : [] } catch { return [] }
}

const masDias = (f: string, n: number) => { const d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const DIA_CORTO = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const diaCorto = (f: string) => { const d = new Date(f + 'T12:00:00Z'); return `${DIA_CORTO[d.getUTCDay()]} ${d.getUTCDate()}` }
const fechaLarga = (f: string) => new Date(f + 'T12:00:00Z').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const cantidad = (v: number | null, medida: 'UND' | 'KG') => v === null ? '—' : medida === 'KG' ? `${fmtNumero(v, 1)} kg` : fmtNumero(v)
const sel: React.CSSProperties = { padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: '#fff' }

/**
 * Necesidad por producto de una semana de sábado a viernes: los pedidos (OC y PVK) que LLEGARON en esa semana
 * (fecha de la OC o del pedido), por ítem de Siesa, con kilos, unidades, valor, inventario, diferencia (lo que
 * falta producir) y la sugerencia con 20 % de margen. Respeta los filtros de cadena y ruta de la página.
 * Clic en un producto: detalle de los pedidos de la semana.
 */
export function NecesidadSemanal({ cadena, ruta, hoy, usuario }: { cadena: string; ruta: string; hoy: string; usuario?: string }) {
  const [sabado, setSabado] = useState(() => sabadoDeSemana(hoy))
  const [datos, setDatos] = useState<Datos | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [detalle, setDetalle] = useState<FilaNecesidadSemanal | null>(null)
  // Inventario actual de Siesa de los ítems de la semana (API_v2_Inventarios_InvFecha, lib/cen/inventario.ts)
  const [inv, setInv] = useState<Inventario | null>(null)
  const [invError, setInvError] = useState('')
  const [invCargando, setInvCargando] = useState(false)
  const [actualizando, setActualizando] = useState(false)
  const [invAviso, setInvAviso] = useState('')
  const [versionInv, setVersionInv] = useState(0) // sube al actualizar para volver a leer la foto guardada
  const [bodegas, setBodegas] = useState<string[]>([])
  const [verBodegas, setVerBodegas] = useState(false)
  useEffect(() => { setBodegas(leerBodegas()) }, [])
  function elegirBodegas(b: string[]) {
    setBodegas(b)
    try { localStorage.setItem(CLAVE_BODEGAS, JSON.stringify(b)) } catch { /* sin almacenamiento: solo por esta vez */ }
  }

  const dias = useMemo(() => diasDeSemana(sabado), [sabado])
  const viernes = dias[6]

  useEffect(() => {
    let vigente = true
    setCargando(true); setError('')
    fetch(`/api/logistica/ordenes-cen/reportes?${new URLSearchParams({ desde: sabado, hasta: viernes, campo: 'orden', cadena, ruta })}`)
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? 'No se pudo cargar la semana'); if (vigente) setDatos(d) })
      .catch(e => { if (vigente) setError(e instanceof Error ? e.message : 'Error') })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [sabado, viernes, cadena, ruta])

  // Ítems de la semana: se lee su existencia de la última foto guardada (no se consulta Siesa)
  const itemsSemana = useMemo(() => datos
    ? Array.from(new Set(necesidadSemanal(datos.ordenes, datos.lineas, dias).map(f => f.f120_id).filter((i): i is number => i !== null))).sort((a, b) => a - b)
    : [], [datos, dias])
  const clavesItems = itemsSemana.join(',')
  useEffect(() => {
    let vigente = true
    setInvCargando(true); setInvError('')
    fetch(`/api/logistica/ordenes-cen/inventario?items=${clavesItems}`)
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? 'No se pudo leer el inventario'); if (vigente) { setInv(d); if (d.error) setInvError(d.error) } })
      .catch(e => { if (vigente) { setInv(null); setInvError(e instanceof Error ? e.message : 'Error') } })
      .finally(() => { if (vigente) setInvCargando(false) })
    return () => { vigente = false }
  }, [clavesItems, versionInv])

  // Consulta manual: trae TODO el inventario de Siesa (~15 s) y reemplaza la foto guardada para todos
  async function actualizarInventario() {
    setActualizando(true); setInvError(''); setInvAviso('')
    try {
      const res = await fetch('/api/logistica/ordenes-cen/inventario', { method: 'POST' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) setInvError(d.error ?? 'No se pudo actualizar el inventario')
      else { setInvAviso(d.mensaje ?? 'Inventario actualizado.'); setVersionInv(v => v + 1) }
    } finally { setActualizando(false) }
  }

  const todasBodegas = useMemo(() => Array.from(new Set((inv?.items ?? []).flatMap(i => Object.keys(i.porBodega)))).sort(), [inv])
  const bodegasActivas = useMemo(() => bodegas.filter(b => todasBodegas.includes(b)), [bodegas, todasBodegas])
  const inventario = useMemo(() => {
    if (!inv?.actualizado_at) return undefined // nunca se ha actualizado: sin diferencia
    const elegidas = bodegasActivas.length ? new Set(bodegasActivas) : null
    return new Map(inv.items.map(i => [i.f120_id, {
      unidad: i.unidad,
      existencia: elegidas ? Object.entries(i.porBodega).filter(([b]) => elegidas.has(b)).reduce((s, [, v]) => s + v, 0) : i.existencia,
    }]))
  }, [inv, bodegasActivas])
  const existenciaPorItem = useMemo(() => new Map((inv?.items ?? []).map(i => [i.f120_id, i])), [inv])

  const filas = useMemo(() => datos ? necesidadSemanal(datos.ordenes, datos.lineas, dias, inventario) : [], [datos, dias, inventario])
  const total = useMemo(() => ({
    unidades: filas.reduce((s, f) => s + f.unidades, 0), kg: filas.reduce((s, f) => s + f.kg, 0),
    kgCompleto: filas.every(f => f.kgCompleto), valor: filas.reduce((s, f) => s + f.valor, 0),
    ordenes: new Set(filas.flatMap(f => f.ordenIds)).size,
  }), [filas])
  const esActual = sabado === sabadoDeSemana(hoy)

  function descargar() {
    exportarExcel(`Necesidad_semana_${sabado}_a_${viernes}`,
      ['Ítem Siesa', 'EAN', 'Descripción', 'Medida', ...dias.map(d => `Und ${d}`), ...dias.map(d => `Kg ${d}`), 'Kilos', 'Unidades', 'Valor', 'OC', 'Inventario', 'Diferencia', `Sugerido (+${MARGEN_PRODUCCION * 100} %)`],
      filas.map(f => [f.f120_id, f.ean, f.descripcion, f.medida, ...dias.map(d => f.porDia[d]?.unidades || null), ...dias.map(d => f.porDia[d] ? Math.round(f.porDia[d].kg * 10) / 10 : null),
        Math.round(f.kg * 10) / 10, f.unidades, f.valor, f.ordenes, f.inventario, f.diferencia, f.sugerido]),
      usuario, `KLARENS  —  Necesidad por producto · semana del ${fechaLarga(sabado)} al ${fechaLarga(viernes)}`)
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800 }}>Necesidad por producto · semanal</h2>
          <div style={{ fontSize: 12, color: 'var(--text2)', maxWidth: 820 }}>
            Pedidos (OC y PVK institucionales) que llegaron de sábado 00:00 a viernes 23:59, por ítem de Siesa, sin descartados.
            Respeta los filtros de cadena y ruta. Clic en un producto para ver sus pedidos.
          </div>
        </div>
        <button className="btn btn-primary" onClick={descargar} disabled={!filas.length}>Descargar Excel</button>
      </div>

      {/* Navegación por semanas (historial) */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <button className="btn" onClick={() => setSabado(masDias(sabado, -7))} title="Semana anterior">◀</button>
        <strong style={{ fontSize: 14 }}>Semana del sáb {fechaLarga(sabado)} al vie {fechaLarga(viernes)}</strong>
        <button className="btn" onClick={() => setSabado(masDias(sabado, 7))} title="Semana siguiente">▶</button>
        {!esActual && <button className="btn" onClick={() => setSabado(sabadoDeSemana(hoy))}>Semana actual</button>}
        <label style={{ fontSize: 12, color: 'var(--text2)' }}>Ir a la semana de <input type="date" value={sabado} onChange={e => e.target.value && setSabado(sabadoDeSemana(e.target.value))} style={sel} /></label>
        {cargando && <span style={{ fontSize: 12, color: 'var(--text2)' }}>Cargando...</span>}
      </div>

      {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>{error}</div>}
      {/* Inventario actual de Siesa y bodegas que cuentan */}
      {datos && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 6, padding: '6px 10px', marginBottom: 10, color: '#92400E', position: 'relative' }}>
          <button className="btn" style={{ padding: '4px 12px', fontSize: 12, fontWeight: 700 }} onClick={actualizarInventario} disabled={actualizando}
            title="Consulta ahora las existencias en Siesa. El inventario solo se actualiza con este botón.">
            {actualizando ? 'Consultando Siesa...' : '⟳ Actualizar inventario'}
          </button>
          <span>
            {inv?.actualizado_at
              ? <><strong>Última actualización:</strong> {cuando(inv.actualizado_at)}{inv.actualizado_por ? ` por ${inv.actualizado_por}` : ''}{inv.conexion === 'qa' ? ' · Siesa QA' : ''}</>
              : <strong>El inventario aún no se ha consultado: presiona Actualizar inventario.</strong>}
            {inv?.actualizado_at && !esActual && ' · es la existencia de esa fecha, no la de la semana elegida'}
          </span>
          {invCargando && <span>Leyendo...</span>}
          {invAviso && !actualizando && <span style={{ color: '#047857', fontWeight: 700 }}>✓ {invAviso}</span>}
          {invError && <span style={{ color: 'var(--danger)' }}>{invError}</span>}
          {inv?.actualizado_at && !invCargando && (
            <>
              <button className="btn" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => setVerBodegas(v => !v)}>
                Bodegas: {bodegasActivas.length ? `${bodegasActivas.length} de ${todasBodegas.length}` : 'todas'} ▾
              </button>
              <span>Diferencia = pedido − existencia (lo que falta producir) · sugerido = diferencia + {MARGEN_PRODUCCION * 100} %</span>
              {verBodegas && (
                <div className="card" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 20, padding: 10, width: 340, maxWidth: 'calc(100vw - 48px)', boxShadow: '0 8px 24px rgba(0,0,0,.15)', color: 'var(--text)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <strong style={{ fontSize: 13 }}>Bodegas que cuentan</strong>
                    <button className="btn" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => elegirBodegas([])}>Todas</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
                    {todasBodegas.map(b => (
                      <label key={b} style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input type="checkbox" checked={!bodegasActivas.length || bodegasActivas.includes(b)}
                          onChange={e => {
                            const base = bodegasActivas.length ? bodegasActivas : todasBodegas
                            const n = e.target.checked ? [...base, b] : base.filter(x => x !== b)
                            elegirBodegas(n.length === todasBodegas.length ? [] : n)
                          }} /> {b}
                      </label>
                    ))}
                  </div>
                  <div style={{ textAlign: 'right', marginTop: 8 }}><button className="btn" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => setVerBodegas(false)}>Listo</button></div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {datos && !filas.length && !cargando && <div style={{ color: 'var(--text2)', fontSize: 13 }}>No llegaron pedidos en esta semana con estos filtros.</div>}
      {filas.length > 0 && (
        <div className="cen-necesidad">
          <table className="inv-table">
            <thead>
              <tr>
                <th className="cen-fija">Producto</th>
                {dias.map(d => <th key={d} className="num" title={fmtFecha(d)}>{diaCorto(d)}</th>)}
                <th className="num cen-col-total">Kilos</th><th className="num">Unidades</th><th className="num">Valor</th><th className="num">OC</th>
                <th className="num cen-col-inv">Inventario</th><th className="num cen-col-inv">Diferencia</th><th className="num cen-col-inv" title={`Diferencia + ${MARGEN_PRODUCCION * 100} %`}>+{MARGEN_PRODUCCION * 100} %</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(f => (
                <tr key={f.clave} onClick={() => setDetalle(f)} title="Ver los pedidos de este producto en la semana">
                  <td className="cen-fija">
                    <div className="cen-prod">{f.descripcion}</div>
                    <span className="sub mono">{f.f120_id ? `Ítem ${f.f120_id}` : `EAN ${f.ean}`}{f.medida === 'KG' ? ' · por kilo' : ''}</span>
                  </td>
                  {dias.map(d => {
                    const x = f.porDia[d]
                    return (
                      <td key={d} className="num">
                        {x ? <>{x.unidades > 0 ? fmtNumero(x.unidades) : ''}<span className="sub">{x.kgCompleto ? `${fmtNumero(x.kg, 1)} kg` : 'kg —'}</span></> : <span style={{ color: '#CBD5E1' }}>·</span>}
                      </td>
                    )
                  })}
                  <td className="num cen-col-total"><strong>{fmtNumero(f.kg, 1)}</strong>{!f.kgCompleto && <span title="Hay líneas sin peso en el maestro">*</span>}</td>
                  <td className="num"><strong>{f.unidades ? fmtNumero(f.unidades) : '—'}</strong></td>
                  <td className="num">{fmtMoneda(f.valor)}</td>
                  <td className="num">{f.ordenes}</td>
                  <td className="num cen-col-inv">{cantidad(f.inventario, f.medida)}</td>
                  <td className="num cen-col-inv" style={{ fontWeight: 700, color: f.diferencia ? '#B91C1C' : undefined }}>{cantidad(f.diferencia, f.medida)}</td>
                  <td className="num cen-col-inv" style={{ fontWeight: 700 }}>{cantidad(f.sugerido, f.medida)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="cen-fija"><strong>Total semana</strong> <span className="sub">{filas.length} producto(s)</span></td>
                {dias.map(d => {
                  const kgDia = filas.reduce((s, f) => s + (f.porDia[d]?.kg ?? 0), 0)
                  return <td key={d} className="num">{kgDia ? `${fmtNumero(kgDia, 1)} kg` : ''}</td>
                })}
                <td className="num cen-col-total"><strong>{fmtNumero(total.kg, 1)}</strong>{!total.kgCompleto && '*'}</td>
                <td className="num"><strong>{fmtNumero(total.unidades)}</strong></td>
                <td className="num"><strong>{fmtMoneda(total.valor)}</strong></td>
                <td className="num"><strong>{total.ordenes}</strong></td>
                <td className="cen-col-inv" colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {filas.some(f => !f.kgCompleto) && <div style={{ fontSize: 12, color: '#B45309', marginTop: 8 }}>* Hay productos sin peso en el maestro: sus kilos están incompletos.</div>}

      {detalle && datos && (
        <DetalleProducto fila={filas.find(f => f.clave === detalle.clave) ?? detalle} datos={datos} dias={dias} onClose={() => setDetalle(null)}
          existencia={detalle.f120_id !== null ? existenciaPorItem.get(detalle.f120_id) ?? null : null} bodegas={bodegasActivas} />
      )}
    </div>
  )
}

// Pedidos de la semana que traen el producto (por ítem de Siesa o, sin ítem, por EAN)
function DetalleProducto({ fila, datos, dias, onClose, existencia, bodegas }: {
  fila: FilaNecesidadSemanal; datos: Datos; dias: string[]; onClose: () => void
  existencia: ExistenciaItem | null; bodegas: string[] // bodegas elegidas (vacío = todas)
}) {
  const ordenPorId = useMemo(() => new Map(datos.ordenes.map(o => [o.id, o])), [datos])
  const ids = useMemo(() => new Set(fila.ordenIds), [fila])
  const filas = useMemo(() => datos.lineas
    .filter(l => ids.has(l.orden_id) && (fila.f120_id !== null ? (l.f120_id ?? Number(/^SIESA-(\d+)$/.exec(l.ean_item)?.[1] ?? NaN)) === fila.f120_id : l.ean_item === fila.ean))
    .map(l => ({ l, o: ordenPorId.get(l.orden_id)! }))
    .sort((a, b) => String(a.o.fecha_orden).localeCompare(String(b.o.fecha_orden)) || a.o.numero_orden.localeCompare(b.o.numero_orden)),
  [datos, ids, fila, ordenPorId])

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc); return () => document.removeEventListener('keydown', esc)
  }, [onClose])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
      <div onClick={e => e.stopPropagation()} className="card" role="dialog" aria-modal="true" aria-label={fila.descripcion} style={{ width: '100%', maxWidth: 1000, maxHeight: '94vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>{fila.descripcion}</h2>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>{fila.f120_id ? `Ítem Siesa ${fila.f120_id}` : `EAN ${fila.ean}`} · semana del {fmtFecha(dias[0])} al {fmtFecha(dias[6])}</div>
          </div>
          <button className="btn" onClick={onClose}>Cerrar</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 12 }}>
          {([
            ['Kilos', `${fmtNumero(fila.kg, 1)} kg${fila.kgCompleto ? '' : '*'}`], ['Unidades', fila.unidades ? fmtNumero(fila.unidades) : '—'], ['Valor', fmtMoneda(fila.valor)],
            ['Pedidos', String(fila.ordenes)], ['Inventario', cantidad(fila.inventario, fila.medida)], ['Diferencia', cantidad(fila.diferencia, fila.medida)],
            [`Sugerido +${MARGEN_PRODUCCION * 100} %`, cantidad(fila.sugerido, fila.medida)],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700 }}>{k}</div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, fontSize: 12 }}>
          {dias.map(d => {
            const x = fila.porDia[d]
            return (
              <span key={d} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', background: x ? '#EEF4FF' : '#fff', color: x ? 'var(--text)' : 'var(--text2)' }}>
                <strong>{diaCorto(d)}</strong>: {x ? `${x.unidades ? `${fmtNumero(x.unidades)} und · ` : ''}${fmtNumero(x.kg, 1)} kg` : '—'}
              </span>
            )
          })}
        </div>

        {existencia && (
          <div style={{ fontSize: 12, marginBottom: 12, color: 'var(--text2)' }}>
            <strong style={{ color: 'var(--text)' }}>Existencia por bodega ({existencia.unidad}):</strong>{' '}
            {Object.entries(existencia.porBodega).sort((a, b) => b[1] - a[1]).map(([b, v]) => (
              <span key={b} style={{ display: 'inline-block', margin: '2px 4px 2px 0', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)',
                background: !bodegas.length || bodegas.includes(b) ? '#FFFBEB' : '#fff', opacity: !bodegas.length || bodegas.includes(b) ? 1 : 0.5 }}>
                {b}: <strong style={{ color: 'var(--text)' }}>{fmtNumero(v, 2)}</strong>
              </span>
            ))}
            {existencia.comprometida > 0 && <span> · comprometido en pedidos: <strong>{fmtNumero(existencia.comprometida, 2)}</strong></span>}
          </div>
        )}

        <div className="cen-scroll" style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
          <table className="inv-table cen-tabla cen-tarjetas">
            <thead><tr><th>Pedido / OC</th><th>Cliente</th><th>Ruta · relación</th><th>Llegó</th><th>Entrega</th><th>Estado</th><th className="num">Cantidad</th><th className="num">Kilos</th><th className="num">Valor</th></tr></thead>
            <tbody>
              {filas.map(({ l, o }) => {
                const kg = l.unidad === 'KG' ? l.cantidad : l.peso_unitario === null ? null : l.cantidad * l.peso_unitario
                const est = ESTADOS[o.estado as EstadoOrdenCen]
                return (
                  <tr key={`${o.id}-${l.nro_linea}`}>
                    <td data-label="Pedido / OC" className="nw"><div><strong>{o.numero_orden}</strong><span className="sub">{o.cadena}{o.siesa_consecutivo && o.fuente !== 'institucional' ? ` · ${o.siesa_consecutivo}` : ''}</span></div></td>
                    <td data-label="Cliente" className="ancho"><div>{o.razon_social ?? `EAN ${o.ean_entrega}`}<span className="sub">{o.ciudad ?? ''}</span></div></td>
                    <td data-label="Ruta" className="nw">{o.ruta ? <><strong>{o.ruta}</strong><span className="sub">{codigoRelacion(o.ruta, o.fecha_despacho)}</span></> : '—'}</td>
                    <td data-label="Llegó" className="nw">{fmtFecha(o.fecha_orden)}</td>
                    <td data-label="Entrega" className="nw">{fmtFecha(o.fecha_entrega)}</td>
                    <td data-label="Estado">{est ? <span style={{ background: est.bg, color: est.color, padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{est.label}</span> : o.estado}</td>
                    <td data-label="Cantidad" className="num">{fmtNumero(l.cantidad, l.unidad === 'KG' ? 1 : 0)} {l.unidad === 'KG' ? 'kg' : 'und'}</td>
                    <td data-label="Kilos" className="num">{kg === null ? '—' : fmtNumero(kg, 1)}</td>
                    <td data-label="Valor" className="num">{fmtMoneda(l.cantidad * l.precio)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
