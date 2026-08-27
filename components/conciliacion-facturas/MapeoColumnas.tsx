'use client'
import { useState } from 'react'
import type { MapeoInvoicing, MapeoErp } from '@/types/conciliacion-facturas'
import { selectStyle, labelStyle } from '@/lib/conciliacion-facturas/constants'

type Props = {
  encabezadosInvoicing: string[]
  encabezadosErp: string[]
  mapeoInvoicing: MapeoInvoicing
  mapeoErp: MapeoErp
  onCambiarMapeoInvoicing: (m: MapeoInvoicing) => void
  onCambiarMapeoErp: (m: MapeoErp) => void
  onProcesar: () => void
  procesando: boolean
}

const CAMPOS_INVOICING: Array<{ key: keyof MapeoInvoicing; label: string; requerido: boolean }> = [
  { key: 'nit', label: 'NIT del proveedor', requerido: true },
  { key: 'razonSocial', label: 'Razón social / Emisor', requerido: true },
  { key: 'factura', label: 'Factura (prefijo + número)', requerido: true },
  { key: 'valor', label: 'Valor', requerido: false },
  { key: 'estadoDocto', label: 'Estado del documento', requerido: false },
  { key: 'fecha', label: 'Fecha', requerido: false },
]

const CAMPOS_ERP: Array<{ key: keyof MapeoErp; label: string; requerido: boolean }> = [
  { key: 'nit', label: 'NIT tercero', requerido: true },
  { key: 'razonSocial', label: 'Razón social tercero', requerido: true },
  { key: 'tipoDocto', label: 'Tipo de documento', requerido: true },
  { key: 'doctoInterno', label: 'Documento (consecutivo interno)', requerido: true },
  { key: 'doctoProveedor', label: 'Documento del proveedor', requerido: true },
  { key: 'debitos', label: 'Débitos', requerido: false },
  { key: 'creditos', label: 'Créditos', requerido: false },
  { key: 'notas', label: 'Notas', requerido: false },
  { key: 'fecha', label: 'Fecha', requerido: false },
  { key: 'fechaProveedor', label: 'Fecha del proveedor', requerido: false },
]

export function MapeoColumnas({
  encabezadosInvoicing, encabezadosErp, mapeoInvoicing, mapeoErp,
  onCambiarMapeoInvoicing, onCambiarMapeoErp, onProcesar, procesando,
}: Props) {
  const [abierto, setAbierto] = useState(false)

  const faltantesInvoicing = CAMPOS_INVOICING.filter(c => c.requerido && !mapeoInvoicing[c.key])
  const faltantesErp = CAMPOS_ERP.filter(c => c.requerido && !mapeoErp[c.key])
  const hayFaltantes = faltantesInvoicing.length > 0 || faltantesErp.length > 0

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setAbierto(v => !v)}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>3. Columnas detectadas</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
            {hayFaltantes ? '⚠️ Revisa las columnas resaltadas antes de procesar' : 'Se detectaron automáticamente — puedes ajustarlas si algo no calza'}
          </div>
        </div>
        <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>{abierto ? 'Ocultar ▲' : 'Ver / editar ▼'}</span>
      </div>

      {abierto && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>Siesa Invoicing</div>
            {CAMPOS_INVOICING.map(campo => (
              <div key={campo.key} style={{ marginBottom: 10 }}>
                <label style={labelStyle}>{campo.label}{campo.requerido && ' *'}</label>
                <select
                  value={mapeoInvoicing[campo.key]}
                  onChange={e => onCambiarMapeoInvoicing({ ...mapeoInvoicing, [campo.key]: e.target.value })}
                  style={{ ...selectStyle, width: '100%', borderColor: campo.requerido && !mapeoInvoicing[campo.key] ? 'var(--warn)' : 'var(--border)' }}
                >
                  <option value="">— No mapeada —</option>
                  {encabezadosInvoicing.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>Siesa ERP</div>
            {CAMPOS_ERP.map(campo => (
              <div key={campo.key} style={{ marginBottom: 10 }}>
                <label style={labelStyle}>{campo.label}{campo.requerido && ' *'}</label>
                <select
                  value={mapeoErp[campo.key]}
                  onChange={e => onCambiarMapeoErp({ ...mapeoErp, [campo.key]: e.target.value })}
                  style={{ ...selectStyle, width: '100%', borderColor: campo.requerido && !mapeoErp[campo.key] ? 'var(--warn)' : 'var(--border)' }}
                >
                  <option value="">— No mapeada —</option>
                  {encabezadosErp.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <button className="btn btn-primary" onClick={onProcesar} disabled={procesando || hayFaltantes} style={{ width: '100%' }}>
          {procesando ? 'Procesando...' : '⚙️ Procesar y comparar'}
        </button>
      </div>
    </div>
  )
}
