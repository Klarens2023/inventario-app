'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'

type AuditRow = {
  id: number
  usuario_nombre: string
  username: string
  accion: string
  descripcion: string
  datos: Record<string, unknown> | null
  created_at: string
}

type Usuario = { id: number; nombre: string; username: string }

const ACCIONES: Record<string, { label: string; color: string; bg: string }> = {
  CARGA_INVENTARIO:    { label: 'Carga Inventario',    color: '#1d4ed8', bg: '#dbeafe' },
  CONTEO_ACTUALIZADO:  { label: 'Conteo Actualizado',  color: '#065f46', bg: '#d1fae5' },
  CONTEO_ACUMULADO:    { label: 'Conteo Acumulado',    color: '#6d28d9', bg: '#ede9fe' },
  HISTORIAL_REINICIADO:{ label: 'Historial Reiniciado',color: '#991b1b', bg: '#fee2e2' },
  USUARIO_CREADO:      { label: 'Usuario Creado',      color: '#0369a1', bg: '#e0f2fe' },
  USUARIO_MODIFICADO:  { label: 'Usuario Modificado',  color: '#92400e', bg: '#fef3c7' },
}

export default function AuditoriaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const hoy = format(new Date(), 'yyyy-MM-dd')
  const [desde, setDesde]         = useState(hoy)
  const [hasta, setHasta]         = useState(hoy)
  const [accion, setAccion]       = useState('todas')
  const [usuarioId, setUsuarioId] = useState('')
  const [rows, setRows]           = useState<AuditRow[]>([])
  const [usuarios, setUsuarios]   = useState<Usuario[]>([])
  const [loading, setLoading]     = useState(false)
  const [detalle, setDetalle]     = useState<AuditRow | null>(null)

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.rol !== 'admin') {
      router.replace('/dashboard')
    }
  }, [status, session, router])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ desde, hasta })
      if (accion !== 'todas') params.set('accion', accion)
      if (usuarioId) params.set('usuario_id', usuarioId)
      const res = await fetch(`/api/auditoria?${params}`)
      const data = await res.json()
      setRows(data.rows ?? [])
      setUsuarios(data.usuarios ?? [])
    } finally {
      setLoading(false)
    }
  }, [desde, hasta, accion, usuarioId])

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.rol === 'admin') {
      cargar()
    }
  }, [status, session, cargar])

  if (status === 'loading' || session?.user?.rol !== 'admin') return null

  return (
    <div style={{ padding: '32px 28px', background: '#f8fafc', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>
          Registro de Actividad
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
          Historial de acciones realizadas por los usuarios del sistema
        </p>
      </div>

      {/* Filtros */}
      <div style={{
        background: '#fff', borderRadius: 12, padding: '20px 24px', marginBottom: 20,
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end'
      }}>
        <div>
          <label style={labelStyle}>Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Accion</label>
          <select value={accion} onChange={e => setAccion(e.target.value)} style={inputStyle}>
            <option value="todas">Todas</option>
            <option value="CARGA_INVENTARIO">Carga Inventario</option>
            <option value="CONTEO_ACTUALIZADO">Conteo Actualizado</option>
            <option value="CONTEO_ACUMULADO">Conteo Acumulado</option>
            <option value="HISTORIAL_REINICIADO">Historial Reiniciado</option>
            <option value="USUARIO_CREADO">Usuario Creado</option>
            <option value="USUARIO_MODIFICADO">Usuario Modificado</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Usuario</label>
          <select value={usuarioId} onChange={e => setUsuarioId(e.target.value)} style={inputStyle}>
            <option value="">Todos</option>
            {usuarios.map(u => (
              <option key={u.id} value={String(u.id)}>{u.nombre} ({u.username})</option>
            ))}
          </select>
        </div>
        <button onClick={cargar} style={btnStyle}>
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </div>

      {/* Resumen */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {Object.entries(ACCIONES).map(([key, meta]) => {
          const count = rows.filter(r => r.accion === key).length
          return (
            <div key={key} style={{
              background: '#fff', borderRadius: 10, padding: '14px 20px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: 12
            }}>
              <span style={{
                display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                fontSize: 12, fontWeight: 600, color: meta.color, background: meta.bg
              }}>{meta.label}</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>{count}</span>
            </div>
          )
        })}
        <div style={{
          background: '#fff', borderRadius: 10, padding: '14px 20px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: 12
        }}>
          <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Total</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>{rows.length}</span>
        </div>
      </div>

      {/* Tabla */}
      <div style={{
        background: '#fff', borderRadius: 12, overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                {['Fecha y Hora', 'Usuario', 'Accion', 'Descripcion', 'Detalle'].map(h => (
                  <th key={h} style={{
                    padding: '12px 16px', textAlign: 'left', fontWeight: 700,
                    color: '#334155', fontSize: 13, whiteSpace: 'nowrap'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    {loading ? 'Cargando...' : 'No hay registros para los filtros seleccionados'}
                  </td>
                </tr>
              )}
              {rows.map((row, i) => {
                const meta = ACCIONES[row.accion] ?? { label: row.accion, color: '#374151', bg: '#f3f4f6' }
                const fecha = new Date(row.created_at)
                return (
                  <tr key={row.id} style={{
                    borderBottom: '1px solid #f1f5f9',
                    background: i % 2 === 0 ? '#fff' : '#fafafa'
                  }}>
                    <td style={{ padding: '11px 16px', whiteSpace: 'nowrap', color: '#475569' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>
                        {fecha.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>
                        {fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{row.usuario_nombre}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{row.username}</div>
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                        fontSize: 12, fontWeight: 600, color: meta.color, background: meta.bg,
                        whiteSpace: 'nowrap'
                      }}>{meta.label}</span>
                    </td>
                    <td style={{ padding: '11px 16px', color: '#475569', maxWidth: 320 }}>
                      {row.descripcion}
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      {row.datos && (
                        <button
                          onClick={() => setDetalle(row)}
                          style={{
                            padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0',
                            background: '#f8fafc', color: '#475569', fontSize: 12, cursor: 'pointer',
                            fontWeight: 600
                          }}
                        >
                          Ver
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal detalle */}
      {detalle && (
        <div
          onClick={() => setDetalle(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 14, padding: '28px 32px',
              maxWidth: 480, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>{detalle.descripcion}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                  {detalle.usuario_nombre} · {new Date(detalle.created_at).toLocaleString('es-CO')}
                </div>
              </div>
              <button onClick={() => setDetalle(null)} style={{
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#94a3b8', lineHeight: 1
              }}>×</button>
            </div>
            <pre style={{
              background: '#f8fafc', borderRadius: 8, padding: '16px', fontSize: 13,
              color: '#334155', overflow: 'auto', maxHeight: 260,
              border: '1px solid #e2e8f0', margin: 0
            }}>
              {JSON.stringify(detalle.datos, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
  fontSize: 14, color: '#1e293b', background: '#fff', outline: 'none', minWidth: 160
}

const btnStyle: React.CSSProperties = {
  padding: '9px 24px', borderRadius: 8, border: 'none',
  background: '#0047BA', color: '#fff', fontWeight: 700,
  fontSize: 14, cursor: 'pointer'
}
