'use client'
import type { EstadoFactura } from '@/types/conciliacion-facturas'
import { selectStyle, inputStyle } from '@/lib/conciliacion-facturas/constants'

type Props = {
  filtroEstado: EstadoFactura | 'todos'
  onFiltroEstadoChange: (v: EstadoFactura | 'todos') => void
  busqueda: string
  onBusquedaChange: (v: string) => void
  onExportar: () => void
  totalFiltrado: number
}

export function FiltrosBar({ filtroEstado, onFiltroEstadoChange, busqueda, onBusquedaChange, onExportar, totalFiltrado }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <input
        value={busqueda}
        onChange={e => onBusquedaChange(e.target.value)}
        placeholder="Buscar por NIT, razón social o factura..."
        style={{ ...inputStyle, flex: '1 1 260px' }}
      />
      <select value={filtroEstado} onChange={e => onFiltroEstadoChange(e.target.value as EstadoFactura | 'todos')} style={selectStyle}>
        <option value="todos">Todos los estados</option>
        <option value="CAUSADA">Causada</option>
        <option value="NO_CAUSADA">No causada</option>
        <option value="REQUIERE_REVISION">Requiere revisión</option>
      </select>
      <span style={{ fontSize: 12, color: 'var(--text2)' }}>{totalFiltrado} resultado(s)</span>
      <div style={{ flex: 1 }} />
      <button className="btn btn-primary" onClick={onExportar}>📥 Exportar Excel</button>
    </div>
  )
}
