'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { tieneModulo } from '@/lib/permissions'
import type { PuntoVenta, Registro } from '@/types/pvn-historial'
import { getPuntosVenta, getRegistros } from '@/lib/api/pvn-historial'
import { FiltrosBar } from '@/components/pvn-historial/FiltrosBar'
import { ResumenCards } from '@/components/pvn-historial/ResumenCards'
import { RegistrosList } from '@/components/pvn-historial/RegistrosList'

export default function HistorialPVNPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [registros, setRegistros] = useState<Registro[]>([])
  const [puntos, setPuntos]       = useState<PuntoVenta[]>([])
  const [loading, setLoading]     = useState(false)
  const [pvFiltro, setPvFiltro]   = useState('todos')
  const [desde, setDesde]         = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]
  })
  const [hasta, setHasta] = useState(new Date().toISOString().split('T')[0])

  const { rol, modulos } = (session?.user ?? {}) as { rol?: string; modulos?: string[] }
  const canView = tieneModulo(rol ?? '', modulos, 'pvn_historial')

  useEffect(() => {
    if (status === 'authenticated' && !canView) router.replace('/dashboard')
  }, [status, canView, router])

  useEffect(() => {
    if (status === 'authenticated' && canView) getPuntosVenta().then(setPuntos)
  }, [status, canView])

  const cargar = useCallback(async () => {
    setLoading(true)
    try { setRegistros(await getRegistros({ desde, hasta, pvFiltro })) }
    finally { setLoading(false) }
  }, [desde, hasta, pvFiltro])

  useEffect(() => {
    if (status === 'authenticated' && canView) cargar()
  }, [status, canView, cargar])

  if (status === 'loading' || !canView) return null

  return (
    <div style={{ padding: '32px 28px', background: '#f8fafc', minHeight: '100vh' }}>
      <FiltrosBar
        puntos={puntos}
        pvFiltro={pvFiltro} onPvFiltroChange={setPvFiltro}
        desde={desde} onDesdeChange={setDesde}
        hasta={hasta} onHastaChange={setHasta}
        onFiltrar={cargar}
      />

      {!loading && registros.length > 0 && <ResumenCards registros={registros} />}

      <RegistrosList loading={loading} registros={registros} />
    </div>
  )
}
