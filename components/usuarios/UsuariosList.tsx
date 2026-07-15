'use client'
import { format } from 'date-fns'
import type { Usuario } from '@/types/usuarios'
import type { AreaInfo } from '@/lib/permissions'
import { ROL_LABELS } from './constants'

type Props = {
  usuarios: Usuario[]
  areas: AreaInfo[]
  loading: boolean
  sessionUserId?: string
  esAdmin: boolean
  onEditar: (u: Usuario) => void
  onToggleActivo: (u: Usuario) => void
}

export function UsuariosList({ usuarios, areas, loading, sessionUserId, esAdmin, onEditar, onToggleActivo }: Props) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
              {['Nombre', 'Usuario', 'Área', 'Rol', 'Estado', 'Contraseña', 'Creado', 'Acciones'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#334155', fontSize: 13, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Cargando...</td></tr>
            )}
            {!loading && usuarios.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No hay usuarios</td></tr>
            )}
            {!loading && usuarios.map((u, i) => {
              const rolInfo  = ROL_LABELS[u.rol]  ?? ROL_LABELS.usuario
              const areaKey  = ['pvn', 'pvv'].includes(u.rol) ? 'puntos_venta' : u.area
              const areaEncontrada = areas.find(a => a.key === areaKey)
              const areaInfo = areaEncontrada ? { label: areaEncontrada.label, color: areaEncontrada.color, bg: areaEncontrada.bg } : { label: u.area, color: '#374151', bg: '#f3f4f6' }
              const esYo           = String(u.id) === sessionUserId
              const puedeEditar    = esAdmin || (u.rol !== 'admin' && !esYo)
              const puedeDesactivar = !esYo && (esAdmin || u.rol !== 'admin')

              return (
                <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1e293b' }}>{u.nombre}</td>
                  <td style={{ padding: '12px 16px', color: '#475569' }}>{u.username}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: areaInfo.color, background: areaInfo.bg }}>{areaInfo.label}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: rolInfo.color, background: rolInfo.bg }}>{rolInfo.label}</span>
                    {u.punto_venta_nombre && (
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{u.punto_venta_nombre}</div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: u.activo ? '#065f46' : '#991b1b', background: u.activo ? '#d1fae5' : '#fee2e2' }}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {u.debe_cambiar_password
                      ? <span style={{ fontSize: 12, color: '#d97706', fontWeight: 600 }}>Pendiente</span>
                      : <span style={{ fontSize: 12, color: '#64748b' }}>Personalizada</span>}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 13 }}>
                    {format(new Date(u.created_at), 'dd/MM/yyyy')}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {puedeEditar && (
                        <button onClick={() => onEditar(u)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          Editar
                        </button>
                      )}
                      {puedeDesactivar && (
                        <button onClick={() => onToggleActivo(u)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: u.activo ? '#fff5f5' : '#f0fdf4', color: u.activo ? '#dc2626' : '#16a34a', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          {u.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
