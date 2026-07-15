'use client'
import type { Usuario } from '@/types/usuarios'
import type { AreaInfo } from '@/lib/permissions'

type Props = {
  usuarios: Usuario[]
  areas: AreaInfo[]
  filtroArea: string
  onChange: (area: string) => void
}

export function AreaFilterBar({ usuarios, areas, filtroArea, onChange }: Props) {
  const areasConUsuarios = Array.from(new Set(usuarios.map(u => u.area))).sort()

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
      <AreaBtn label={`Todas (${usuarios.length})`} active={filtroArea === 'todos'} onClick={() => onChange('todos')} />
      {areasConUsuarios.map(a => (
        <AreaBtn
          key={a}
          label={`${areas.find(x => x.key === a)?.label ?? a} (${usuarios.filter(u => u.area === a).length})`}
          active={filtroArea === a}
          onClick={() => onChange(a)}
        />
      ))}
    </div>
  )
}

function AreaBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid',
      borderColor: active ? '#0047BA' : '#e2e8f0',
      background: active ? '#0047BA' : '#fff',
      color: active ? '#fff' : '#64748b',
    }}>{label}</button>
  )
}
