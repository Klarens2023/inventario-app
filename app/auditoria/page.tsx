'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import type { AuditRow, Usuario } from '@/types/auditoria'
import { getAuditoria } from '@/lib/api/auditoria'
import { FiltrosBar } from '@/components/auditoria/FiltrosBar'
import { ResumenAcciones } from '@/components/auditoria/ResumenAcciones'
import { TablaAuditoria } from '@/components/auditoria/TablaAuditoria'
import { DetalleModal } from '@/components/auditoria/DetalleModal'

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
      const { rows: rowsData, usuarios: usuariosData } = await getAuditoria({ desde, hasta, accion, usuarioId })
      setRows(rowsData); setUsuarios(usuariosData)
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

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>
          Registro de Actividad
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
          Historial de acciones realizadas por los usuarios del sistema
        </p>
      </div>

      <FiltrosBar
        desde={desde} onDesdeChange={setDesde}
        hasta={hasta} onHastaChange={setHasta}
        accion={accion} onAccionChange={setAccion}
        usuarioId={usuarioId} onUsuarioIdChange={setUsuarioId}
        usuarios={usuarios} loading={loading}
        onBuscar={cargar}
      />

      <ResumenAcciones rows={rows} />

      <TablaAuditoria rows={rows} loading={loading} onVerDetalle={setDetalle} />

      {detalle && (
        <DetalleModal detalle={detalle} onClose={() => setDetalle(null)} />
      )}
    </div>
  )
}
