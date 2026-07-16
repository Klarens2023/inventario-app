import type { CSSProperties } from 'react'

export const ACCIONES: Record<string, { label: string; color: string; bg: string }> = {
  CARGA_INVENTARIO:    { label: 'Carga Inventario',    color: '#1d4ed8', bg: '#dbeafe' },
  CONTEO_ACTUALIZADO:  { label: 'Conteo Actualizado',  color: '#065f46', bg: '#d1fae5' },
  CONTEO_ACUMULADO:    { label: 'Conteo Acumulado',    color: '#6d28d9', bg: '#ede9fe' },
  HISTORIAL_REINICIADO:{ label: 'Historial Reiniciado',color: '#991b1b', bg: '#fee2e2' },
  USUARIO_CREADO:      { label: 'Usuario Creado',      color: '#0369a1', bg: '#e0f2fe' },
  USUARIO_MODIFICADO:  { label: 'Usuario Modificado',  color: '#92400e', bg: '#fef3c7' },
}

export const labelStyle: CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6
}

export const inputStyle: CSSProperties = {
  padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
  fontSize: 14, color: '#1e293b', background: '#fff', outline: 'none', minWidth: 160
}

export const btnStyle: CSSProperties = {
  padding: '9px 24px', borderRadius: 8, border: 'none',
  background: '#0047BA', color: '#fff', fontWeight: 700,
  fontSize: 14, cursor: 'pointer'
}
