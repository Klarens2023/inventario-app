'use client'

export function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}
    >
      <img src={src} alt="Comprobante ampliado" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} />
    </div>
  )
}
