'use client'
import type { DetalleProd, PuntoVenta } from '@/types/pvn-analisis'
import { limpiar, fmtNum, fmtFechaCort, TURNO_COLOR } from './utils'

type Props = {
  detalle: DetalleProd | null
  loading: boolean
  desde: string
  hasta: string
  pvFiltro: string
  puntos: PuntoVenta[]
  onClose: () => void
}

export function DetalleProductoModal({ detalle, loading, desde, hasta, pvFiltro, puntos, onClose }: Props) {
  const maxDia = Math.max(...(detalle?.por_dia?.map(d => d.unidades) ?? [1]), 1)

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}
      >
        {loading && (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Cargando detalle...</div>
        )}

        {!loading && detalle && (
          <>
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
                onClick={onClose}
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
  )
}
