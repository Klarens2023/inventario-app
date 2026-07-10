'use client'
import type { Usuario } from '@/types/usuarios'
import { ROL_LABELS, AREA_LABELS, ROLES_POR_AREA, btnSecondary } from './constants'

type Props = {
  usuarios: Usuario[]
  onClose: () => void
}

export function ModalAreas({ usuarios, onClose }: Props) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: '32px', maxWidth: 520, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '85vh', overflowY: 'auto' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 0, marginBottom: 6 }}>Áreas y Roles</h2>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
          Estructura de áreas del sistema. Los roles marcados se asignan automáticamente a cada área.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {Object.entries(AREA_LABELS).map(([areaKey, areaInfo]) => {
            const rolesDeArea = ROLES_POR_AREA[areaKey] ?? []
            const usuariosDeArea = usuarios.filter(u =>
              (['pvn', 'pvv'].includes(u.rol) ? 'puntos_venta' : u.area) === areaKey
            )
            return (
              <div key={areaKey} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: areaInfo.color, background: areaInfo.bg }}>
                    {areaInfo.label}
                  </span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{usuariosDeArea.length} usuario{usuariosDeArea.length !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {rolesDeArea.map(r => {
                    const ri = ROL_LABELS[r]
                    return ri ? (
                      <span key={r} style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: ri.color, background: ri.bg }}>
                        {ri.label}
                      </span>
                    ) : null
                  })}
                </div>
              </div>
            )
          })}
        </div>
        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 20, marginBottom: 0 }}>
          Al asignar el rol PVN o PVV a un usuario, el área se establece automáticamente como <strong>Puntos de Venta</strong>.
        </p>
        <div style={{ marginTop: 24 }}>
          <button onClick={onClose} style={{ ...btnSecondary, width: '100%' }}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
