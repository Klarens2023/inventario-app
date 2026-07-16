'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import type { Turno, TurnoHist, PuntoVenta, Pago, ResumenCierre } from '@/types/pvn-qr'
import {
  getTurno, getTurnosHistorial, abrirTurno as apiAbrirTurno, cerrarTurno as apiCerrarTurno,
  getPuntosVentaPrincipales, getPagosHoy, postPago, putPago, deletePago,
} from '@/lib/api/pvn-qr'
import { comprimirImagen, fmtMoneda } from '@/components/pvn-qr/utils'
import { TurnoPendienteScreen } from '@/components/pvn-qr/TurnoPendienteScreen'
import { AbrirTurnoScreen } from '@/components/pvn-qr/AbrirTurnoScreen'
import { ComprobanteForm } from '@/components/pvn-qr/ComprobanteForm'
import { MisPagosPanel } from '@/components/pvn-qr/MisPagosPanel'
import { Lightbox } from '@/components/pvn-qr/Lightbox'

export default function SubirQRPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const rol         = session?.user?.rol ?? ''
  const pvFijo      = (session?.user as { punto_venta_id?: number })?.punto_venta_id ?? null
  const esPvn       = rol === 'pvn'
  const esPvv       = rol === 'pvv'
  const permitido   = esPvn || esPvv
  const esRotatoria = esPvv && !pvFijo      // pvv sin punto asignado: además de tener turno, elige/cambia de punto
  const necesitaTurno = permitido           // todos (pvn, pvv fija y pvv rotativa) controlan apertura/cierre de turno

  useEffect(() => {
    if (status === 'authenticated' && !permitido) router.replace('/dashboard')
  }, [status, permitido, router])

  // Turno
  const [turnoHoy,       setTurnoHoy]       = useState<Turno | null | undefined>(undefined)
  const [turnoPendiente, setTurnoPendiente] = useState<Turno | null>(null)
  const [puntos,         setPuntos]         = useState<PuntoVenta[]>([])
  const [puntoApertura,  setPuntoApertura]  = useState('')
  const [abriendo,       setAbriendo]       = useState(false)
  const [cerrando,       setCerrando]       = useState(false)
  const [errorTurno,     setErrorTurno]     = useState('')
  const [resumenCierre,  setResumenCierre]  = useState<ResumenCierre | null>(null)

  // Formulario de pago
  const [foto,      setFoto]      = useState<File | null>(null)
  const [preview,   setPreview]   = useState<string | null>(null)
  const [valor,     setValor]     = useState('')
  const [subiendo,  setSubiendo]  = useState(false)
  const [error,     setError]     = useState('')
  const [exito,     setExito]     = useState('')
  const [pagosHoy,  setPagosHoy]  = useState<Pago[]>([])
  const [mostrarHoy, setMostrarHoy] = useState(false)
  const [cargandoPagos, setCargandoPagos] = useState(false)
  const [lightbox,  setLightbox]  = useState<string | null>(null)
  const [editandoId, setEditandoId]     = useState<number | null>(null)
  const [valorEdit,  setValorEdit]      = useState('')
  const [guardandoEdit, setGuardandoEdit] = useState(false)
  const [eliminandoId, setEliminandoId] = useState<number | null>(null)
  const [verTurnoId,   setVerTurnoId]   = useState<number | null>(null) // null = turno actual
  const [turnosHist,   setTurnosHist]   = useState<TurnoHist[]>([])
  const [mostrarListaTurnos, setMostrarListaTurnos] = useState(false)
  const [cargandoTurnosHist, setCargandoTurnosHist] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const cargarPagosHoy = useCallback(async (turnoId?: number | null) => {
    setCargandoPagos(true)
    try { setPagosHoy(await getPagosHoy(turnoId)) }
    finally { setCargandoPagos(false) }
  }, [])

  useEffect(() => {
    if (status !== 'authenticated' || !permitido) return
    getTurno()
      .then(d => { setTurnoHoy(d.turnoHoy); setTurnoPendiente(d.turnoPendiente) })
      .catch(() => { setTurnoHoy(null); setTurnoPendiente(null) })
    if (esRotatoria) {
      getPuntosVentaPrincipales().then(setPuntos).catch(() => {})
    }
    cargarPagosHoy()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, permitido, esRotatoria])

  const cargarTurnosHist = useCallback(async () => {
    setCargandoTurnosHist(true)
    try { setTurnosHist(await getTurnosHistorial()) }
    finally { setCargandoTurnosHist(false) }
  }, [])

  function verTurnoActual() {
    setVerTurnoId(null)
    setMostrarListaTurnos(false)
    cargarPagosHoy()
  }

  function verTurnoAnterior(t: TurnoHist) {
    setVerTurnoId(t.id)
    setMostrarListaTurnos(false)
    cargarPagosHoy(t.id)
  }

  async function handleAbrirTurno() {
    setErrorTurno('')
    if (esRotatoria && !puntoApertura) { setErrorTurno('Selecciona el punto de venta'); return }
    setAbriendo(true)
    try {
      const res = await apiAbrirTurno(puntoApertura)
      if (!res.ok) { setErrorTurno(res.error); return }
      setTurnoHoy(res.turno)
      setResumenCierre(null)
      setPuntoApertura('')
    } finally { setAbriendo(false) }
  }

  async function handleCerrarTurno(turnoId?: number) {
    if (!confirm('¿Confirmas el cierre del turno?')) return
    setCerrando(true)
    try {
      const res = await apiCerrarTurno(turnoId)
      if (res.ok) {
        setResumenCierre({ total_pagos: res.total_pagos, total_valor: res.total_valor })
        setTurnoHoy(null)
        setTurnoPendiente(null)
        setMostrarHoy(false)
      }
    } finally { setCerrando(false) }
  }

  async function seleccionarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    const comprimida = await comprimirImagen(file)
    setFoto(comprimida)
    setPreview(URL.createObjectURL(comprimida))
  }

  async function enviar() {
    setError('')
    if (!foto) { setError('Adjunta la foto del comprobante'); return }
    const valorNum = parseFloat(valor.replace(/[^\d.]/g, ''))
    if (!valorNum || valorNum <= 0) { setError('Ingresa un valor válido'); return }
    setSubiendo(true)
    try {
      const res = await postPago(foto, valorNum)
      if (!res.ok) { setError(res.error); return }
      setExito(`Pago de ${fmtMoneda(valorNum)} registrado`)
      setFoto(null); setPreview(null); setValor('')
      if (fileRef.current) fileRef.current.value = ''
      cargarPagosHoy()
    } finally { setSubiendo(false) }
  }

  function iniciarEdicion(p: Pago) {
    setEditandoId(p.id)
    setValorEdit(String(p.valor))
  }

  async function guardarEdicion(id: number) {
    const valorNum = parseFloat(valorEdit.replace(/[^\d.]/g, ''))
    if (!valorNum || valorNum <= 0) return
    setGuardandoEdit(true)
    try {
      if (await putPago(id, valorNum)) { setEditandoId(null); cargarPagosHoy() }
    } finally { setGuardandoEdit(false) }
  }

  async function eliminarPago(id: number) {
    if (!confirm('¿Eliminar este pago?')) return
    setEliminandoId(id)
    try {
      if (await deletePago(id)) cargarPagosHoy()
    } finally { setEliminandoId(null) }
  }

  function cerrarPanelHoy() {
    setMostrarHoy(false)
    setErrorTurno('')
    setMostrarListaTurnos(false)
    setVerTurnoId(null)
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (status === 'loading' || !permitido || (necesitaTurno && turnoHoy === undefined)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
        <div style={{ color: '#94a3b8', fontSize: 14 }}>Cargando...</div>
      </div>
    )
  }

  // ── Turno pendiente de día anterior ──────────────────────────────────────
  if (necesitaTurno && turnoPendiente && !turnoHoy) {
    return <TurnoPendienteScreen turnoPendiente={turnoPendiente} cerrando={cerrando} onCerrar={() => handleCerrarTurno(turnoPendiente.id)} />
  }

  // ── Sin turno abierto ──────────────────────────────────────────────────────
  if (necesitaTurno && !turnoHoy) {
    return (
      <AbrirTurnoScreen
        esRotatoria={esRotatoria}
        puntos={puntos}
        puntoApertura={puntoApertura}
        onPuntoAperturaChange={setPuntoApertura}
        errorTurno={errorTurno}
        abriendo={abriendo}
        onAbrir={handleAbrirTurno}
        resumenCierre={resumenCierre}
      />
    )
  }

  // ── Pantalla principal: subir comprobante ─────────────────────────────────
  const nombrePunto = necesitaTurno ? turnoHoy?.punto_venta_nombre : undefined

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '64px 16px 16px', maxWidth: 480, margin: '0 auto' }}>
      <ComprobanteForm
        necesitaTurno={necesitaTurno}
        nombrePunto={nombrePunto}
        turnoAbiertoAt={turnoHoy?.abierto_at}
        onVerPagos={() => { setMostrarHoy(true); setVerTurnoId(null); setMostrarListaTurnos(false); cargarPagosHoy() }}
        exito={exito}
        onCerrarExito={() => setExito('')}
        error={error}
        preview={preview}
        onQuitarFoto={() => { setFoto(null); setPreview(null); if (fileRef.current) fileRef.current.value = '' }}
        fileRef={fileRef}
        onSeleccionarFoto={seleccionarFoto}
        valor={valor}
        onValorChange={setValor}
        onEnviar={enviar}
        subiendo={subiendo}
      />

      {mostrarHoy && (
        <MisPagosPanel
          nombrePunto={nombrePunto}
          necesitaTurno={necesitaTurno}
          mostrarListaTurnos={mostrarListaTurnos}
          onMostrarListaTurnos={() => { setMostrarListaTurnos(true); cargarTurnosHist() }}
          turnosHist={turnosHist}
          cargandoTurnosHist={cargandoTurnosHist}
          verTurnoId={verTurnoId}
          onVerTurnoActual={verTurnoActual}
          onVerTurnoAnterior={verTurnoAnterior}
          pagosHoy={pagosHoy}
          cargandoPagos={cargandoPagos}
          onSetLightbox={setLightbox}
          editandoId={editandoId}
          valorEdit={valorEdit}
          onValorEditChange={setValorEdit}
          guardandoEdit={guardandoEdit}
          onIniciarEdicion={iniciarEdicion}
          onGuardarEdicion={guardarEdicion}
          onCancelarEdicion={() => setEditandoId(null)}
          eliminandoId={eliminandoId}
          onEliminarPago={eliminarPago}
          cerrando={cerrando}
          onCerrarTurno={() => handleCerrarTurno()}
          onClose={cerrarPanelHoy}
        />
      )}

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  )
}
