'use client'
import type { PuntoVenta } from '@/types/pvn-analisis'
import { lbl, inp, btnPrimary } from './constants'

type Props = {
  puntos: PuntoVenta[]
  pvFiltro: string
  onPvFiltroChange: (v: string) => void
  desde: string
  onDesdeChange: (v: string) => void
  hasta: string
  onHastaChange: (v: string) => void
  onFiltrar: () => void
}

export function FiltrosBar({ puntos, pvFiltro, onPvFiltroChange, desde, onDesdeChange, hasta, onHastaChange, onFiltrar }: Props) {
  return (
    <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>Análisis PVN</h1>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>Ventas y consumo de ingredientes por período</p>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        {puntos.length > 0 && (
          <div>
            <label style={lbl}>Punto de Venta</label>
            <select value={pvFiltro} onChange={e => onPvFiltroChange(e.target.value)} style={inp}>
              <option value="todos">Todos los puntos</option>
              {puntos.map(pv => <option key={pv.id} value={String(pv.id)}>{pv.nombre}</option>)}
            </select>
          </div>
        )}
        <div><label style={lbl}>Desde</label><input type="date" value={desde} onChange={e => onDesdeChange(e.target.value)} style={inp} /></div>
        <div><label style={lbl}>Hasta</label><input type="date" value={hasta} onChange={e => onHastaChange(e.target.value)} style={inp} /></div>
        <button onClick={onFiltrar} style={btnPrimary}>Filtrar</button>
      </div>
    </div>
  )
}
