import type { Producto } from '@/types/pvn-catalogo'
import { limpiar } from './utils'
import { btnPrimary, btnEdit } from './constants'

type Props = {
  productos: Producto[]
  loading: boolean
  onNuevo: () => void
  onEditar: (p: Producto) => void
  onToggleActivo: (p: Producto) => void
}

export function ProductosTable({ productos, loading, onNuevo, onEditar, onToggleActivo }: Props) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={onNuevo} style={btnPrimary}>+ Nuevo Producto</button>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
        {loading && <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Cargando...</div>}
        {!loading && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['ID', 'Producto', 'Ingredientes', 'Estado', 'Acciones'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {productos.map((p, i) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa', opacity: p.activo ? 1 : 0.5 }}>
                  <td style={{ padding: '10px 16px', color: '#94a3b8', fontSize: 12 }}>{p.id}</td>
                  <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1e293b' }}>{limpiar(p.nombre)}</td>
                  <td style={{ padding: '10px 16px', color: '#64748b' }}>{p.componentes?.length ?? 0} ingredientes</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      color: p.activo ? '#065f46' : '#991b1b', background: p.activo ? '#d1fae5' : '#fee2e2' }}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => onEditar(p)} style={btnEdit}>Editar</button>
                      <button onClick={() => onToggleActivo(p)} style={{ ...btnEdit, color: p.activo ? '#dc2626' : '#16a34a', borderColor: p.activo ? '#fca5a5' : '#bbf7d0' }}>
                        {p.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
