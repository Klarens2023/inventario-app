'use client'
import type { Usuario } from '@/types/auditoria'
import { labelStyle, inputStyle, btnStyle } from './constants'

type Props = {
  desde: string; onDesdeChange: (v: string) => void
  hasta: string; onHastaChange: (v: string) => void
  accion: string; onAccionChange: (v: string) => void
  usuarioId: string; onUsuarioIdChange: (v: string) => void
  usuarios: Usuario[]
  loading: boolean
  onBuscar: () => void
}

export function FiltrosBar({
  desde, onDesdeChange, hasta, onHastaChange,
  accion, onAccionChange, usuarioId, onUsuarioIdChange,
  usuarios, loading, onBuscar,
}: Props) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '20px 24px', marginBottom: 20,
      boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end'
    }}>
      <div>
        <label style={labelStyle}>Desde</label>
        <input type="date" value={desde} onChange={e => onDesdeChange(e.target.value)} style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Hasta</label>
        <input type="date" value={hasta} onChange={e => onHastaChange(e.target.value)} style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Accion</label>
        <select value={accion} onChange={e => onAccionChange(e.target.value)} style={inputStyle}>
          <option value="todas">Todas</option>
          <option value="CARGA_INVENTARIO">Carga Inventario</option>
          <option value="CONTEO_ACTUALIZADO">Conteo Actualizado</option>
          <option value="CONTEO_ACUMULADO">Conteo Acumulado</option>
          <option value="HISTORIAL_REINICIADO">Historial Reiniciado</option>
          <option value="USUARIO_CREADO">Usuario Creado</option>
          <option value="USUARIO_MODIFICADO">Usuario Modificado</option>
        </select>
      </div>
      <div>
        <label style={labelStyle}>Usuario</label>
        <select value={usuarioId} onChange={e => onUsuarioIdChange(e.target.value)} style={inputStyle}>
          <option value="">Todos</option>
          {usuarios.map(u => (
            <option key={u.id} value={String(u.id)}>{u.nombre} ({u.username})</option>
          ))}
        </select>
      </div>
      <button onClick={onBuscar} style={btnStyle}>
        {loading ? 'Buscando...' : 'Buscar'}
      </button>
    </div>
  )
}
