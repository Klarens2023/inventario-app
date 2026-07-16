'use client'

export function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'zoom-out' }}>
      <img src={src} alt="Comprobante" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 8 }} />
    </div>
  )
}
