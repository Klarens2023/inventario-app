'use client'
import type { Modo } from '@/types/acumulados'
import { modoStyle } from './constants'

type Props = {
  modo: Modo; onModoChange: (m: Modo) => void
  desde: string; onDesdeChange: (v: string) => void
  hasta: string; onHastaChange: (v: string) => void
  onBuscar: () => void; loading: boolean
  tipoFil: string; onTipoFilChange: (v: string) => void; tiposDisponibles: string[]
  bodegaSel: string; onBodegaChange: (v: string) => void; bodegasDisponibles: string[]
  hayRows: boolean; onExportar: () => void
}

export function FiltrosBar({
  modo, onModoChange, desde, onDesdeChange, hasta, onHastaChange,
  onBuscar, loading, tipoFil, onTipoFilChange, tiposDisponibles,
  bodegaSel, onBodegaChange, bodegasDisponibles, hayRows, onExportar,
}: Props) {
  return (
    <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
      <div>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase' }}>Tipo</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={() => onModoChange('items')} style={modoStyle('items', modo)}>📦 Items</button>
          <button type="button" onClick={() => onModoChange('lotes')} style={modoStyle('lotes', modo)}>🏷️ Lotes</button>
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase' }}>Desde</label>
        <input type="date" value={desde} onChange={e => onDesdeChange(e.target.value)}
          style={{ padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase' }}>Hasta</label>
        <input type="date" value={hasta} onChange={e => onHastaChange(e.target.value)}
          style={{ padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }} />
      </div>
      <button onClick={onBuscar} className="btn btn-primary" disabled={loading} style={{ alignSelf: 'flex-end' }}>
        {loading ? 'Buscando...' : 'Buscar'}
      </button>

      {tiposDisponibles.length > 1 && (
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase' }}>Subcategoria</label>
          <select value={tipoFil} onChange={e => onTipoFilChange(e.target.value)}
            style={{ padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }}>
            <option value="todos">Todos</option>
            {tiposDisponibles.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      )}

      {bodegasDisponibles.length > 0 && (
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase' }}>Bodega</label>
          <select value={bodegaSel} onChange={e => onBodegaChange(e.target.value)}
            style={{ padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }}>
            <option value="todas">Todas</option>
            {bodegasDisponibles.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      )}

      {hayRows && (
        <button onClick={onExportar} className="btn" style={{ fontSize: 12, alignSelf: 'flex-end' }}>
          Exportar Excel
        </button>
      )}
    </div>
  )
}
