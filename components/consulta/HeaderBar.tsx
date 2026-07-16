'use client'
import type { Modo } from '@/types/consulta'
import { selStyle, btnGreenStyle, modoBtnStyle } from './constants'

type Props = {
  modo: Modo; onModoChange: (m: Modo) => void
  fecha: string; onFechaChange: (f: string) => void; fechas: string[]
  tipoSel: string; onTipoChange: (t: string) => void; tiposDisponibles: string[]
  bodegaSel: string; onBodegaChange: (b: string) => void; bodegasDisponibles: string[]
  esLotes: boolean; loteSel: string; onLoteChange: (l: string) => void; lotesDisponibles: string[]
  rowsLength: number; todoAcumulado: boolean
  acumulando: boolean; hayPendientes: boolean
  onExportar: () => void; onAcumular: () => void
}

export function HeaderBar({
  modo, onModoChange, fecha, onFechaChange, fechas,
  tipoSel, onTipoChange, tiposDisponibles,
  bodegaSel, onBodegaChange, bodegasDisponibles,
  esLotes, loteSel, onLoteChange, lotesDisponibles,
  rowsLength, todoAcumulado, acumulando, hayPendientes,
  onExportar, onAcumular,
}: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, flexShrink: 0 }}>
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Conteo Fisico</h1>
        {todoAcumulado ? (
          <p style={{ fontSize: 12, margin: '2px 0 0', color: '#dc2626', fontWeight: 600 }}>🔒 Todos los registros del filtro ya fueron acumulados.</p>
        ) : (
          <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>Los cambios se guardan automaticamente.</p>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => onModoChange('items')} style={modoBtnStyle('items', modo)}>📦 Items</button>
          <button onClick={() => onModoChange('lotes')} style={modoBtnStyle('lotes', modo)}>🏷️ Lotes</button>
        </div>
        <select value={fecha} onChange={e => onFechaChange(e.target.value)} style={selStyle}>
          {fechas.length === 0 && <option value="">Sin datos</option>}
          {fechas.map(f => <option key={f} value={f}>{new Date(f + 'T12:00:00').toLocaleDateString('es-CO')}</option>)}
        </select>
        <select value={tipoSel} onChange={e => onTipoChange(e.target.value)} style={selStyle}>
          <option value="todos">Todos los tipos</option>
          {tiposDisponibles.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={bodegaSel} onChange={e => onBodegaChange(e.target.value)} style={selStyle}>
          <option value="todas">Todas las bodegas</option>
          {bodegasDisponibles.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        {esLotes && (
          <select value={loteSel} onChange={e => onLoteChange(e.target.value)} style={{ ...selStyle, maxWidth: 160 }}>
            <option value="todos">Todos los lotes</option>
            {lotesDisponibles.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
        <button onClick={onExportar} disabled={rowsLength === 0} style={{ ...selStyle, background: '#f3f4f6', fontWeight: 600 }}>
          Exportar Excel
        </button>
        {!todoAcumulado && (
          <button onClick={onAcumular} disabled={acumulando || rowsLength === 0 || hayPendientes} style={btnGreenStyle(hayPendientes)}>
            {acumulando ? 'Acumulando...' : hayPendientes ? 'Guardando...' : 'Acumular todo'}
          </button>
        )}
      </div>
    </div>
  )
}
