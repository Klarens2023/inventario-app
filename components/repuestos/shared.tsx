'use client'
import type { ReactNode } from 'react'
import { lbl } from '@/components/movimientos/styles'
import { nivelStock, unidadTexto } from './constants'

export function Chip({ texto, color, bg }: { texto: string; color: string; bg: string }) {
  return (
    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color, background: bg, whiteSpace: 'nowrap' }}>
      {texto}
    </span>
  )
}

export function StockBadge({ actual, minimo, unidad }: { actual: number; minimo: number; unidad: string }) {
  const nivel = nivelStock(actual, minimo)
  const c = nivel === 'agotado' ? { color: '#991b1b', bg: '#fee2e2' }
          : nivel === 'bajo'    ? { color: '#92400e', bg: '#fef3c7' }
          :                       { color: '#065f46', bg: '#d1fae5' }
  return (
    <span title={minimo > 0 ? `Mínimo: ${minimo}` : 'Sin mínimo definido'}
      style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 800, color: c.color, background: c.bg, whiteSpace: 'nowrap' }}>
      {actual} <span style={{ fontWeight: 600, fontSize: 11 }}>{unidadTexto(unidad, actual)}</span>
    </span>
  )
}

export function Campo({ label, children, span = 1 }: { label: string; children: ReactNode; span?: number }) {
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      <label style={lbl}>{label}</label>
      {children}
    </div>
  )
}

export function Modal({ titulo, subtitulo, onClose, children, ancho = 560 }: {
  titulo: string; subtitulo?: string; onClose: () => void; children: ReactNode; ancho?: number
}) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 24, maxWidth: ancho, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{titulo}</h2>
        {subtitulo && <p style={{ margin: '0 0 18px', fontSize: 13, color: '#64748b' }}>{subtitulo}</p>}
        {children}
      </div>
    </div>
  )
}

export function fmtPesos(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—'
  return `$${Number(v).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`
}
