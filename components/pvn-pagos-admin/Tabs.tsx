'use client'

export type Tab = 'pagos' | 'cierres'

type Props = {
  tab: Tab
  onChange: (t: Tab) => void
}

export function Tabs({ tab, onChange }: Props) {
  function estilo(t: Tab): React.CSSProperties {
    return {
      padding: '9px 18px', borderRadius: 8,
      border: `2px solid ${tab === t ? '#0047BA' : '#e2e8f0'}`,
      background: tab === t ? '#0047BA' : '#fff',
      color: tab === t ? '#fff' : '#475569',
      fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      <button onClick={() => onChange('pagos')} style={estilo('pagos')}>💳 Pagos QR</button>
      <button onClick={() => onChange('cierres')} style={estilo('cierres')}>🧾 Cierres de turno (PVV)</button>
    </div>
  )
}
