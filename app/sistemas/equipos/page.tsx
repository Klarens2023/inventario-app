'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import type { Equipo, FiltrosEquipos } from '@/types/equipos'
import { fetchEquipos } from '@/lib/api/equipos'
import { EquiposList } from '@/components/equipos/EquiposList'

export default function EquiposPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const area     = session?.user?.area ?? 'logistica'
  const rol      = session?.user?.rol  ?? 'usuario'
  const canCreate = area === 'sistemas' || area === 'general' || rol === 'admin'

  useEffect(() => {
    if (status === 'authenticated' && area !== 'sistemas' && area !== 'general' && rol !== 'admin') {
      router.replace('/dashboard')
    }
  }, [status, area, rol, router])

  const [lista,    setLista]    = useState<Equipo[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtros,  setFiltros]  = useState<FiltrosEquipos>({ buscar: '', tipo: '', estado: '' })

  const cargar = useCallback(async () => {
    setCargando(true)
    try { setLista(await fetchEquipos(filtros)) }
    finally { setCargando(false) }
  }, [filtros])

  useEffect(() => {
    if (status === 'authenticated') cargar()
  }, [status, cargar])

  if (status === 'loading') return null

  return (
    <EquiposList
      lista={lista}
      cargando={cargando}
      filtros={filtros}
      canCreate={canCreate}
      onFiltro={cambios => setFiltros(prev => ({ ...prev, ...cambios }))}
      onBuscar={cargar}
    />
  )
}
