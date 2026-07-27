'use client'
import { useEffect, useRef, useState } from 'react'

export type LightboxItem = {
  src: string
  info: { label: string; value: string }[]
}

type Props = {
  items: LightboxItem[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
}

export function Lightbox({ items, index, onClose, onNavigate }: Props) {
  const item = items[index]
  const [escala, setEscala] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [arrastrando, setArrastrando] = useState(false)
  const origenArrastre = useRef<{ x: number; y: number } | null>(null)

  // Cada foto arranca sin zoom/paneo, aunque se venga navegando de otra ya ampliada.
  useEffect(() => { setEscala(1); setPos({ x: 0, y: 0 }) }, [index])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && index > 0) onNavigate(index - 1)
      else if (e.key === 'ArrowRight' && index < items.length - 1) onNavigate(index + 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [index, items.length, onClose, onNavigate])

  if (!item) return null

  function acercar(delta: number) {
    setEscala((s) => {
      const nueva = Math.min(4, Math.max(1, Math.round((s + delta) * 100) / 100))
      if (nueva === 1) setPos({ x: 0, y: 0 })
      return nueva
    })
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    acercar(e.deltaY > 0 ? -0.25 : 0.25)
  }

  function alternarZoom(e: React.MouseEvent) {
    e.stopPropagation()
    if (escala > 1) { setEscala(1); setPos({ x: 0, y: 0 }) }
    else setEscala(2)
  }

  function onMouseDown(e: React.MouseEvent) {
    if (escala === 1) return
    origenArrastre.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    setArrastrando(true)
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!origenArrastre.current) return
    setPos({ x: e.clientX - origenArrastre.current.x, y: e.clientY - origenArrastre.current.y })
  }
  function soltar() {
    origenArrastre.current = null
    setArrastrando(false)
  }

  const flechaEstilo: React.CSSProperties = {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    width: 44, height: 44, borderRadius: '50%', border: 'none',
    background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: 24,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex' }}
    >
      <div style={{ width: 260, flexShrink: 0, background: '#0f172a', color: '#fff', padding: 20, overflowY: 'auto' }}>
        <button
          onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}
        >
          ✕ Cerrar
        </button>
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {item.info.map((l, i) => (
            <div key={i}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.04em' }}>{l.label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{l.value || '—'}</div>
            </div>
          ))}
        </div>
        {items.length > 1 && (
          <div style={{ marginTop: 24, fontSize: 12, color: '#64748b' }}>Foto {index + 1} de {items.length}</div>
        )}
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={soltar}
        onMouseLeave={soltar}
        style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <img
          src={item.src}
          alt="Comprobante ampliado"
          onClick={alternarZoom}
          draggable={false}
          style={{
            maxWidth: '92%', maxHeight: '92%', borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${escala})`,
            cursor: escala === 1 ? 'zoom-in' : (arrastrando ? 'grabbing' : 'grab'),
            transition: arrastrando ? 'none' : 'transform 0.15s ease-out',
            userSelect: 'none',
          }}
        />

        {index > 0 && (
          <button onClick={(e) => { e.stopPropagation(); onNavigate(index - 1) }} style={{ ...flechaEstilo, left: 16 }} title="Anterior (←)">‹</button>
        )}
        {index < items.length - 1 && (
          <button onClick={(e) => { e.stopPropagation(); onNavigate(index + 1) }} style={{ ...flechaEstilo, right: 16 }} title="Siguiente (→)">›</button>
        )}

        <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8 }}>
          <button onClick={(e) => { e.stopPropagation(); acercar(-0.5) }} style={{ ...flechaEstilo, position: 'static', width: 36, height: 36, fontSize: 18 }} title="Alejar">−</button>
          <button onClick={(e) => { e.stopPropagation(); acercar(0.5) }} style={{ ...flechaEstilo, position: 'static', width: 36, height: 36, fontSize: 18 }} title="Acercar">+</button>
        </div>
      </div>
    </div>
  )
}
