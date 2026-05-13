'use client'
import { useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { exportarExcel } from '@/lib/exportExcel'

type Modo = 'items' | 'lotes'

type Row = {
  fecha: string; categoria: string; tipo: string; referencia: string
  descripcion: string; localizacion: string; um: string
  cantidad_sistema: number; costo_unitario: number
  conteo_fisico: number; diferencia: number
  costo_diferencia: number; costo_bodega_total: number
  observaciones: string; lote: string | null; modo: string
}
type Totales = { costo_bodega: number; costo_diferencia: number }

function fmt(n: number, prefix = '$') {
  if (n === null || n === undefined || isNaN(n)) return '—'
  const s = Math.abs(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })
  return (n < 0 ? `-${prefix}` : prefix) + s
}

function fmtFechaCorta(f: string) {
  return String(f).substring(0, 10).replace(/-/g, '/')
}

export default function AcumuladosPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.rol === 'admin'
  const [modo,      setModo]     = useState<Modo>('items')
  const [desde,     setDesde]    = useState('')
  const [hasta,     setHasta]    = useState('')
  const [tipoFil,   setTipoFil]  = useState('todos')
  const [bodegaSel, setBodegaSel] = useState('todas')
  const [rows,      setRows]     = useState<Row[]>([])
  const [totales,   setTotales]  = useState<Totales | null>(null)
  const [loading,   setLoading]  = useState(false)
  const [error,     setError]    = useState('')
  const [reiniciando, setRein]   = useState(false)
  const [confirm,   setConfirm]  = useState(0)
  const [detalle,   setDetalle]  = useState<Row | null>(null)

  async function buscar() {
    setLoading(true); setError(''); setDetalle(null)
    try {
      const params = new URLSearchParams()
      if (desde) params.set('desde', desde)
      if (hasta) params.set('hasta', hasta)
      params.set('modo', modo)
      const res  = await fetch(`/api/acumulados?${params}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? `Error ${res.status}`); setRows([]); setTotales(null) }
      else { setRows(data.rows ?? []); setTotales(data.totales ?? null) }
    } catch (e: any) { setError('Error: ' + e.message) }
    finally { setLoading(false) }
  }

  async function reiniciar() {
    if (confirm < 1) { setConfirm(1); return }
    setRein(true)
    try { await fetch('/api/reiniciar', { method: 'DELETE' }); setRows([]); setTotales(null); setConfirm(0); alert('Historial eliminado.') }
    catch { alert('Error al reiniciar.') }
    setRein(false)
  }

  // Tipos y bodegas únicos en los resultados para los filtros
  const tiposDisponibles = useMemo(() =>
    Array.from(new Set(rows.map(r => r.tipo).filter(Boolean))).sort(),
  [rows])

  const bodegasDisponibles = useMemo(() =>
    Array.from(new Set(rows.map(r => r.localizacion).filter(Boolean))).sort(),
  [rows])

  // Filtrar filas por tipo y bodega seleccionados
  const rowsFiltradas = useMemo(() =>
    rows.filter(r =>
      (tipoFil === 'todos' || r.tipo === tipoFil) &&
      (bodegaSel === 'todas' || r.localizacion === bodegaSel)
    )
  , [rows, tipoFil, bodegaSel])

  const esLotes = modo === 'lotes'

  // Pivot: filas = referencias (+ lote en modo lotes), columnas = fechas
  const pivotData = useMemo(() => {
    const fechasSet = new Set<string>()
    const mapItems: Record<string, {
      referencia: string; descripcion: string; categoria: string
      tipo: string; lote: string | null; datosPorFecha: Record<string, Row>
    }> = {}
    rowsFiltradas.forEach(r => {
      const f   = fmtFechaCorta(r.fecha)
      const key = esLotes ? `${r.referencia}|${r.lote ?? ''}` : r.referencia
      fechasSet.add(f)
      if (!mapItems[key]) {
        mapItems[key] = {
          referencia: r.referencia,
          descripcion: r.descripcion,
          categoria: r.categoria,
          tipo: r.tipo,
          lote: r.lote ?? null,
          datosPorFecha: {}
        }
      }
      mapItems[key].datosPorFecha[f] = r
    })
    return {
      fechas: Array.from(fechasSet).sort(),
      items:  Object.values(mapItems).sort((a, b) => {
        const c = a.referencia.localeCompare(b.referencia)
        if (c !== 0) return c
        return (a.lote ?? '').localeCompare(b.lote ?? '')
      })
    }
  }, [rowsFiltradas, esLotes])

  function exportar() {
    const baseCols = esLotes
      ? ['Referencia', 'Lote', 'Descripcion', 'Categoria', 'Tipo']
      : ['Referencia', 'Descripcion', 'Categoria', 'Tipo']

    const cols = [...baseCols, ...pivotData.fechas.flatMap(f => [`Dif ${f}`, `Costo Dif ${f}`])]

    const filas: (string | number)[][] = pivotData.items.map(item => {
      const base: (string | number)[] = esLotes
        ? [item.referencia, item.lote ?? '', item.descripcion, item.categoria, item.tipo]
        : [item.referencia, item.descripcion, item.categoria, item.tipo]

      const datos: (string | number)[] = pivotData.fechas.flatMap(f => {
        const d = item.datosPorFecha[f]
        const valores: (string | number)[] = d ? [Number(d.diferencia), Number(d.costo_diferencia)] : ['', '']
        return valores
      })
      return [...base, ...datos]
    })

    exportarExcel(`Acumulados_${modo}_${desde}_${hasta}`, cols, filas)
  }

  const totalsFiltrados = {
    costo_bodega:     rowsFiltradas.reduce((s, r) => s + Number(r.costo_bodega_total ?? 0), 0),
    costo_diferencia: rowsFiltradas.reduce((s, r) => s + Number(r.costo_diferencia ?? 0), 0),
  }
  const part = totalsFiltrados.costo_bodega !== 0
    ? ((totalsFiltrados.costo_diferencia / totalsFiltrados.costo_bodega) * 100).toFixed(1) + '%'
    : '—'

  const modoStyle = (m: Modo): React.CSSProperties => ({
    padding: '7px 16px', borderRadius: 6,
    border: `2px solid ${modo === m ? '#0047BA' : 'var(--border)'}`,
    background: modo === m ? '#0047BA' : 'transparent',
    color: modo === m ? '#fff' : 'var(--text)',
    fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all 0.15s'
  })

  return (
    <div style={{ padding: '24px 32px', height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Informe Acumulados</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 2 }}>Matriz de diferencias por referencia y fecha</p>
        </div>
        {isAdmin && (
          <button onClick={reiniciar} disabled={reiniciando} className="btn btn-danger" style={{ fontSize: 12 }}>
            {confirm === 1 ? 'CONFIRMAR BORRADO TOTAL' : 'Reiniciar historial'}
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>

        {/* Selector de modo */}
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase' }}>Tipo</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={() => { setModo('items'); setRows([]); setTotales(null) }} style={modoStyle('items')}>📦 Items</button>
            <button type="button" onClick={() => { setModo('lotes'); setRows([]); setTotales(null) }} style={modoStyle('lotes')}>🏷️ Lotes</button>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase' }}>Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
            style={{ padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase' }}>Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            style={{ padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }} />
        </div>
        <button onClick={buscar} className="btn btn-primary" disabled={loading} style={{ alignSelf: 'flex-end' }}>
          {loading ? 'Buscando...' : 'Buscar'}
        </button>

        {/* Filtro subcategoria */}
        {tiposDisponibles.length > 1 && (
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase' }}>Subcategoria</label>
            <select value={tipoFil} onChange={e => setTipoFil(e.target.value)}
              style={{ padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }}>
              <option value="todos">Todos</option>
              {tiposDisponibles.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}

        {/* Filtro bodega */}
        {bodegasDisponibles.length > 0 && (
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase' }}>Bodega</label>
            <select value={bodegaSel} onChange={e => setBodegaSel(e.target.value)}
              style={{ padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }}>
              <option value="todas">Todas</option>
              {bodegasDisponibles.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        )}

        {/* Exportar */}
        {rows.length > 0 && (
          <button onClick={exportar} className="btn" style={{ fontSize: 12, alignSelf: 'flex-end' }}>
            Exportar Excel
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 6, background: 'rgba(248,81,73,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Totales */}
      {totales && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div className="stat-card"><div className="stat-label">{esLotes ? 'Registros (lote)' : 'Referencias'}</div><div className="stat-value">{pivotData.items.length}</div></div>
          <div className="stat-card"><div className="stat-label">Costo Bodega</div><div className="stat-value" style={{ fontSize: 14 }}>{fmt(totalsFiltrados.costo_bodega)}</div></div>
          <div className="stat-card">
            <div className="stat-label">Costo Diferencia</div>
            <div className="stat-value" style={{ fontSize: 14, color: totalsFiltrados.costo_diferencia < 0 ? 'var(--danger)' : 'var(--accent)' }}>
              {fmt(totalsFiltrados.costo_diferencia)}
            </div>
          </div>
          <div className="stat-card"><div className="stat-label">Participacion</div><div className="stat-value" style={{ color: 'var(--warn)' }}>{part}</div></div>
        </div>
      )}

      {/* Matriz pivot */}
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Cargando...</div>
        ) : rowsFiltradas.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Sin datos. Selecciona fechas y presiona Buscar.</div>
        ) : (
          <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg3)' }}>
              <tr>
                <th style={{ border: '1px solid var(--border)', padding: '6px 10px', textAlign: 'left', minWidth: 100 }}>REFERENCIA</th>
                {esLotes && (
                  <th style={{ border: '1px solid var(--border)', padding: '6px 10px', textAlign: 'left', minWidth: 110 }}>LOTE</th>
                )}
                <th style={{ border: '1px solid var(--border)', padding: '6px 10px', textAlign: 'left', minWidth: 220 }}>DESCRIPCION</th>
                <th style={{ border: '1px solid var(--border)', padding: '6px 10px', textAlign: 'center', minWidth: 80 }}>CATEGORIA</th>
                <th style={{ border: '1px solid var(--border)', padding: '6px 10px', textAlign: 'center', minWidth: 70 }}>SUBCATEGORIA</th>
                {pivotData.fechas.map(f => (
                  <th key={f} style={{ border: '1px solid var(--border)', padding: '6px 10px', minWidth: 90, textAlign: 'center', color: 'var(--accent)' }}>
                    {f}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pivotData.items.map((item, idx) => {
                const rowKey = esLotes ? `${item.referencia}|${item.lote ?? ''}` : item.referencia
                return (
                  <tr key={rowKey} style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                    <td style={{ border: '1px solid var(--border)', padding: '4px 10px', fontWeight: 600, fontFamily: 'monospace' }}>{item.referencia}</td>
                    {esLotes && (
                      <td style={{ border: '1px solid var(--border)', padding: '4px 10px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text2)' }}>
                        {item.lote ?? '—'}
                      </td>
                    )}
                    <td style={{ border: '1px solid var(--border)', padding: '4px 10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280 }}>{item.descripcion}</td>
                    <td style={{ border: '1px solid var(--border)', padding: '4px 10px', textAlign: 'center', fontSize: 11, color: 'var(--text2)' }}>{item.categoria}</td>
                    <td style={{ border: '1px solid var(--border)', padding: '4px 10px', textAlign: 'center' }}>
                      <span style={{ background: 'var(--bg3)', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>{item.tipo}</span>
                    </td>
                    {pivotData.fechas.map(f => {
                      const d   = item.datosPorFecha[f]
                      const dif = d ? Number(d.diferencia) : null
                      return (
                        <td key={f}
                          onClick={() => d && setDetalle(d)}
                          style={{
                            border: '1px solid var(--border)', padding: '4px 10px', textAlign: 'right',
                            cursor: d ? 'pointer' : 'default',
                            color: dif && dif < 0 ? 'var(--danger)' : dif && dif > 0 ? 'var(--accent)' : 'inherit'
                          }}
                          title={d ? 'Clic para ver detalles' : ''}>
                          {dif !== null && dif !== 0 ? dif.toLocaleString('es-CO') : (dif === 0 ? '0' : '')}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal detalle */}
      {detalle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--bg)', width: '95%', maxWidth: 960, borderRadius: 8, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg2)' }}>
              <h2 style={{ fontSize: 14, margin: 0 }}>
                {detalle.descripcion}
                {esLotes && detalle.lote ? <span style={{ color: 'var(--text2)', marginLeft: 8 }}>| Lote: {detalle.lote}</span> : null}
                {' — '}{fmtFechaCorta(detalle.fecha)}
              </h2>
              <button onClick={() => setDetalle(null)} style={{ background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text)' }}>x</button>
            </div>
            <div style={{ padding: 20, overflowX: 'auto' }}>
              <table className="inv-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Referencia</th>
                    {esLotes && <th>Lote</th>}
                    <th>Descripcion</th><th>Loc.</th><th>U.M</th>
                    <th>Fecha</th><th>Categoria</th><th>Subcategoria</th>
                    <th>Conteo Fisico</th><th>Cant. Sistema</th><th>Diferencia</th>
                    <th>Costo Unit.</th><th>Costo Dif.</th><th>Costo Bodega</th><th>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="mono">{detalle.referencia}</td>
                    {esLotes && <td className="mono">{detalle.lote ?? '—'}</td>}
                    <td>{detalle.descripcion}</td>
                    <td>{detalle.localizacion}</td>
                    <td>{detalle.um}</td>
                    <td>{fmtFechaCorta(detalle.fecha)}</td>
                    <td style={{ fontSize: 11, color: 'var(--text2)' }}>{detalle.categoria}</td>
                    <td><span style={{ background: 'var(--bg3)', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>{detalle.tipo}</span></td>
                    <td style={{ textAlign: 'right' }}>{Number(detalle.conteo_fisico).toLocaleString('es-CO')}</td>
                    <td style={{ textAlign: 'right' }}>{Number(detalle.cantidad_sistema).toLocaleString('es-CO')}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }} className={Number(detalle.diferencia) < 0 ? 'neg' : 'pos'}>{Number(detalle.diferencia).toLocaleString('es-CO')}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(detalle.costo_unitario)}</td>
                    <td style={{ textAlign: 'right' }} className={Number(detalle.costo_diferencia) < 0 ? 'neg' : ''}>{fmt(detalle.costo_diferencia)}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(detalle.costo_bodega_total)}</td>
                    <td style={{ color: 'var(--text2)' }}>{detalle.observaciones || '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
