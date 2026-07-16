type Stat = { label: string; value: string | number; color: string }

export function StatsCards({ stats }: { stats: Stat[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, flexShrink: 0 }}>
      {stats.map(s => (
        <div key={s.label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', borderLeft: `4px solid ${s.color}` }}>
          <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, letterSpacing: '0.05em' }}>{s.label}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
        </div>
      ))}
    </div>
  )
}
