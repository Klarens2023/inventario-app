'use client'
import type { ReactNode } from 'react'
import { ESTADOS_COLOR } from './constants'

export function Badge({ estado }: { estado: string }) {
  const c = ESTADOS_COLOR[estado] ?? { color: '#374151', bg: '#f3f4f6' }
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      color: c.color, background: c.bg, textTransform: 'capitalize', whiteSpace: 'nowrap',
    }}>
      {estado}
    </span>
  )
}

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '16px 18px', marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#0047BA', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

export function SecCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#0047BA', marginBottom: 10, textTransform: 'uppercase' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

export function Item({ label, val }: { label: string; val: string }) {
  return (
    <div style={{ marginBottom: 7 }}>
      <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{label}: </span>
      <span style={{ fontSize: 13, color: '#1e293b' }}>{val}</span>
    </div>
  )
}
