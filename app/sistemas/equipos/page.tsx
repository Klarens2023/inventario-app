'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Equipo = {
  id: string
  tipo_equipo: string
  marca: string
  modelo: string
  numero_serie: string
  sede: string
  area_ubicacion: string
  usuario_asignado: string
  responsable: string
  estado: string
  proximo_mantenimiento: string | null
  fecha_registro: string
}

const ESTADOS_COLOR: Record<string, { color: string; bg: string }> = {
  'Activo':       { color: '#065f46', bg: '#d1fae5' },
  'Mantenimiento':{ color: '#92400e', bg: '#fef3c7' },
  'Obsoleto':     { color: '#991b1b', bg: '#fee2e2' },
  'Baja':         { color: '#374151', bg: '#f3f4f6' },
}

const TIPOS_EQUIPO = [
  'Computador Desktop','Laptop','Servidor','All-in-One','Switch','Router','Access Point','Firewall',
  'Monitor/Pantalla','Impresora Láser B/N','Impresora Láser Color','Impresora Multifuncional',
  'Impresora Inyección','Impresora Térmica','Impresora Etiquetas','Plotter','UPS/Regulador',
  'Tablet','Teléfono IP','Cámara IP/CCTV','NAS','Proyector','Escáner','Terminal POS',
  'Lector de Código de Barras','Otro',
]

export default function EquiposPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [equipos, setEquipos]   = useState<Equipo[]>([])
  const [loading, setLoading]   = useState(true)
  const [buscar, setBuscar]     = useState('')
  const [filtroTipo, setFiltroTipo]   = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  const area = session?.user?.area ?? 'logistica'
  const rol  = session?.user?.rol  ?? 'usuario'
  const canCreate = area === 'sistemas' || area === 'general' || rol === 'admin'

  useEffect(() => {
    if (status === 'authenticated') {
      if (area !== 'sistemas' && area !== 'general' && rol !== 'admin') {
        router.replace('/dashboard')
      }
    }
  }, [status, area, rol, router])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (buscar) params.set('buscar', buscar)
      if (filtroTipo) params.set('tipo', filtroTipo)
      if (filtroEstado) params.set('estado', filtroEstado)
      const res = await fetch(`/api/sistemas/equipos?${params}`)
      const data = await res.json()
      setEquipos(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [buscar, filtroTipo, filtroEstado])

  useEffect(() => {
    if (status === 'authenticated') cargar()
  }, [status, cargar])

  if (status === 'loading') return null

  const hoy = new Date()

  return (
    <div style={{ padding: '32px 28px', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Inventario de Equipos TI</h1>
          <p style={{ color: 'var(--text2)', fontSize: 14, marginTop: 4 }}>
            Klarens · Lácteos del Cesar SAS — {equipos.length} equipos registrados
          </p>
        </div>
        {canCreate && (
          <Link href="/sistemas/equipos/nuevo" style={{
            padding: '10px 20px', borderRadius: 8, background: '#0047BA', color: '#fff',
            fontWeight: 700, fontSize: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6
          }}>
            + Nuevo Equipo
          </Link>
        )}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          value={buscar}
          onChange={e => setBuscar(e.target.value)}
          placeholder="Buscar por ID, marca, modelo, serie, usuario..."
          style={{
            flex: '1 1 280px', padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border)',
            fontSize: 14, background: '#fff', color: 'var(--text)', outline: 'none'
          }}
          onKeyDown={e => e.key === 'Enter' && cargar()}
        />
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, background: '#fff', color: 'var(--text)', outline: 'none', minWidth: 180 }}>
          <option value="">Todos los tipos</option>
          {TIPOS_EQUIPO.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, background: '#fff', color: 'var(--text)', outline: 'none' }}>
          <option value="">Todos los estados</option>
          {['Activo','Mantenimiento','Obsoleto','Baja'].map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {/* Tabla */}
      <div style={{ background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,71,186,0.06)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="inv-table">
            <thead>
              <tr>
                {['ID','Tipo','Marca / Modelo','N° Serie','Ubicación','Asignado a','Estado','Próx. Mant.'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Cargando...</td></tr>
              )}
              {!loading && equipos.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>No se encontraron equipos</td></tr>
              )}
              {!loading && equipos.map(eq => {
                const estadoStyle = ESTADOS_COLOR[eq.estado] ?? { color: '#374151', bg: '#f3f4f6' }
                const proxMant = eq.proximo_mantenimiento ? new Date(eq.proximo_mantenimiento) : null
                const mantVencido = proxMant && proxMant < hoy
                return (
                  <tr key={eq.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/sistemas/equipos/${eq.id}`)}>
                    <td style={{ fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap' }}>{eq.id}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{eq.tipo_equipo}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{eq.marca}</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)' }}>{eq.modelo}</div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{eq.numero_serie || '—'}</td>
                    <td style={{ fontSize: 12 }}>
                      {eq.sede && <div>{eq.sede}</div>}
                      {eq.area_ubicacion && <div style={{ color: 'var(--text2)' }}>{eq.area_ubicacion}</div>}
                    </td>
                    <td style={{ fontSize: 13 }}>{eq.usuario_asignado || eq.responsable || '—'}</td>
                    <td>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: estadoStyle.color, background: estadoStyle.bg }}>
                        {eq.estado}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: mantVencido ? '#dc2626' : 'var(--text2)', fontWeight: mantVencido ? 700 : 400 }}>
                      {proxMant ? proxMant.toLocaleDateString('es-CO') : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
