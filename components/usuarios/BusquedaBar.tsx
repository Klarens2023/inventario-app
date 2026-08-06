'use client'
import type { CSSProperties } from 'react'
import { ROL_LABELS } from './constants'

type Props = {
  busqueda: string
  onBusquedaChange: (v: string) => void
  filtroRol: string
  onFiltroRolChange: (v: string) => void
  filtroEstado: string
  onFiltroEstadoChange: (v: string) => void
}

const selectStyle: CSSProperties = {
  padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
  fontSize: 13, color: '#334155', background: '#fff', outline: 'none', cursor: 'pointer',
}

export function BusquedaBar({ busqueda, onBusquedaChange, filtroRol, onFiltroRolChange, filtroEstado, onFiltroEstadoChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
      <input
        value={busqueda}
        onChange={e => onBusquedaChange(e.target.value)}
        placeholder="Buscar por nombre o usuario..."
        style={{ flex: '1 1 240px', padding: '9px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, color: '#1e293b', background: '#fff', outline: 'none' }}
      />
      <select value={filtroRol} onChange={e => onFiltroRolChange(e.target.value)} style={selectStyle}>
        <option value="todos">Todos los roles</option>
        {Object.entries(ROL_LABELS).map(([key, info]) => (
          <option key={key} value={key}>{info.label}</option>
        ))}
      </select>
      <select value={filtroEstado} onChange={e => onFiltroEstadoChange(e.target.value)} style={selectStyle}>
        <option value="todos">Activos e inactivos</option>
        <option value="activo">Solo activos</option>
        <option value="inactivo">Solo inactivos</option>
      </select>
    </div>
  )
}
