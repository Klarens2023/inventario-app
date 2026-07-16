import type { Producto } from '@/types/pvn-registrar'
import { categoria, limpiarNombre } from './utils'
import { CAT_COLORS, btnCount } from './constants'

type Props = {
  productos: Producto[]
  cantidades: Record<number, number>
  onSetQty: (id: number, v: number) => void
}

export function ProductosGrupos({ productos, cantidades, onSetQty }: Props) {
  const grupos: Record<string, Producto[]> = {}
  productos.forEach(p => {
    const cat = categoria(p.nombre)
    if (!grupos[cat]) grupos[cat] = []
    grupos[cat].push(p)
  })

  return (
    <>
      {Object.entries(grupos).map(([cat, prods]) => {
        const colors = CAT_COLORS[cat] ?? CAT_COLORS['Otros']
        return (
          <div key={cat} style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: 16, border: `1px solid ${colors.border}` }}>
            <div style={{ background: colors.header, padding: '10px 20px', borderBottom: `1px solid ${colors.border}` }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: colors.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat}</span>
            </div>
            {prods.map(p => {
              const qty = cantidades[p.id] ?? 0
              return (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 20px', borderBottom: '1px solid #f8fafc',
                  background: qty > 0 ? '#f0fdf4' : 'transparent', transition: 'background 0.15s'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: qty > 0 ? 600 : 400, color: '#1e293b' }}>
                      {limpiarNombre(p.nombre)}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                      {p.componentes?.length ?? 0} ingredientes
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => onSetQty(p.id, qty - 1)} style={btnCount}>−</button>
                    <input
                      type="number" min={0} value={qty}
                      onChange={e => onSetQty(p.id, parseInt(e.target.value) || 0)}
                      style={{ width: 54, textAlign: 'center', padding: '6px 4px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 15, fontWeight: 700, color: '#0f172a', outline: 'none' }}
                    />
                    <button onClick={() => onSetQty(p.id, qty + 1)} style={{ ...btnCount, background: '#0047BA', color: '#fff', border: '1px solid #0047BA' }}>+</button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </>
  )
}
