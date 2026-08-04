'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { EquipoDetalle, HistReg, TabKey } from '@/types/equipos'
import { fetchEquipoDetalle, actualizarEquipo, eliminarEquipo, agregarHistorial } from '@/lib/api/equipos'
import { TIPOS_EQUIPO, ESTADOS_COLOR } from './constants'
import { CardDetalle, Fila } from './shared'
import { HistorialTab } from './HistorialTab'
import { ModalHistorial } from './ModalHistorial'

type Props = { id: string; canEdit: boolean; canDelete: boolean }

export function HojaDeVida({ id, canEdit, canDelete }: Props) {
  const router = useRouter()
  const [equipo,         setEquipo]         = useState<EquipoDetalle | null>(null)
  const [mantenimientos, setMantenimientos] = useState<HistReg[]>([])
  const [incidencias,    setIncidencias]    = useState<HistReg[]>([])
  const [cambios,        setCambios]        = useState<HistReg[]>([])
  const [movimientos,    setMovimientos]    = useState<HistReg[]>([])
  const [loading,        setLoading]        = useState(true)
  const [tab,            setTab]            = useState<TabKey>('detalles')
  const [editMode,       setEditMode]       = useState(false)
  const [editData,       setEditData]       = useState<EquipoDetalle>({})
  const [guardando,      setGuardando]      = useState(false)
  const [error,          setError]          = useState('')
  const [modalTipo,      setModalTipo]      = useState<'mantenimiento' | 'incidencia' | 'cambio' | null>(null)
  const [modalData,      setModalData]      = useState<Record<string, string>>({})
  const [guardandoModal, setGuardandoModal] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchEquipoDetalle(id)
      setEquipo(data.equipo)
      setEditData(data.equipo)
      setMantenimientos(data.mantenimientos ?? [])
      setIncidencias(data.incidencias ?? [])
      setCambios(data.cambios ?? [])
      setMovimientos(data.movimientos ?? [])
    } catch {
      router.push('/sistemas/equipos')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { cargar() }, [cargar])

  async function guardarEdicion() {
    setError('')
    if (!editData.tipo_equipo || !editData.marca) { setError('Tipo y marca son obligatorios'); return }
    setGuardando(true)
    try {
      const res = await actualizarEquipo(id, editData)
      if (res.error) { setError(res.error); return }
      setEditMode(false)
      cargar()
    } finally {
      setGuardando(false)
    }
  }

  async function handleEliminar() {
    if (!confirm(`¿Eliminar el equipo ${id}? Esta acción no se puede deshacer.`)) return
    await eliminarEquipo(id)
    router.push('/sistemas/equipos')
  }

  async function handleAgregarHistorial() {
    if (!modalTipo) return
    const requerido = modalTipo === 'incidencia' ? modalData.fecha_apertura : modalData.fecha
    if (!requerido) { alert('La fecha es obligatoria'); return }
    setGuardandoModal(true)
    try {
      const res = await agregarHistorial(id, modalTipo, modalData)
      if (res.error) { alert(res.error); return }
      setModalTipo(null); setModalData({}); cargar()
    } finally {
      setGuardandoModal(false)
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Cargando hoja de vida...</div>
  if (!equipo) return null

  const estado      = (equipo.estado as string) || 'Activo'
  const estadoStyle = ESTADOS_COLOR[estado] ?? { color: '#374151', bg: '#f3f4f6' }
  const ed          = editMode ? editData : equipo

  const TABS: [TabKey, string][] = [
    ['detalles',       'Detalles'],
    ['mantenimientos', `Mantenimientos (${mantenimientos.length})`],
    ['incidencias',    `Incidencias (${incidencias.length})`],
    ['cambios',        `Cambios (${cambios.length})`],
    ['movimientos',    `Movimientos (${movimientos.length})`],
  ]

  return (
    <div style={{ padding: '32px 28px', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <Link href="/sistemas/equipos" style={{ color: 'var(--text2)', textDecoration: 'none', fontSize: 14, whiteSpace: 'nowrap', paddingTop: 4 }}>← Inventario</Link>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', margin: 0 }}>{id}</h1>
            <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>{equipo.marca as string} {equipo.modelo as string}</span>
            <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600, color: estadoStyle.color, background: estadoStyle.bg }}>{estado}</span>
            <span style={{ fontSize: 13, color: 'var(--text2)', background: 'var(--border)', padding: '4px 10px', borderRadius: 20 }}>{equipo.tipo_equipo as string}</span>
          </div>
          {equipo.sede && (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text2)' }}>
              {equipo.sede as string}{equipo.area_ubicacion ? ` · ${equipo.area_ubicacion}` : ''}
              {equipo.responsable ? ` — Asignado a: ${equipo.responsable}` : ''}
            </p>
          )}
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 8 }}>
            {editMode ? (
              <>
                <button onClick={() => { setEditMode(false); setEditData(equipo); setError('') }}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', color: 'var(--text)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={guardarEdicion} disabled={guardando}
                  style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#0047BA', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: guardando ? 0.7 : 1 }}>
                  {guardando ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setEditMode(true)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', color: 'var(--text)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Editar</button>
                {canDelete && (
                  <button onClick={handleEliminar}
                    style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fff5f5', color: '#dc2626', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Eliminar</button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {error && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 16px', marginBottom: 16, color: '#991b1b', fontWeight: 600, fontSize: 13 }}>{error}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
        {TABS.map(([k, lbl]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '10px 18px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: 14, fontWeight: tab === k ? 700 : 500,
            color: tab === k ? 'var(--accent)' : 'var(--text2)',
            borderBottom: tab === k ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: -2,
          }}>{lbl}</button>
        ))}
      </div>

      {/* Tab: Detalles */}
      {tab === 'detalles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <CardDetalle titulo="Identificación">
            <Fila label="ID" value={id} />
            <Fila label="Tipo Equipo"   campo="tipo_equipo"   ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, tipo_equipo: v}))}   tipo="select" opciones={TIPOS_EQUIPO} />
            <Fila label="Marca"         campo="marca"         ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, marca: v}))} />
            <Fila label="Modelo"        campo="modelo"        ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, modelo: v}))} />
            <Fila label="N° Serie"      campo="numero_serie"  ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, numero_serie: v}))} />
            <Fila label="Placa Activo"  campo="placa_activo"  ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, placa_activo: v}))} />
          </CardDetalle>

          {(equipo.procesador || equipo.ram_capacidad || editMode) && (
            <CardDetalle titulo="Hardware">
              <Fila label="Procesador"    campo="procesador"           ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, procesador: v}))} />
              <Fila label="Núcleos"       campo="nucleos_procesador"   ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, nucleos_procesador: v}))} />
              <Fila label="Velocidad"     campo="velocidad_procesador" ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, velocidad_procesador: v}))} />
              <Fila label="RAM"           campo="ram_capacidad"        ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, ram_capacidad: v}))} />
              <Fila label="Tipo RAM"      campo="ram_tipo"             ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, ram_tipo: v}))} />
              <Fila label="Disco"         campo="disco_tipo"           ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, disco_tipo: v}))} />
              <Fila label="Cap. Disco"    campo="disco_capacidad"      ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, disco_capacidad: v}))} />
              <Fila label="Tarjeta Video" campo="tarjeta_video"        ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, tarjeta_video: v}))} />
            </CardDetalle>
          )}

          <CardDetalle titulo="Red — Adaptador 1">
            <Fila label="Tipo Conexión" campo="tipo_conexion" ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, tipo_conexion: v}))} />
            <Fila label="IP Asignada"   campo="ip_asignada"   ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, ip_asignada: v}))} />
            <Fila label="Máscara Subred" campo="mascara_subred" ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, mascara_subred: v}))} />
            <Fila label="Gateway"       campo="gateway"       ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, gateway: v}))} />
            <Fila label="MAC Address"   campo="mac_address"   ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, mac_address: v}))} />
            <Fila label="Hostname"      campo="hostname"      ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, hostname: v}))} />
            <Fila label="Dominio"       campo="dominio"       ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, dominio: v}))} />
          </CardDetalle>

          {(equipo.ip_asignada_2 || equipo.mac_address_2 || equipo.tipo_conexion_2 || editMode) && (
            <CardDetalle titulo="Red — Adaptador 2 (opcional)">
              <Fila label="Tipo Conexión" campo="tipo_conexion_2" ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, tipo_conexion_2: v}))} />
              <Fila label="IP Asignada"   campo="ip_asignada_2"   ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, ip_asignada_2: v}))} />
              <Fila label="Máscara Subred" campo="mascara_subred_2" ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, mascara_subred_2: v}))} />
              <Fila label="Gateway"       campo="gateway_2"       ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, gateway_2: v}))} />
              <Fila label="MAC Address"   campo="mac_address_2"   ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, mac_address_2: v}))} />
            </CardDetalle>
          )}

          {(equipo.sistema_operativo || equipo.antivirus || editMode) && (
            <CardDetalle titulo="Software">
              <Fila label="Sistema Operativo" campo="sistema_operativo" ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, sistema_operativo: v}))} />
              <Fila label="Versión SO"         campo="version_so"       ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, version_so: v}))} />
              <Fila label="Office"             campo="office_version"   ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, office_version: v}))} />
              <Fila label="Antivirus"          campo="antivirus"        ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, antivirus: v}))} />
            </CardDetalle>
          )}

          <CardDetalle titulo="Ubicación">
            <Fila label="Sede"             campo="sede"             ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, sede: v}))} />
            <Fila label="Área / Dpto."     campo="area_ubicacion"   ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, area_ubicacion: v}))} />
            <Fila label="Responsable"      campo="responsable"      ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, responsable: v}))} />
            <Fila label="Cargo Responsable" campo="cargo_responsable" ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, cargo_responsable: v}))} />
            <Fila label="Ext. Telefónica"  campo="ext_telefonica"   ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, ext_telefonica: v}))} />
          </CardDetalle>

          <CardDetalle titulo="Estado y Garantía">
            <Fila label="Estado"         campo="estado"             ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, estado: v}))} tipo="select" opciones={['Activo','Mantenimiento','Obsoleto','Baja']} />
            <Fila label="Condición"      campo="condicion_fisica"   ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, condicion_fisica: v}))} />
            <Fila label="F. Adquisición" campo="fecha_adquisicion"  ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, fecha_adquisicion: v}))} tipo="date" />
            <Fila label="Proveedor"      campo="proveedor"          ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, proveedor: v}))} />
            <Fila label="Garantía"       campo="tipo_garantia"      ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, tipo_garantia: v}))} />
            <Fila label="Fin Garantía"   campo="fecha_fin_garantia" ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, fecha_fin_garantia: v}))} tipo="date" />
          </CardDetalle>

          <CardDetalle titulo="Mantenimiento Preventivo">
            <Fila label="Tipo"       campo="tipo_mantenimiento"       ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, tipo_mantenimiento: v}))} />
            <Fila label="Frecuencia" campo="frecuencia_mantenimiento" ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, frecuencia_mantenimiento: v}))} />
            <Fila label="Último"     campo="ultimo_mantenimiento"     ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, ultimo_mantenimiento: v}))} tipo="date" />
            <Fila label="Próximo"    campo="proximo_mantenimiento"    ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, proximo_mantenimiento: v}))} tipo="date" />
            <Fila label="Técnico"    campo="tecnico_responsable"      ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, tecnico_responsable: v}))} />
          </CardDetalle>

          {(equipo.observaciones || editMode) && (
            <CardDetalle titulo="Observaciones">
              {editMode ? (
                <div style={{ padding: '10px 16px' }}>
                  <textarea value={(editData.observaciones as string) ?? ''} onChange={e => setEditData(p => ({...p, observaciones: e.target.value}))}
                    rows={4} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
              ) : (
                <div style={{ padding: '10px 16px' }}>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{equipo.observaciones as string || '—'}</p>
                </div>
              )}
            </CardDetalle>
          )}

          <p style={{ fontSize: 11, color: 'var(--text2)', textAlign: 'right' }}>
            Registrado por {equipo.usuario_registro as string} · {equipo.fecha_registro ? new Date(equipo.fecha_registro as string).toLocaleString('es-CO') : ''}
            {equipo.usuario_actualizacion ? ` · Actualizado por ${equipo.usuario_actualizacion}` : ''}
          </p>
        </div>
      )}

      {tab === 'mantenimientos' && <HistorialTab titulo="Historial de Mantenimientos"        tipo="mantenimientos" rows={mantenimientos} canAdd={canEdit} onAdd={() => { setModalTipo('mantenimiento'); setModalData({}) }} />}
      {tab === 'incidencias'    && <HistorialTab titulo="Historial de Incidencias / Tickets" tipo="incidencias"    rows={incidencias}    canAdd={canEdit} onAdd={() => { setModalTipo('incidencia');    setModalData({}) }} />}
      {tab === 'cambios'        && <HistorialTab titulo="Cambios en Componentes"              tipo="cambios"        rows={cambios}        canAdd={canEdit} onAdd={() => { setModalTipo('cambio');        setModalData({}) }} />}
      {tab === 'movimientos'    && <HistorialTab titulo="Historial de Movimientos TIC"        tipo="movimientos"    rows={movimientos}    canAdd={false}   onAdd={() => {}} />}

      {modalTipo && (
        <ModalHistorial
          tipo={modalTipo} data={modalData} guardando={guardandoModal}
          onClose={() => setModalTipo(null)} onChange={setModalData} onGuardar={handleAgregarHistorial}
        />
      )}
    </div>
  )
}
