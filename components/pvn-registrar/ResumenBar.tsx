type Props = {
  totalUnidades: number
  totalProductos: number
}

export function ResumenBar({ totalUnidades, totalProductos }: Props) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <span style={{ fontSize: 13, color: '#64748b' }}>Total ingresado: </span>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{totalUnidades} unidades</span>
        <span style={{ fontSize: 13, color: '#94a3b8', marginLeft: 8 }}>
          ({totalProductos} productos)
        </span>
      </div>
    </div>
  )
}
