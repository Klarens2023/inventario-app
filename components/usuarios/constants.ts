import React from 'react'

export const ROL_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  admin:   { label: 'Admin',   color: '#1d4ed8', bg: '#dbeafe' },
  lider:   { label: 'Líder',   color: '#7c3aed', bg: '#ede9fe' },
  usuario: { label: 'Usuario', color: '#374151', bg: '#f3f4f6' },
  pvn:     { label: 'PVN',     color: '#065f46', bg: '#d1fae5' },
  pvv:     { label: 'PVV',     color: '#9a3412', bg: '#ffedd5' },
}

export const AREA_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  logistica:    { label: 'Logística',       color: '#065f46', bg: '#d1fae5' },
  sistemas:     { label: 'Sistemas',        color: '#1e3a5f', bg: '#dbeafe' },
  general:      { label: 'Administración',  color: '#7c2d12', bg: '#fed7aa' },
  puntos_venta: { label: 'Puntos de Venta', color: '#6b21a8', bg: '#f3e8ff' },
}

export const ROLES_POR_AREA: Record<string, string[]> = {
  logistica:    ['usuario', 'lider'],
  puntos_venta: ['pvn', 'pvv'],
  sistemas:     ['usuario', 'lider'],
  general:      ['admin', 'lider'],
}

export const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6,
}
export const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
  fontSize: 14, color: '#1e293b', background: '#fff', outline: 'none', boxSizing: 'border-box',
}
export const btnPrimary: React.CSSProperties = {
  padding: '10px 22px', borderRadius: 8, border: 'none',
  background: '#0047BA', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
}
export const btnSecondary: React.CSSProperties = {
  padding: '10px 22px', borderRadius: 8, border: '1px solid #e2e8f0',
  background: '#f8fafc', color: '#475569', fontWeight: 600, fontSize: 14, cursor: 'pointer',
}
