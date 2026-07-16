'use client'
import type { PuntoVenta, Usuario } from '@/types/pvn-pagos-admin'
import { lbl, inp, btnPrimary, btnSecondary } from './constants'

type Props = {
  puntos: PuntoVenta[]
  usuarios: Usuario[]
  pvFiltro: string
  onPvFiltroChange: (v: string) => void
  usuarioFiltro: string
  onUsuarioFiltroChange: (v: string) => void
  desde: string
  onDesdeChange: (v: string) => void
  hasta: string
  onHastaChange: (v: string) => void
  onFiltrar: () => void
  onExportar: () => void
  puedeExportar: boolean
}

export function FiltrosBar({
  puntos, usuarios, pvFiltro, onPvFiltroChange, usuarioFiltro, onUsuarioFiltroChange,
  desde, onDesdeChange, hasta, onHastaChange, onFiltrar, onExportar, puedeExportar,
}: Props) {
  const puntosNacionales = puntos.filter(p => p.tipo === 'nacional')
  const puntosPrincipales = puntos.filter(p => p.tipo === 'principal')

  return (
    <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>Pagos QR</h1>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>Comprobantes de pago QR subidos desde la app móvil</p>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        {puntos.length > 0 && (
          <div>
            <label style={lbl}>Punto de Venta</label>
            <select value={pvFiltro} onChange={e => onPvFiltroChange(e.target.value)} style={inp}>
              <option value="todos">Todos</option>
              {puntosNacionales.length > 0 && (
                <optgroup label="Nacionales (PVN)">
                  {puntosNacionales.map(pv => <option key={pv.id} value={String(pv.id)}>{pv.nombre}</option>)}
                </optgroup>
              )}
              {puntosPrincipales.length > 0 && (
                <optgroup label="Principales (PVV)">
                  {puntosPrincipales.map(pv => <option key={pv.id} value={String(pv.id)}>{pv.nombre}</option>)}
                </optgroup>
              )}
            </select>
          </div>
        )}
        {usuarios.length > 0 && (
          <div>
            <label style={lbl}>Usuario</label>
            <select value={usuarioFiltro} onChange={e => onUsuarioFiltroChange(e.target.value)} style={inp}>
              <option value="todos">Todos</option>
              {usuarios.map(u => <option key={u.id} value={String(u.id)}>{u.nombre}</option>)}
            </select>
          </div>
        )}
        <div><label style={lbl}>Desde</label><input type="date" value={desde} onChange={e => onDesdeChange(e.target.value)} style={inp} /></div>
        <div><label style={lbl}>Hasta</label><input type="date" value={hasta} onChange={e => onHastaChange(e.target.value)} style={inp} /></div>
        <button onClick={onFiltrar} style={btnPrimary}>Filtrar</button>
        <button onClick={onExportar} disabled={!puedeExportar} style={{ ...btnSecondary, opacity: puedeExportar ? 1 : 0.5, cursor: puedeExportar ? 'pointer' : 'not-allowed' }}>
          📥 Exportar Excel
        </button>
      </div>
    </div>
  )
}
