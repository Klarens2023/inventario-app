'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { exportarExcel } from '@/lib/exportExcel'
import { tieneModulo } from '@/lib/permissions'
import type { PagoAdmin, PuntoVenta, Usuario, SortKey, TurnoActivo, CierreTurno } from '@/types/pvn-pagos-admin'
import {
  getPagos, getPuntosVenta, getUsuariosPvnPvv, getTurnosActivos, getCierresTurno,
  cerrarTurnoActivo as apiCerrarTurnoActivo, putPagoAdmin, deletePagoAdmin,
} from '@/lib/api/pvn-pagos-admin'
import { fmtMoneda } from '@/components/pvn-pagos-admin/utils'
import { FiltrosBar } from '@/components/pvn-pagos-admin/FiltrosBar'
import { Tabs, type Tab } from '@/components/pvn-pagos-admin/Tabs'
import { TurnosActivosPanel } from '@/components/pvn-pagos-admin/TurnosActivosPanel'
import { ResumenCards } from '@/components/pvn-pagos-admin/ResumenCards'
import { PagosTable } from '@/components/pvn-pagos-admin/PagosTable'
import { CierresTurnoTable } from '@/components/pvn-pagos-admin/CierresTurnoTable'

export default function PagosQRPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [pagos, setPagos]     = useState<PagoAdmin[]>([])
  const [puntos, setPuntos]   = useState<PuntoVenta[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(false)
  const [pvFiltro, setPvFiltro] = useState('todos')
  const [usuarioFiltro, setUsuarioFiltro] = useState('todos')
  const [sortBy, setSortBy] = useState<SortKey>('fecha')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [eliminandoId, setEliminandoId] = useState<number | null>(null)
  // Por defecto solo el día de hoy; el usuario puede ampliar el rango con los
  // selectores de fecha y "Filtrar" cuando necesite consultar otro período.
  const [desde, setDesde] = useState(new Date().toISOString().split('T')[0])
  const [hasta, setHasta] = useState(new Date().toISOString().split('T')[0])
  const [editandoId, setEditandoId]     = useState<number | null>(null)
  const [valorEdit,  setValorEdit]      = useState('')
  const [puntoEdit,  setPuntoEdit]      = useState('')
  const [guardandoEdit, setGuardandoEdit] = useState(false)
  const [turnosActivos, setTurnosActivos] = useState<TurnoActivo[]>([])
  const [cargandoTurnos, setCargandoTurnos] = useState(false)
  const [cerrandoTurnoId, setCerrandoTurnoId] = useState<number | null>(null)
  const [mostrarTurnos, setMostrarTurnos] = useState(false)
  const [tab, setTab] = useState<Tab>('pagos')
  const [cierres, setCierres] = useState<CierreTurno[]>([])
  const [loadingCierres, setLoadingCierres] = useState(false)

  const { rol, modulos } = (session?.user ?? {}) as { rol?: string; modulos?: string[] }
  const canView = tieneModulo(rol ?? '', modulos, 'pvn_pagos_qr')
  const isAdmin = rol === 'admin'
  const puedeVerTurnosActivos = isAdmin || rol === 'lider'

  useEffect(() => {
    if (status === 'authenticated' && !canView) router.replace('/dashboard')
  }, [status, canView, router])

  const cargarTurnosActivos = useCallback(async () => {
    setCargandoTurnos(true)
    try { setTurnosActivos(await getTurnosActivos()) }
    finally { setCargandoTurnos(false) }
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && puedeVerTurnosActivos) cargarTurnosActivos()
  }, [status, puedeVerTurnosActivos, cargarTurnosActivos])

  async function cerrarTurnoActivo(t: TurnoActivo) {
    if (!confirm(`¿Cerrar el turno de ${t.usuario_nombre} en ${t.punto_venta_nombre}?`)) return
    setCerrandoTurnoId(t.id)
    try {
      if (await apiCerrarTurnoActivo(t.id)) setTurnosActivos(prev => prev.filter(x => x.id !== t.id))
    } finally {
      setCerrandoTurnoId(null)
    }
  }

  function iniciarEdicionPago(p: PagoAdmin) {
    setEditandoId(p.id)
    setValorEdit(String(p.valor))
    setPuntoEdit(p.punto_venta_id ? String(p.punto_venta_id) : '')
  }

  async function guardarEdicionPago(id: number) {
    const valorNum = parseFloat(valorEdit.replace(/[^\d.]/g, ''))
    if (!valorNum || valorNum <= 0) return
    setGuardandoEdit(true)
    try {
      if (await putPagoAdmin(id, { valor: valorNum, punto_venta_id: puntoEdit || undefined })) {
        setEditandoId(null)
        cargar()
      }
    } finally {
      setGuardandoEdit(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated' && canView) {
      getPuntosVenta().then(setPuntos)
      getUsuariosPvnPvv().then(setUsuarios)
    }
  }, [status, canView])

  const cargar = useCallback(async () => {
    setLoading(true)
    try { setPagos(await getPagos({ desde, hasta, puntoVentaId: pvFiltro, usuarioId: usuarioFiltro })) }
    finally { setLoading(false) }
  }, [desde, hasta, pvFiltro, usuarioFiltro])

  const cargarCierres = useCallback(async () => {
    setLoadingCierres(true)
    try { setCierres(await getCierresTurno({ desde, hasta, puntoVentaId: pvFiltro, usuarioId: usuarioFiltro })) }
    finally { setLoadingCierres(false) }
  }, [desde, hasta, pvFiltro, usuarioFiltro])

  useEffect(() => {
    if (status === 'authenticated' && canView) { cargar(); cargarCierres() }
  }, [status, canView, cargar, cargarCierres])

  function toggleSort(key: SortKey) {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(key); setSortDir('asc') }
  }

  async function eliminarPago(p: PagoAdmin) {
    if (!confirm(`¿Eliminar el pago de ${p.usuario_nombre} por ${fmtMoneda(p.valor)}?`)) return
    setEliminandoId(p.id)
    try {
      if (await deletePagoAdmin(p.id)) setPagos(prev => prev.filter(x => x.id !== p.id))
    } finally {
      setEliminandoId(null)
    }
  }

  function exportar() {
    const columnas = ['Fecha', 'Hora', 'Punto de Venta', 'Tipo', 'Usuario', 'Valor', 'Comprobante']
    const filas = pagos.map(p => {
      const pv = puntos.find(x => x.id === p.punto_venta_id)
      const fechaObj = new Date(p.created_at)
      return [
        p.fecha,
        fechaObj.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        p.punto_venta_nombre ?? '',
        pv?.tipo === 'principal' ? 'PVV' : pv?.tipo === 'nacional' ? 'PVN' : '',
        p.usuario_nombre,
        Number(p.valor),
        p.foto_url,
      ]
    })
    exportarExcel(`pagos_qr_${desde}_a_${hasta}`, columnas, filas, session?.user?.name ?? undefined, 'KLARENS  —  Consolidado de Pagos QR')
  }

  function exportarCierres() {
    const columnas = ['Fecha cierre', 'Hora cierre', 'Fecha turno', 'Punto de Venta', 'Usuario', 'N° de recogida', 'Foto cierre datafono']
    const filas = cierres.map(c => {
      const fechaObj = c.cerrado_at ? new Date(c.cerrado_at) : null
      return [
        c.fecha_cierre,
        fechaObj ? fechaObj.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '',
        c.fecha,
        c.punto_venta_nombre ?? '',
        c.usuario_nombre,
        c.numero_recogida ?? '',
        c.foto_datafono_url ?? '',
      ]
    })
    exportarExcel(`cierres_turno_pvv_${desde}_a_${hasta}`, columnas, filas, session?.user?.name ?? undefined, 'KLARENS  —  Cierres de Turno PVV')
  }

  function filtrar() { cargar(); cargarCierres() }

  if (status === 'loading' || !canView) return null

  return (
    <div style={{ padding: '32px 28px', background: '#f8fafc', minHeight: '100vh' }}>
      <FiltrosBar
        puntos={puntos}
        usuarios={usuarios}
        pvFiltro={pvFiltro}
        onPvFiltroChange={setPvFiltro}
        usuarioFiltro={usuarioFiltro}
        onUsuarioFiltroChange={setUsuarioFiltro}
        desde={desde}
        onDesdeChange={setDesde}
        hasta={hasta}
        onHastaChange={setHasta}
        onFiltrar={filtrar}
        onExportar={tab === 'pagos' ? exportar : exportarCierres}
        puedeExportar={tab === 'pagos' ? pagos.length > 0 : cierres.length > 0}
      />

      <Tabs tab={tab} onChange={setTab} />

      {tab === 'pagos' ? (
        <>
          {puedeVerTurnosActivos && (
            <TurnosActivosPanel
              turnosActivos={turnosActivos}
              cargando={cargandoTurnos}
              mostrar={mostrarTurnos}
              onToggleMostrar={() => setMostrarTurnos(v => !v)}
              cerrandoTurnoId={cerrandoTurnoId}
              onCerrarTurno={cerrarTurnoActivo}
              puedeCerrar={isAdmin}
            />
          )}

          {!loading && pagos.length > 0 && <ResumenCards pagos={pagos} />}

          <PagosTable
            pagos={pagos}
            loading={loading}
            puntos={puntos}
            isAdmin={isAdmin}
            sortBy={sortBy}
            sortDir={sortDir}
            onToggleSort={toggleSort}
            editandoId={editandoId}
            valorEdit={valorEdit}
            onValorEditChange={setValorEdit}
            puntoEdit={puntoEdit}
            onPuntoEditChange={setPuntoEdit}
            guardandoEdit={guardandoEdit}
            onIniciarEdicion={iniciarEdicionPago}
            onGuardarEdicion={guardarEdicionPago}
            onCancelarEdicion={() => setEditandoId(null)}
            eliminandoId={eliminandoId}
            onEliminarPago={eliminarPago}
          />
        </>
      ) : (
        <CierresTurnoTable cierres={cierres} loading={loadingCierres} />
      )}
    </div>
  )
}
