'use client'
import { useState, Fragment } from 'react'
import type { ResultadoComparacion } from '@/types/conciliacion-facturas'
import { ESTADO_INFO, NIVEL_LABELS, fmtMoneda } from '@/lib/conciliacion-facturas/constants'

type Props = {
  resultados: ResultadoComparacion[]
  loading: boolean
}

export function TablaResultados({ resultados, loading }: Props) {
  const [expandido, setExpandido] = useState<number | null>(null)

  if (loading) {
    return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Comparando...</div>
  }
  if (resultados.length === 0) {
    return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>No hay resultados para este filtro.</div>
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table className="inv-table">
          <thead>
            <tr>
              {['NIT', 'Razón Social', 'Factura Invoicing', 'Factura ERP', 'Estado', 'Nivel', 'Valor', ''].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resultados.map(r => {
              const info = ESTADO_INFO[r.estado]
              const abierto = expandido === r.id
              return (
                <Fragment key={r.id}>
                  <tr>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.nit}</td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.razonSocial}>{r.razonSocial}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.facturaInvoicingOriginal}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: r.facturaErpOriginal ? 'inherit' : 'var(--text2)' }}>{r.facturaErpOriginal || '—'}</td>
                    <td>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: info.color, background: info.bg, whiteSpace: 'nowrap' }}>{info.label}</span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{NIVEL_LABELS[r.nivel]}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtMoneda(r.valorInvoicing)}</td>
                    <td>
                      <button onClick={() => setExpandido(abierto ? null : r.id)} style={{ border: 'none', background: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        {abierto ? 'Ocultar' : 'Ver detalle'}
                      </button>
                    </td>
                  </tr>
                  {abierto && (
                    <tr>
                      <td colSpan={8} style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text)', lineHeight: 1.6, background: 'var(--bg)' }}>
                        <div style={{ marginBottom: 8 }}><strong>Explicación:</strong> {r.observacion}</div>
                        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12, color: 'var(--text2)' }}>
                          <div><strong>Valor Invoicing:</strong> {fmtMoneda(r.valorInvoicing)}</div>
                          <div><strong>Valor ERP:</strong> {fmtMoneda(r.montoErp)}</div>
                          <div><strong>¿Monto coincide?:</strong> {r.montoCoincide ? 'Sí' : 'No'}</div>
                          <div><strong>Documento interno ERP:</strong> {r.doctoInternoErp ?? '—'}</div>
                          <div><strong>¿Documento duplicado?:</strong> {r.duplicadoEnErp ? 'Sí — usado en más de un resultado' : 'No'}</div>
                        </div>
                        {r.candidatosAlternos.length > 0 && (
                          <div style={{ marginTop: 10 }}>
                            <strong>Otros documentos ERP posibles del mismo NIT ({r.candidatosAlternos.length}):</strong>
                            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                              {r.candidatosAlternos.map((c, i) => (
                                <li key={i} style={{ fontSize: 12, color: 'var(--text2)' }}>
                                  {c.doctoInterno} ({c.tipoDocto}) — Docto. proveedor: {c.doctoProveedorOriginal || '—'} — {c.fecha ?? 'sin fecha'}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
