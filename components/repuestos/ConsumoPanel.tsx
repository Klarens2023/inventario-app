'use client'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import type { FiltrosConsumo, ReporteConsumo } from '@/types/repuestos'
import { fetchConsumo } from '@/lib/api/repuestos'
import { exportarConsumo } from '@/lib/repuestos-excel'
import { inp, btnPrimary, btnSec } from '@/components/movimientos/styles'
import { CATEGORIAS, CATEGORIA_COLOR } from './constants'
import { Chip, fmtPesos } from './shared'
import { imprimirInformeConsumo } from './imprimir'

function haceMeses(n: number) {
  const d = new Date()
  d.setMonth(d.getMonth() - n, 1)
  return d.toLocaleDateString('en-CA')
}

const th = { padding: '10px 12px', textAlign: 'left' as const, color: '#475569', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const }
const td = { padding: '9px 12px', borderTop: '1px solid #f1f5f9', fontSize: 13, color: '#334155' }
const num = { ...td, textAlign: 'right' as const, whiteSpace: 'nowrap' as const }

function Tabla({ titulo, cols, children, vacio }: { titulo: string; cols: string[]; children: ReactNode; vacio: boolean }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '12px 14px', fontSize: 12, fontWeight: 700, color: '#0047BA', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>{titulo}</div>
      {vacio ? (
        <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Sin datos en el periodo</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: '#f8fafc' }}>{cols.map((c, i) => <th key={i} style={th}>{c}</th>)}</tr></thead>
            <tbody>{children}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Kpi({ titulo, valor, color }: { titulo: string; valor: string | number; color: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', flex: '1 1 160px', border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{titulo}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, marginTop: 4 }}>{valor}</div>
    </div>
  )
}

export function ConsumoPanel() {
  const { data: session } = useSession()
  const [f, setF] = useState<FiltrosConsumo>({
    desde: haceMeses(11), hasta: new Date().toLocaleDateString('en-CA'), categoria: '', equipo_id: '', area: '',
  })
  const [r, setR] = useState<ReporteConsumo | null>(null)
  const [cargando, setCargando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true); setError('')
    try {
      const res = await fetchConsumo(f)
      if ('error' in res) { setError(res.error); setR(null) } else setR(res)
    } finally {
      setCargando(false)
    }
  }, [f])

  useEffect(() => {
    const t = setTimeout(cargar, 300)
    return () => clearTimeout(t)
  }, [cargar])

  async function exportar() {
    setExportando(true)
    try {
      const res = await fetchConsumo(f, true)
      if ('error' in res) { setError(res.error); return }
      await exportarConsumo(res, f)
    } finally {
      setExportando(false)
    }
  }

  const set = (cambios: Partial<FiltrosConsumo>) => setF(prev => ({ ...prev, ...cambios }))
  const total = r?.resumen.gasto ?? 0

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <label style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>Desde</label>
        <input type="date" value={f.desde} onChange={e => set({ desde: e.target.value })} style={{ ...inp, maxWidth: 150 }} />
        <label style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>Hasta</label>
        <input type="date" value={f.hasta} onChange={e => set({ hasta: e.target.value })} style={{ ...inp, maxWidth: 150 }} />
        <select value={f.categoria} onChange={e => set({ categoria: e.target.value })} style={{ ...inp, maxWidth: 170 }}>
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={f.area} onChange={e => set({ area: e.target.value })} style={{ ...inp, maxWidth: 190 }}>
          <option value="">Todas las áreas</option>
          {(r?.por_area ?? []).map(a => <option key={a.area}>{a.area}</option>)}
          {f.area && !r?.por_area.some(a => a.area === f.area) && <option>{f.area}</option>}
        </select>
        <input value={f.equipo_id} onChange={e => set({ equipo_id: e.target.value.toUpperCase().trim() })}
          placeholder="Equipo (KL-0001)" style={{ ...inp, maxWidth: 150 }} />
        {(f.equipo_id || f.area || f.categoria) && (
          <button onClick={() => set({ equipo_id: '', area: '', categoria: '' })} style={{ ...btnSec, fontSize: 12, padding: '6px 10px' }}>Quitar filtros</button>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={() => r && imprimirInformeConsumo(r, f, session?.user?.name ?? '')} disabled={!r} style={{ ...btnSec, opacity: r ? 1 : 0.5 }}>🖨️ Imprimir informe</button>
        <button onClick={exportar} disabled={exportando || !r} style={{ ...btnPrimary, opacity: exportando || !r ? 0.6 : 1 }}>
          {exportando ? 'Generando...' : '⬇ Exportar a Excel'}
        </button>
      </div>

      {error && <div style={{ padding: '9px 12px', borderRadius: 8, background: '#fee2e2', color: '#991b1b', fontSize: 13, marginBottom: 14 }}>{error}</div>}
      {cargando && !r && <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Calculando...</div>}

      {r && (
        <div style={{ opacity: cargando ? 0.6 : 1 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <Kpi titulo="Gasto neto" valor={fmtPesos(r.resumen.gasto)} color="#065f46" />
            <Kpi titulo="Unidades" valor={r.resumen.unidades} color="#0047BA" />
            <Kpi titulo="Salidas registradas" valor={r.resumen.salidas} color="#0047BA" />
            <Kpi titulo="Equipos con consumo" valor={r.resumen.equipos} color="#5b21b6" />
          </div>
          {r.resumen.sin_costo > 0 && (
            <div style={{ padding: '9px 12px', borderRadius: 8, background: '#fef3c7', color: '#92400e', fontSize: 13, marginBottom: 14 }}>
              ⚠ {r.resumen.sin_costo} salida(s) del periodo no tienen costo (el artículo no tenía costo unitario al salir). El gasto real puede ser mayor.
            </div>
          )}
          <p style={{ margin: '0 0 14px', fontSize: 12, color: '#64748b' }}>
            Gasto = unidades que salieron × costo del artículo en ese momento, menos lo que regresó al inventario por devoluciones o reemplazos.
          </p>

          <Tabla titulo="Gasto por equipo" vacio={r.por_equipo.length === 0}
            cols={['Equipo', 'Tipo / Marca / Modelo', 'Área', 'Usuario', 'Artículos', 'Salidas', 'Unidades', 'Gasto', '% del total', 'Último']}>
            {r.por_equipo.map(e => (
              <tr key={e.equipo_id ?? 'sin'}>
                <td style={td}>
                  {e.equipo_id ? (
                    <button onClick={() => set({ equipo_id: e.equipo_id! })} title="Ver solo este equipo"
                      style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: '#0047BA', fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}>
                      {e.equipo_id}
                    </button>
                  ) : <span style={{ color: '#94a3b8' }}>Sin equipo</span>}
                </td>
                <td style={td}>{[e.tipo_equipo, e.marca, e.modelo].filter(Boolean).join(' ') || '—'}</td>
                <td style={td}>{e.area}</td>
                <td style={td}>{e.usuario_asignado ?? '—'}</td>
                <td style={{ ...td, fontSize: 12, maxWidth: 220 }}>{e.tipos}</td>
                <td style={num}>{e.salidas}</td>
                <td style={num}>{e.unidades}</td>
                <td style={{ ...num, fontWeight: 700 }}>{fmtPesos(e.gasto)}</td>
                <td style={num}>{total > 0 ? `${((e.gasto / total) * 100).toFixed(1)} %` : '—'}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{e.ultimo}</td>
              </tr>
            ))}
          </Tabla>

          {r.rendimiento.length > 0 && (
            <Tabla titulo="Rendimiento de tóner / tinta por impresora" vacio={false}
              cols={['Impresora', 'Insumo', 'Cambios medidos', 'Páginas por cambio', 'Días por cambio', 'Costo por página', 'Último contador']}>
              {r.rendimiento.map(x => (
                <tr key={`${x.equipo_id}-${x.articulo_codigo}`}>
                  <td style={td}>
                    <Link href={`/sistemas/equipos/${x.equipo_id}`} style={{ color: '#0047BA', fontWeight: 700, fontFamily: 'monospace' }}>{x.equipo_id}</Link>{' '}
                    <span style={{ fontSize: 12, color: '#64748b' }}>{[x.marca, x.modelo].filter(Boolean).join(' ')}</span>
                  </td>
                  <td style={td}>{x.descripcion}</td>
                  <td style={num}>{x.cambios}</td>
                  <td style={num}>{(x.paginas_promedio ?? 0).toLocaleString('es-CO')}</td>
                  <td style={num}>{x.dias_promedio ?? '—'}</td>
                  <td style={{ ...num, fontWeight: 700 }}>{x.costo_pagina != null ? `$${x.costo_pagina.toFixed(1)}` : '—'}</td>
                  <td style={num}>{(x.ultimo_contador ?? 0).toLocaleString('es-CO')}</td>
                </tr>
              ))}
            </Tabla>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16 }}>
            <Tabla titulo="Gasto por área" vacio={r.por_area.length === 0} cols={['Área', 'Equipos', 'Unidades', 'Gasto', '%']}>
              {r.por_area.map(a => (
                <tr key={a.area}>
                  <td style={td}>
                    <button onClick={() => set({ area: a.area })} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: '#0047BA', fontSize: 13 }}>{a.area}</button>
                  </td>
                  <td style={num}>{a.equipos}</td>
                  <td style={num}>{a.unidades}</td>
                  <td style={{ ...num, fontWeight: 700 }}>{fmtPesos(a.gasto)}</td>
                  <td style={num}>{total > 0 ? `${((a.gasto / total) * 100).toFixed(1)} %` : '—'}</td>
                </tr>
              ))}
            </Tabla>

            <Tabla titulo="Por mes (unidades netas)" vacio={r.por_mes.length === 0} cols={['Mes', 'Insumos', 'Repuestos', 'Periféricos', 'Gasto']}>
              {r.por_mes.map(m => (
                <tr key={m.mes}>
                  <td style={td}>{m.mes}</td>
                  <td style={num}>{m.insumos ?? 0}</td>
                  <td style={num}>{m.repuestos ?? 0}</td>
                  <td style={num}>{m.perifericos ?? 0}</td>
                  <td style={{ ...num, fontWeight: 700 }}>{fmtPesos(m.gasto)}</td>
                </tr>
              ))}
            </Tabla>
          </div>

          <Tabla titulo="Consumo por artículo" vacio={r.por_articulo.length === 0} cols={['Código', 'Artículo', 'Categoría', 'Equipos', 'Unidades', 'Gasto']}>
            {r.por_articulo.map(a => (
              <tr key={a.articulo_codigo}>
                <td style={{ ...td, fontFamily: 'monospace', color: '#0047BA', fontWeight: 700 }}>{a.articulo_codigo}</td>
                <td style={td}>{a.descripcion} <span style={{ fontSize: 11, color: '#94a3b8' }}>{a.tipo_articulo}</span></td>
                <td style={td}><Chip texto={a.categoria} {...CATEGORIA_COLOR[a.categoria]} /></td>
                <td style={num}>{a.equipos}</td>
                <td style={num}>{a.unidades}</td>
                <td style={{ ...num, fontWeight: 700 }}>{fmtPesos(a.gasto)}</td>
              </tr>
            ))}
          </Tabla>
        </div>
      )}
    </div>
  )
}
