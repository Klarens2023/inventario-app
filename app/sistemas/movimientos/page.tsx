'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import type { MovimientoResumen, FiltrosMovimientos } from '@/types/movimientos'
import { fetchMovimientos } from '@/lib/api/movimientos'
import { MovimientosList }   from '@/components/movimientos/MovimientosList'
import { MovimientoForm }    from '@/components/movimientos/MovimientoForm'
import { MovimientoDetalle } from '@/components/movimientos/MovimientoDetalle'

type Vista = 'lista' | 'nuevo' | 'detalle'

export default function MovimientosTICPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const rol     = session?.user?.rol ?? ''
  const isAdmin = rol === 'admin'

  useEffect(() => {
    if (status === 'authenticated' && !['admin', 'lider', 'usuario'].includes(rol)) {
      router.replace('/dashboard')
    }
  }, [status, rol, router])

  const [vista,      setVista]      = useState<Vista>('lista')
  const [detalleId,  setDetalleId]  = useState('')
  const [proximoId,  setProximoId]  = useState('')
  const [lista,      setLista]      = useState<MovimientoResumen[]>([])
  const [cargando,   setCargando]   = useState(false)
  const [filtros,    setFiltros]    = useState<FiltrosMovimientos>({ buscar: '', estado: '', desde: '', hasta: '' })

  const cargarLista = useCallback(async () => {
    setCargando(true)
    try {
      const data = await fetchMovimientos(filtros)
      setLista(data)
    } finally {
      setCargando(false)
    }
  }, [filtros])

  useEffect(() => {
    if (status === 'authenticated') cargarLista()
  }, [status, cargarLista])

  function abrirNuevo() {
    const next = lista.length > 0
      ? `TIC-${String(parseInt(lista[0].id.replace('TIC-', ''), 10) + 1).padStart(4, '0')}`
      : 'TIC-0001'
    setProximoId(next)
    setVista('nuevo')
  }

  function abrirDetalle(id: string) {
    setDetalleId(id)
    setVista('detalle')
  }

  if (status === 'loading') return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <span style={{ color: '#94a3b8' }}>Cargando...</span>
    </div>
  )

  if (vista === 'detalle') return (
    <MovimientoDetalle
      id={detalleId}
      isAdmin={isAdmin}
      onVolver={() => setVista('lista')}
      onEstadoCambiado={cargarLista}
    />
  )

  if (vista === 'nuevo') return (
    <MovimientoForm
      proximoId={proximoId}
      onCancelar={() => setVista('lista')}
      onGuardado={() => { cargarLista(); setVista('lista') }}
    />
  )

  return (
    <MovimientosList
      lista={lista}
      cargando={cargando}
      filtros={filtros}
      onFiltro={cambios => setFiltros(prev => ({ ...prev, ...cambios }))}
      onBuscar={cargarLista}
      onNuevo={abrirNuevo}
      onVerDetalle={abrirDetalle}
    />
  )
}
