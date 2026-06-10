'use client'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Equipo = Record<string, string | boolean | null>
type HistReg = Record<string, string | number | null>

const ESTADOS_COLOR: Record<string, { color: string; bg: string }> = {
  'Activo':        { color: '#065f46', bg: '#d1fae5' },
  'Mantenimiento': { color: '#92400e', bg: '#fef3c7' },
  'Obsoleto':      { color: '#991b1b', bg: '#fee2e2' },
  'Baja':          { color: '#374151', bg: '#f3f4f6' },
}

type TabKey = 'detalles' | 'mantenimientos' | 'incidencias' | 'cambios'

export default function HojaDeVidaPage() {
  const { data: session, status } = useSession()
  const router   = useRouter()
  const params   = useParams()
  const id       = params?.id as string

  const [equipo,         setEquipo]         = useState<Equipo | null>(null)
  const [mantenimientos, setMantenimientos] = useState<HistReg[]>([])
  const [incidencias,    setIncidencias]    = useState<HistReg[]>([])
  const [cambios,        setCambios]        = useState<HistReg[]>([])
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState<TabKey>('detalles')
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState<Equipo>({})
  const [guardando, setGuardando] = useState(false)
  const [error,    setError]    = useState('')
  const [modalTipo, setModalTipo] = useState<'mantenimiento' | 'incidencia' | 'cambio' | null>(null)
  const [modalData, setModalData] = useState<Record<string, string>>({})
  const [guardandoModal, setGuardandoModal] = useState(false)

  const area = session?.user?.area ?? 'logistica'
  const rol  = session?.user?.rol  ?? 'usuario'
  const canEdit   = area === 'sistemas' || area === 'general' || rol === 'admin'
  const canDelete = rol === 'admin'

  const cargar = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/sistemas/equipos/${id}`)
      if (!res.ok) { router.push('/sistemas/equipos'); return }
      const data = await res.json()
      setEquipo(data.equipo)
      setEditData(data.equipo)
      setMantenimientos(data.mantenimientos ?? [])
      setIncidencias(data.incidencias ?? [])
      setCambios(data.cambios ?? [])
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => {
    if (status === 'authenticated') cargar()
  }, [status, cargar])

  async function guardarEdicion() {
    setError('')
    if (!editData.tipo_equipo || !editData.marca) {
      setError('Tipo y marca son obligatorios')
      return
    }
    setGuardando(true)
    try {
      const res = await fetch(`/api/sistemas/equipos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error'); return }
      setEditMode(false)
      cargar()
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar() {
    if (!confirm(`¿Eliminar el equipo ${id}? Esta acción no se puede deshacer.`)) return
    await fetch(`/api/sistemas/equipos/${id}`, { method: 'DELETE' })
    router.push('/sistemas/equipos')
  }

  async function agregarHistorial() {
    if (!modalTipo) return
    const requerido = modalTipo === 'incidencia' ? modalData.fecha_apertura : modalData.fecha
    if (!requerido) { alert('La fecha es obligatoria'); return }
    setGuardandoModal(true)
    try {
      const res = await fetch(`/api/sistemas/equipos/${id}/historial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: modalTipo, ...modalData }),
      })
      if (res.ok) { setModalTipo(null); setModalData({}); cargar() }
      else { const d = await res.json(); alert(d.error ?? 'Error') }
    } finally {
      setGuardandoModal(false)
    }
  }

  if (loading || status === 'loading') {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Cargando hoja de vida...</div>
  }
  if (!equipo) return null

  const estado      = (equipo.estado as string) || 'Activo'
  const estadoStyle = ESTADOS_COLOR[estado] ?? { color: '#374151', bg: '#f3f4f6' }
  const ed          = editMode ? editData : equipo

  return (
    <div style={{ padding: '32px 28px', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <Link href="/sistemas/equipos" style={{ color: 'var(--text2)', textDecoration: 'none', fontSize: 14, whiteSpace: 'nowrap', paddingTop: 4 }}>
          ← Inventario
        </Link>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', margin: 0 }}>{id}</h1>
            <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>
              {equipo.marca as string} {equipo.modelo as string}
            </span>
            <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600, color: estadoStyle.color, background: estadoStyle.bg }}>
              {estado}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text2)', background: 'var(--border)', padding: '4px 10px', borderRadius: 20 }}>
              {equipo.tipo_equipo as string}
            </span>
          </div>
          {equipo.sede && (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text2)' }}>
              {equipo.sede as string}{equipo.area_ubicacion ? ` · ${equipo.area_ubicacion}` : ''}
              {equipo.usuario_asignado ? ` — Asignado a: ${equipo.usuario_asignado}` : ''}
            </p>
          )}
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 8 }}>
            {editMode ? (
              <>
                <button onClick={() => { setEditMode(false); setEditData(equipo); setError('') }}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', color: 'var(--text)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={guardarEdicion} disabled={guardando}
                  style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#0047BA', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: guardando ? 0.7 : 1 }}>
                  {guardando ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setEditMode(true)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', color: 'var(--text)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Editar
                </button>
                {canDelete && (
                  <button onClick={eliminar}
                    style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fff5f5', color: '#dc2626', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    Eliminar
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {error && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 16px', marginBottom: 16, color: '#991b1b', fontWeight: 600, fontSize: 13 }}>{error}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
        {([
          ['detalles',       `Detalles`],
          ['mantenimientos', `Mantenimientos (${mantenimientos.length})`],
          ['incidencias',    `Incidencias (${incidencias.length})`],
          ['cambios',        `Cambios (${cambios.length})`],
        ] as [TabKey, string][]).map(([k, lbl]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '10px 18px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: 14, fontWeight: tab === k ? 700 : 500,
            color: tab === k ? 'var(--accent)' : 'var(--text2)',
            borderBottom: tab === k ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: -2,
          }}>{lbl}</button>
        ))}
      </div>

      {/* Tab: Detalles */}
      {tab === 'detalles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <CardDetalle titulo="Identificación">
            <Fila label="ID" value={id} />
            <Fila label="Tipo Equipo"    campo="tipo_equipo"    ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, tipo_equipo: v}))} tipo="select"
              opciones={['Computador Desktop','Laptop','Servidor','All-in-One','Switch','Router','Access Point','Firewall','Monitor/Pantalla','Impresora Láser B/N','Impresora Láser Color','Impresora Multifuncional','Impresora Inyección','Impresora Térmica','Impresora Etiquetas','Plotter','UPS/Regulador','Tablet','Teléfono IP','Cámara IP/CCTV','NAS','Proyector','Escáner','Terminal POS','Lector de Código de Barras','Otro']} />
            <Fila label="Marca"         campo="marca"           ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, marca: v}))} />
            <Fila label="Modelo"        campo="modelo"          ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, modelo: v}))} />
            <Fila label="N° Serie"      campo="numero_serie"    ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, numero_serie: v}))} />
            <Fila label="N° Interno"    campo="numero_interno"  ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, numero_interno: v}))} />
            <Fila label="Placa Activo"  campo="placa_activo"    ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, placa_activo: v}))} />
            <Fila label="Cód. Barras"   campo="cod_barras"      ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, cod_barras: v}))} />
          </CardDetalle>

          {(equipo.procesador || equipo.ram_capacidad || editMode) && (
            <CardDetalle titulo="Hardware">
              <Fila label="Procesador"     campo="procesador"           ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, procesador: v}))} />
              <Fila label="Núcleos"        campo="nucleos_procesador"   ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, nucleos_procesador: v}))} />
              <Fila label="Velocidad"      campo="velocidad_procesador" ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, velocidad_procesador: v}))} />
              <Fila label="RAM"            campo="ram_capacidad"        ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, ram_capacidad: v}))} />
              <Fila label="Tipo RAM"       campo="ram_tipo"             ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, ram_tipo: v}))} />
              <Fila label="Disco"          campo="disco_tipo"           ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, disco_tipo: v}))} />
              <Fila label="Cap. Disco"     campo="disco_capacidad"      ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, disco_capacidad: v}))} />
              <Fila label="Tarjeta Video"  campo="tarjeta_video"        ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, tarjeta_video: v}))} />
            </CardDetalle>
          )}

          <CardDetalle titulo="Red">
            <Fila label="IP Asignada"   campo="ip_asignada"   ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, ip_asignada: v}))} />
            <Fila label="MAC Address"   campo="mac_address"   ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, mac_address: v}))} />
            <Fila label="Hostname"      campo="hostname"      ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, hostname: v}))} />
            <Fila label="Tipo Conexión" campo="tipo_conexion" ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, tipo_conexion: v}))} />
            <Fila label="Dominio"       campo="dominio"       ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, dominio: v}))} />
          </CardDetalle>

          {(equipo.sistema_operativo || equipo.antivirus || editMode) && (
            <CardDetalle titulo="Software">
              <Fila label="Sistema Operativo" campo="sistema_operativo" ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, sistema_operativo: v}))} />
              <Fila label="Versión SO"         campo="version_so"        ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, version_so: v}))} />
              <Fila label="Office"             campo="office_version"    ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, office_version: v}))} />
              <Fila label="Antivirus"          campo="antivirus"         ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, antivirus: v}))} />
            </CardDetalle>
          )}

          <CardDetalle titulo="Ubicación">
            <Fila label="Sede"             campo="sede"              ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, sede: v}))} />
            <Fila label="Área / Dpto."     campo="area_ubicacion"    ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, area_ubicacion: v}))} />
            <Fila label="Responsable"      campo="responsable"       ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, responsable: v}))} />
            <Fila label="Usuario Asignado" campo="usuario_asignado"  ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, usuario_asignado: v}))} />
            <Fila label="Piso / Oficina"   campo="piso_oficina"      ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, piso_oficina: v}))} />
          </CardDetalle>

          <CardDetalle titulo="Estado y Garantía">
            <Fila label="Estado"        campo="estado"              ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, estado: v}))}
              tipo="select" opciones={['Activo','Mantenimiento','Obsoleto','Baja']} />
            <Fila label="Condición"     campo="condicion_fisica"    ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, condicion_fisica: v}))} />
            <Fila label="F. Adquisición" campo="fecha_adquisicion"  ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, fecha_adquisicion: v}))} tipo="date" />
            <Fila label="Proveedor"     campo="proveedor"           ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, proveedor: v}))} />
            <Fila label="Garantía"      campo="tipo_garantia"       ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, tipo_garantia: v}))} />
            <Fila label="Fin Garantía"  campo="fecha_fin_garantia"  ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, fecha_fin_garantia: v}))} tipo="date" />
          </CardDetalle>

          <CardDetalle titulo="Mantenimiento Preventivo">
            <Fila label="Tipo"           campo="tipo_mantenimiento"       ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, tipo_mantenimiento: v}))} />
            <Fila label="Frecuencia"     campo="frecuencia_mantenimiento" ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, frecuencia_mantenimiento: v}))} />
            <Fila label="Último"         campo="ultimo_mantenimiento"     ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, ultimo_mantenimiento: v}))} tipo="date" />
            <Fila label="Próximo"        campo="proximo_mantenimiento"    ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, proximo_mantenimiento: v}))} tipo="date" />
            <Fila label="Técnico"        campo="tecnico_responsable"      ed={ed} editMode={editMode} onChange={v => setEditData(p => ({...p, tecnico_responsable: v}))} />
          </CardDetalle>

          {(equipo.observaciones || editMode) && (
            <CardDetalle titulo="Observaciones">
              {editMode ? (
                <textarea value={(editData.observaciones as string) ?? ''} onChange={e => setEditData(p => ({...p, observaciones: e.target.value}))}
                  rows={4} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{equipo.observaciones as string || '—'}</p>
              )}
            </CardDetalle>
          )}

          <p style={{ fontSize: 11, color: 'var(--text2)', textAlign: 'right' }}>
            Registrado por {equipo.usuario_registro as string} · {equipo.fecha_registro ? new Date(equipo.fecha_registro as string).toLocaleString('es-CO') : ''}
            {equipo.usuario_actualizacion ? ` · Actualizado por ${equipo.usuario_actualizacion}` : ''}
          </p>
        </div>
      )}

      {/* Tab: Mantenimientos */}
      {tab === 'mantenimientos' && (
        <HistorialTab
          titulo="Historial de Mantenimientos"
          columnas={['Fecha','Tipo','Descripción','Técnico','Empresa','Costo','Próxima Fecha']}
          rows={mantenimientos}
          getRow={r => [
            fmtFecha(r.fecha as string), r.tipo as string,
            r.descripcion as string, r.tecnico as string,
            r.empresa as string, r.costo ? `$${Number(r.costo).toLocaleString('es-CO')}` : '',
            fmtFecha(r.proxima_fecha as string),
          ]}
          canAdd={canEdit}
          onAdd={() => { setModalTipo('mantenimiento'); setModalData({}) }}
        />
      )}

      {/* Tab: Incidencias */}
      {tab === 'incidencias' && (
        <HistorialTab
          titulo="Historial de Incidencias / Tickets"
          columnas={['Ticket','Apertura','Cierre','Tipo','Descripción','Prioridad','Estado']}
          rows={incidencias}
          getRow={r => [
            r.ticket_id as string, fmtFecha(r.fecha_apertura as string),
            fmtFecha(r.fecha_cierre as string), r.tipo as string,
            r.descripcion as string, r.prioridad as string, r.estado_ticket as string,
          ]}
          canAdd={canEdit}
          onAdd={() => { setModalTipo('incidencia'); setModalData({}) }}
        />
      )}

      {/* Tab: Cambios */}
      {tab === 'cambios' && (
        <HistorialTab
          titulo="Cambios en Componentes"
          columnas={['Fecha','Componente','Anterior','Nuevo','Motivo','Técnico']}
          rows={cambios}
          getRow={r => [
            fmtFecha(r.fecha as string), r.componente as string,
            r.descripcion_anterior as string, r.descripcion_nuevo as string,
            r.motivo as string, r.tecnico as string,
          ]}
          canAdd={canEdit}
          onAdd={() => { setModalTipo('cambio'); setModalData({}) }}
        />
      )}

      {/* Modal agregar historial */}
      {modalTipo && (
        <div onClick={() => setModalTipo(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 28, maxWidth: 520, width: '90%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
              {modalTipo === 'mantenimiento' ? 'Nuevo Mantenimiento' : modalTipo === 'incidencia' ? 'Nueva Incidencia' : 'Cambio de Componente'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {modalTipo === 'mantenimiento' && <ModalMant data={modalData} setData={setModalData} />}
              {modalTipo === 'incidencia'    && <ModalInc  data={modalData} setData={setModalData} />}
              {modalTipo === 'cambio'        && <ModalCambio data={modalData} setData={setModalData} />}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setModalTipo(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={agregarHistorial} disabled={guardandoModal} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#0047BA', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: guardandoModal ? 0.7 : 1 }}>
                {guardandoModal ? 'Guardando...' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helpers de formato ──────────────────────────────────

function fmtFecha(s: string | null | undefined): string {
  if (!s) return '—'
  try { return new Date(s).toLocaleDateString('es-CO') } catch { return s }
}

// ── Componentes auxiliares ──────────────────────────────

function CardDetalle({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ background: 'var(--accent)', padding: '8px 16px' }}>
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{titulo}</h3>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 0 }}>
        {children}
      </div>
    </div>
  )
}

function Fila({ label, value, campo, ed, editMode, onChange, tipo, opciones }:
  { label: string; value?: string; campo?: string; ed?: Equipo; editMode?: boolean; onChange?: (v: string) => void; tipo?: string; opciones?: string[] }) {
  const val = campo && ed ? (ed[campo] as string ?? '') : (value ?? '')
  return (
    <div style={{ padding: '10px 16px', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</div>
      {editMode && onChange ? (
        tipo === 'select' && opciones ? (
          <select value={val} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: '#fff' }}>
            {opciones.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input type={tipo ?? 'text'} value={val} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }} />
        )
      ) : (
        <div style={{ fontSize: 13, color: val ? 'var(--text)' : 'var(--text2)', fontWeight: val ? 500 : 400 }}>{val || '—'}</div>
      )}
    </div>
  )
}

function HistorialTab({ titulo, columnas, rows, getRow, canAdd, onAdd }:
  { titulo: string; columnas: string[]; rows: HistReg[]; getRow: (r: HistReg) => (string | null)[]; canAdd: boolean; onAdd: () => void }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{titulo}</h2>
        {canAdd && (
          <button onClick={onAdd} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#0047BA', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            + Agregar
          </button>
        )}
      </div>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="inv-table">
            <thead>
              <tr>{columnas.map(c => <th key={c}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={columnas.length} style={{ padding: 32, textAlign: 'center', color: 'var(--text2)' }}>Sin registros</td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={i}>
                  {getRow(r).map((cell, j) => <td key={j}>{cell ?? '—'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Formularios de los modales
function MI({ label, k, data, setData, type = 'text', placeholder }: { label: string; k: string; data: Record<string,string>; setData: (d: Record<string,string>) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>{label}</label>
      <input type={type} value={data[k] ?? ''} onChange={e => setData({ ...data, [k]: e.target.value })} placeholder={placeholder}
        style={{ width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
    </div>
  )
}

function ModalMant({ data, setData }: { data: Record<string,string>; setData: (d: Record<string,string>) => void }) {
  return <>
    <MI label="Fecha *" k="fecha" data={data} setData={setData} type="date" />
    <MI label="Tipo de Mantenimiento" k="tipo_mant" data={data} setData={setData} placeholder="Ej: Preventivo, Correctivo" />
    <MI label="Descripción" k="descripcion" data={data} setData={setData} placeholder="Qué se realizó..." />
    <MI label="Técnico" k="tecnico" data={data} setData={setData} />
    <MI label="Empresa" k="empresa" data={data} setData={setData} />
    <MI label="Costo ($)" k="costo" data={data} setData={setData} type="number" />
    <MI label="Próxima Fecha" k="proxima_fecha" data={data} setData={setData} type="date" />
    <MI label="Observaciones" k="observaciones" data={data} setData={setData} />
  </>
}

function ModalInc({ data, setData }: { data: Record<string,string>; setData: (d: Record<string,string>) => void }) {
  return <>
    <MI label="Ticket / ID" k="ticket_id" data={data} setData={setData} placeholder="Ej: TK-2024-001" />
    <MI label="Fecha Apertura *" k="fecha_apertura" data={data} setData={setData} type="date" />
    <MI label="Tipo" k="tipo_inc" data={data} setData={setData} placeholder="Ej: Hardware, Software, Red" />
    <MI label="Descripción" k="descripcion" data={data} setData={setData} placeholder="Qué ocurrió..." />
    <MI label="Prioridad" k="prioridad" data={data} setData={setData} placeholder="Alta, Media, Baja" />
    <MI label="Técnico Asignado" k="tecnico" data={data} setData={setData} />
    <MI label="Solución" k="solucion" data={data} setData={setData} />
    <MI label="Fecha Cierre" k="fecha_cierre" data={data} setData={setData} type="date" />
    <MI label="Estado" k="estado_ticket" data={data} setData={setData} placeholder="Abierto, En proceso, Cerrado" />
  </>
}

function ModalCambio({ data, setData }: { data: Record<string,string>; setData: (d: Record<string,string>) => void }) {
  return <>
    <MI label="Fecha *" k="fecha" data={data} setData={setData} type="date" />
    <MI label="Componente" k="componente" data={data} setData={setData} placeholder="Ej: RAM, Disco, Procesador" />
    <MI label="Descripción Anterior" k="descripcion_anterior" data={data} setData={setData} placeholder="Qué tenía antes..." />
    <MI label="Descripción Nuevo" k="descripcion_nuevo" data={data} setData={setData} placeholder="Qué se instaló..." />
    <MI label="Motivo" k="motivo" data={data} setData={setData} placeholder="Ej: Falla, Upgrade, Reemplazo" />
    <MI label="Técnico" k="tecnico" data={data} setData={setData} />
    <MI label="Observaciones" k="observaciones" data={data} setData={setData} />
  </>
}
