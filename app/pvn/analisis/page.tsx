'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { tieneModulo } from '@/lib/permissions'

type Summary     = { total_registros: number; total_unidades: number; total_productos_distintos: number }
type Producto    = { producto_id: number; producto_nombre: string; total_vendido: number }
type Ingrediente = { componente_nombre: string; unidad: string; total_consumido: number }
type Tendencia   = { fecha: string; total_unidades: number }
type PuntoVenta  = { id: number; nombre: string; activo: boolean }

type Data = { summary: Summary; productos: Producto[]; ingredientes: Ingrediente[]; tendencia: Tendencia[] }

type DetalleProd = {
  producto_nombre: string
  total_vendido: number
  en_registros: number
  por_dia:    Array<{ fecha: string; unidades: number }>
  por_turno:  Array<{ turno: string; unidades: number }>
  componentes: Array<{ componente_nombre: string; unidad: string; por_unidad: number; total_consumido: number }>
}

function limpiar(n: string) { return n.replace(/ \(IVA\)$/, '').replace(/ IVA$/, '') }

function fmtNum(v: number, unidad: string) {
  if (unidad === 'KG')  return Number(v).toFixed(3)
  if (unidad === 'GRM') return Number(v).toFixed(1)
  return Math.round(Number(v)).toString()
}

function fmtFechaCort(s: string) {
  return new Date(s.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

const TURNO_COLOR: Record<string, { color: string; bg: string }> = {
  'Mañana': { color: '#92400e', bg: '#fef3c7' },
  'Tarde':  { color: '#1e3a5f', bg: '#dbeafe' },
  'Noche':  { color: '#4c1d95', bg: '#ede9fe' },
  'Cierre': { color: '#065f46', bg: '#d1fae5' },
}

export default function AnalisisPVNPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [data, setData]       = useState<Data | null>(null)
  const [puntos, setPuntos]   = useState<PuntoVenta[]>([])
  const [loading, setLoading] = useState(false)
  const [pvFiltro, setPvFiltro] = useState('todos')
  const [desde, setDesde]     = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]
  })
  const [hasta, setHasta] = useState(new Date().toISOString().split('T')[0])

  // Modal detalle producto
  const [detalle, setDetalle]   = useState<DetalleProd | null>(null)
  const [detLoading, setDetLoading] = useState(false)

  const { rol, modulos } = (session?.user ?? {}) as { rol?: string; modulos?: string[] }
  const canView = tieneModulo(rol ?? '', modulos, 'pvn_analisis')

  useEffect(() => {
    if (status === 'authenticated' && !canView) router.replace('/dashboard')
  }, [status, canView, router])

  useEffect(() => {
    if (status === 'authenticated' && canView) {
      fetch('/api/pvn/puntos-venta').then(r => r.json()).then(setPuntos)
    }
  }, [status, canView])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ desde, hasta })
      if (pvFiltro !== 'todos') params.set('punto_venta_id', pvFiltro)
      const res = await fetch(`/api/pvn/analisis?${params}`)
      setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [desde, hasta, pvFiltro])

  useEffect(() => {
    if (status === 'authenticated' && canView) cargar()
  }, [status, canView, cargar])

  async function abrirDetalle(p: Producto) {
    setDetLoading(true)
    setDetalle(null)
    const params = new URLSearchParams({ producto_id: String(p.producto_id), desde, hasta })
    if (pvFiltro !== 'todos') params.set('punto_venta_id', pvFiltro)
    try {
      const res = await fetch(`/api/pvn/analisis/producto?${params}`)
      setDetalle(await res.json())
    } finally {
      setDetLoading(false)
    }
  }

  if (status === 'loading' || !canView) return null

  const totalVendido = data?.productos?.reduce((s, p) => s + Number(p.total_vendido), 0) ?? 0
  const maxVendido   = Math.max(...(data?.productos?.map(p => Number(p.total_vendido)) ?? [1]), 1)
  const maxTendencia = Math.max(...(data?.tendencia?.map(t => Number(t.total_unidades)) ?? [1]), 1)
  const maxDia       = Math.max(...(detalle?.por_dia?.map(d => d.unidades) ?? [1]), 1)

  return (
    <div style={{ padding: '32px 28px', background: '#f8fafc', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>Análisis PVN</h1>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>Ventas y consumo de ingredientes por período</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {puntos.length > 0 && (
            <div>
              <label style={lbl}>Punto de Venta</label>
              <select value={pvFiltro} onChange={e => setPvFiltro(e.target.value)} style={inp}>
                <option value="todos">Todos los puntos</option>
                {puntos.map(pv => <option key={pv.id} value={String(pv.id)}>{pv.nombre}</option>)}
              </select>
            </div>
          )}
          <div><label style={lbl}>Desde</label><input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Hasta</label><input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={inp} /></div>
          <button onClick={cargar} style={btnPrimary}>Filtrar</button>
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Calculando...</div>}

      {!loading && data && (
        <>
          {/* Tarjetas */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
            {[
              { label: 'Registros en el período', value: data.summary.total_registros,           color: '#0047BA' },
              { label: 'Unidades vendidas',        value: data.summary.total_unidades,            color: '#065f46' },
              { label: 'Productos distintos',      value: data.summary.total_productos_distintos, color: '#7c3aed' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: '#fff', borderRadius: 12, padding: '18px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

            {/* Ranking productos */}
            <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
                Ventas por Producto
                <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8', marginLeft: 8 }}>clic para ver detalle</span>
              </div>
              {data.productos.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Sin datos</div>
              )}
              {data.productos.map((p, i) => {
                const pct  = totalVendido > 0 ? Math.round((Number(p.total_vendido) / totalVendido) * 100) : 0
                const barW = Math.round((Number(p.total_vendido) / maxVendido) * 100)
                return (
                  <div
                    key={p.producto_id}
                    onClick={() => abrirDetalle(p)}
                    style={{ padding: '9px 20px', borderBottom: '1px solid #f8fafc', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: '#1e293b', fontWeight: i < 3 ? 700 : 400 }}>
                        {i < 3 && <span style={{ marginRight: 5, fontSize: 11 }}>{['🥇','🥈','🥉'][i]}</span>}
                        {limpiar(p.producto_nombre)}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#0047BA', marginLeft: 8, whiteSpace: 'nowrap' }}>
                        {p.total_vendido} <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>({pct}%)</span>
                      </span>
                    </div>
                    <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${barW}%`, background: '#0047BA', borderRadius: 3 }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Tendencia diaria */}
            <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
                Tendencia Diaria
              </div>
              {data.tendencia.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Sin datos</div>
              )}
              <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 370, overflowY: 'auto' }}>
                {data.tendencia.map(t => {
                  const barW = Math.round((Number(t.total_unidades) / maxTendencia) * 100)
                  return (
                    <div key={t.fecha} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: '#64748b', minWidth: 60, whiteSpace: 'nowrap' }}>{fmtFechaCort(t.fecha)}</span>
                      <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${barW}%`, background: '#6366f1', borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', minWidth: 28, textAlign: 'right' }}>{t.total_unidades}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Consumo de ingredientes */}
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
              Consumo de Ingredientes
              <span style={{ fontSize: 12, fontWeight: 400, color: '#64748b', marginLeft: 8 }}>calculado según ventas registradas</span>
            </div>
            {data.ingredientes.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Sin datos</div>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['Ingrediente / Componente', 'Total Consumido', 'Unidad'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.ingredientes.map((ing, i) => (
                    <tr key={ing.componente_nombre} style={{ borderBottom: '1px solid #f8fafc', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '10px 16px', color: '#1e293b', fontWeight: 500 }}>{ing.componente_nombre}</td>
                      <td style={{ padding: '10px 16px', fontWeight: 700, color: '#0047BA' }}>{fmtNum(Number(ing.total_consumido), ing.unidad)}</td>
                      <td style={{ padding: '10px 16px', color: '#64748b' }}>{ing.unidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal detalle producto */}
      {(detLoading || detalle) && (
        <div
          onClick={() => { setDetalle(null); setDetLoading(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}
          >
            {detLoading && (
              <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Cargando detalle...</div>
            )}

            {!detLoading && detalle && (
              <>
                {/* Cabecera modal */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#0047BA', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Detalle de producto</div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>{limpiar(detalle.producto_nombre)}</h2>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                      {desde} → {hasta}
                      {pvFiltro !== 'todos' && (() => {
                        const pv = puntos.find(p => String(p.id) === pvFiltro)
                        return pv ? <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 12, background: '#dbeafe', color: '#1d4ed8', fontSize: 11, fontWeight: 600 }}>{pv.nombre}</span> : null
                      })()}
                    </div>
                  </div>
                  <button
                    onClick={() => { setDetalle(null); setDetLoading(false) }}
                    style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 18, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  >×</button>
                </div>

                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

                  {/* KPIs */}
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1, background: '#eff6ff', borderRadius: 10, padding: '14px 18px' }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color: '#0047BA' }}>{detalle.total_vendido}</div>
                      <div style={{ fontSize: 12, color: '#3b82f6', marginTop: 2 }}>Unidades vendidas</div>
                    </div>
                    <div style={{ flex: 1, background: '#f0fdf4', borderRadius: 10, padding: '14px 18px' }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color: '#16a34a' }}>{detalle.en_registros}</div>
                      <div style={{ fontSize: 12, color: '#22c55e', marginTop: 2 }}>Registros donde aparece</div>
                    </div>
                    <div style={{ flex: 1, background: '#fdf4ff', borderRadius: 10, padding: '14px 18px' }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color: '#9333ea' }}>{detalle.componentes.length}</div>
                      <div style={{ fontSize: 12, color: '#a855f7', marginTop: 2 }}>Ingredientes</div>
                    </div>
                  </div>

                  {/* Por turno */}
                  {detalle.por_turno.length > 0 && (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8 }}>Ventas por turno</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {detalle.por_turno.map(t => {
                          const st = TURNO_COLOR[t.turno] ?? { color: '#374151', bg: '#f3f4f6' }
                          return (
                            <div key={t.turno} style={{ padding: '8px 16px', borderRadius: 10, background: st.bg, display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: st.color }}>{t.turno}</span>
                              <span style={{ fontSize: 15, fontWeight: 800, color: st.color }}>{t.unidades}</span>
                              <span style={{ fontSize: 11, color: st.color, opacity: 0.7 }}>uds</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Por día */}
                  {detalle.por_dia.length > 0 && (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8 }}>Ventas diarias</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 200, overflowY: 'auto' }}>
                        {detalle.por_dia.map(d => {
                          const barW = Math.round((d.unidades / maxDia) * 100)
                          return (
                            <div key={d.fecha} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 12, color: '#64748b', minWidth: 66, whiteSpace: 'nowrap' }}>{fmtFechaCort(d.fecha)}</span>
                              <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${barW}%`, background: '#0047BA', borderRadius: 4 }} />
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', minWidth: 28, textAlign: 'right' }}>{d.unidades}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Ingredientes consumidos */}
                  {detalle.componentes.length > 0 && (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8 }}>
                        Ingredientes consumidos
                        <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8', marginLeft: 6 }}>basado en {detalle.total_vendido} unidades vendidas</span>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            {['Ingrediente', 'Por unidad', 'Total consumido', 'Unidad'].map(h => (
                              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {detalle.componentes.map((c, i) => (
                            <tr key={c.componente_nombre} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 12px', color: '#1e293b', fontWeight: 500 }}>{c.componente_nombre}</td>
                              <td style={{ padding: '8px 12px', color: '#64748b' }}>{c.por_unidad}</td>
                              <td style={{ padding: '8px 12px', fontWeight: 700, color: '#7c3aed' }}>{fmtNum(Number(c.total_consumido), c.unidad)}</td>
                              <td style={{ padding: '8px 12px', color: '#64748b' }}>{c.unidad}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const lbl: React.CSSProperties        = { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }
const inp: React.CSSProperties        = { padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, color: '#1e293b', outline: 'none' }
const btnPrimary: React.CSSProperties = { padding: '9px 20px', borderRadius: 8, border: 'none', background: '#0047BA', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }
