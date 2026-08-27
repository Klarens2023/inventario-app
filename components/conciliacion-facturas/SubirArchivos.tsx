'use client'
import { useRef } from 'react'

type Props = {
  nombreInvoicing: string | null
  nombreErp: string | null
  onSeleccionarInvoicing: (file: File) => void
  onSeleccionarErp: (file: File) => void
  cargando: boolean
}

export function SubirArchivos({ nombreInvoicing, nombreErp, onSeleccionarInvoicing, onSeleccionarErp, cargando }: Props) {
  const refInvoicing = useRef<HTMLInputElement>(null)
  const refErp = useRef<HTMLInputElement>(null)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
      <div className="card">
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>1. Siesa Invoicing</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>Facturas recibidas de los proveedores (.xls o .xlsx)</div>
        <input ref={refInvoicing} type="file" accept=".xls,.xlsx" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onSeleccionarInvoicing(f) }} />
        <button className="btn" onClick={() => refInvoicing.current?.click()} disabled={cargando} style={{ width: '100%' }}>
          {nombreInvoicing ? `📄 ${nombreInvoicing}` : '📤 Seleccionar archivo'}
        </button>
      </div>

      <div className="card">
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>2. Siesa ERP (causación)</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>Documentos ya causados en el ERP (.xls o .xlsx)</div>
        <input ref={refErp} type="file" accept=".xls,.xlsx" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onSeleccionarErp(f) }} />
        <button className="btn" onClick={() => refErp.current?.click()} disabled={cargando} style={{ width: '100%' }}>
          {nombreErp ? `📄 ${nombreErp}` : '📤 Seleccionar archivo'}
        </button>
      </div>
    </div>
  )
}
