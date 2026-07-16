'use client'
import type { Producto } from '@/types/pvn-analisis'
import { limpiar } from './utils'

export function RankingProductos({ productos, onSeleccionar }: { productos: Producto[]; onSeleccionar: (p: Producto) => void }) {
  const totalVendido = productos.reduce((s, p) => s + Number(p.total_vendido), 0)
  const maxVendido   = Math.max(...(productos.map(p => Number(p.total_vendido)) ?? [1]), 1)

  return (
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
        Ventas por Producto
        <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8', marginLeft: 8 }}>clic para ver detalle</span>
      </div>
      {productos.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Sin datos</div>
      )}
      {productos.map((p, i) => {
        const pct  = totalVendido > 0 ? Math.round((Number(p.total_vendido) / totalVendido) * 100) : 0
        const barW = Math.round((Number(p.total_vendido) / maxVendido) * 100)
        return (
          <div
            key={p.producto_id}
            onClick={() => onSeleccionar(p)}
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
  )
}
