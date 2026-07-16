'use client'
import type { Ingrediente } from '@/types/pvn-analisis'
import { fmtNum } from './utils'

export function ConsumoIngredientes({ ingredientes }: { ingredientes: Ingrediente[] }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
        Consumo de Ingredientes
        <span style={{ fontSize: 12, fontWeight: 400, color: '#64748b', marginLeft: 8 }}>calculado según ventas registradas</span>
      </div>
      {ingredientes.length === 0 && (
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
            {ingredientes.map((ing, i) => (
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
  )
}
