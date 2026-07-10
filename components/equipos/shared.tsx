'use client'
import React from 'react'
import { ESTADOS_COLOR } from './constants'

export function EstadoBadge({ estado }: { estado: string }) {
  const s = ESTADOS_COLOR[estado] ?? { color: '#374151', bg: '#f3f4f6' }
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: s.color, background: s.bg }}>
      {estado}
    </span>
  )
}

export function Seccion({ titulo, color, children }: { titulo: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 20, overflow: 'hidden' }}>
      <div style={{ background: color, padding: '12px 20px' }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>{titulo}</h2>
      </div>
      <div style={{ padding: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
      </div>
    </div>
  )
}

export function Campo({
  label, value, onChange, placeholder, type = 'text', disabled, required, children
}: {
  label: string; value?: string; onChange?: (v: string) => void; placeholder?: string
  type?: string; disabled?: boolean; required?: boolean; children?: React.ReactNode
}) {
  return (
    <div>
      <label style={labelStyle}>{label}{required && <span style={{ color: '#ef4444' }}> *</span>}</label>
      {children ?? (
        <input type={type} value={value ?? ''} onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder} disabled={disabled}
          style={{ ...inputStyle, background: disabled ? '#f1f5f9' : '#fff', color: disabled ? '#94a3b8' : 'var(--text)' }} />
      )}
    </div>
  )
}

export function CardDetalle({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ background: 'var(--accent)', padding: '8px 16px' }}>
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{titulo}</h3>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 0 }}>
        {children}
      </div>
    </div>
  )
}

export function Fila({ label, value, campo, ed, editMode, onChange, tipo, opciones }:
  { label: string; value?: string; campo?: string; ed?: Record<string, string | boolean | null>; editMode?: boolean; onChange?: (v: string) => void; tipo?: string; opciones?: string[] }) {
  const val = campo && ed ? (ed[campo] as string ?? '') : (value ?? '')
  return (
    <div style={{ padding: '10px 16px', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</div>
      {editMode && onChange ? (
        tipo === 'select' && opciones ? (
          <select value={val} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: '#fff' }}>
            {opciones.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input type={tipo ?? 'text'} value={val} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }} />
        )
      ) : (
        <div style={{ fontSize: 13, color: val ? 'var(--text)' : 'var(--text2)', fontWeight: val ? 500 : 400 }}>{val || '—'}</div>
      )}
    </div>
  )
}

export function MI({ label, k, data, setData, type = 'text', placeholder }: {
  label: string; k: string; data: Record<string, string>
  setData: (d: Record<string, string>) => void; type?: string; placeholder?: string
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>{label}</label>
      <input type={type} value={data[k] ?? ''} onChange={e => setData({ ...data, [k]: e.target.value })} placeholder={placeholder}
        style={{ width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
    </div>
  )
}

export const grid3: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }
export const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }
export const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }
export const selectStyle: React.CSSProperties = { ...inputStyle, background: '#fff', cursor: 'pointer' }

export function fmtFecha(s: string | null | undefined): string {
  if (!s) return '—'
  try { return new Date(s).toLocaleDateString('es-CO') } catch { return s }
}
