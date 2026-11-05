'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BodegaSelect } from './BodegaSelect'
import { enlaceGmail, type SucursalListado } from '@/lib/cen/sucursalesPunto'

const inp: React.CSSProperties = { padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14, width: '100%' }
const etiqueta: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--text2)' }

type ColumnaOrden = 'sucursal' | 'razon_social' | 'ciudad' | 'direccion' | 'estado'
const COLUMNAS: { col: ColumnaOrden; titulo: string; ancho?: number }[] = [
  { col: 'sucursal', titulo: 'Suc.', ancho: 64 },
  { col: 'razon_social', titulo: 'Razón social' },
  { col: 'ciudad', titulo: 'Ciudad' },
  { col: 'direccion', titulo: 'Dirección' },
  { col: 'estado', titulo: 'Estado', ancho: 170 },
]

type Datos = {
  nit: string; cadena: string; numeroOrden: string | null
  sucursales: SucursalListado[]; errorSiesa: string | null
  solicitud: { usuario: string; created_at: string } | null
  correo: { para: string[]; cc: string[]; asunto: string; cuerpo: string }
}

// Homologa un EAN de punto de entrega con la sucursal de Siesa. Se hace una sola vez por
// tienda: las siguientes órdenes con ese EAN entran ya asociadas. Las sucursales del NIT se
// traen en vivo de Siesa (con dirección y ciudad de la base importada) y se escoge con un
// clic. Si la sucursal no existe en Siesa, se avisa por correo desde Gmail con la OC en PDF.
export function AsignarPuntoModal({ ean, onClose, onGuardado }: { ean: string; onClose: () => void; onGuardado: (n: number) => void }) {
  const [nit, setNit] = useState('')
  const [datos, setDatos] = useState<Datos | null>(null)
  const [cargando, setCargando] = useState(true)
  const [buscar, setBuscar] = useState('')
  const [elegida, setElegida] = useState<SucursalListado | null>(null)
  const [bodega, setBodega] = useState('00110')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  // Respaldo si Siesa no responde: escribir NIT, sucursal y razón social a mano
  const [manual, setManual] = useState(false)
  const [sucManual, setSucManual] = useState('')
  const [razonManual, setRazonManual] = useState('')
  // Aviso de "sucursal no creada"
  const [avisando, setAvisando] = useState(false)
  const [asunto, setAsunto] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const [avisoEnviado, setAvisoEnviado] = useState(false)

  const cargar = useCallback(async (nitBuscado?: string) => {
    setCargando(true); setError(''); setElegida(null)
    try {
      const q = new URLSearchParams({ ean, ...(nitBuscado ? { nit: nitBuscado } : {}) })
      const res = await fetch(`/api/logistica/ordenes-cen/puntos/sucursales?${q}`)
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'No se pudieron cargar las sucursales'); return }
      setDatos(d); setNit(d.nit); setAsunto(d.correo.asunto); setCuerpo(d.correo.cuerpo)
      if (d.errorSiesa) setManual(true)
    } finally { setCargando(false) }
  }, [ean])

  useEffect(() => { cargar() }, [cargar])

  // Orden de la tabla: clic en un encabezado ordena por esa columna; otro clic invierte el orden.
  // Sin columna elegida queda el orden de Siesa (activas primero, por código).
  const [orden, setOrden] = useState<{ col: ColumnaOrden; asc: boolean } | null>(null)
  function ordenarPor(col: ColumnaOrden) {
    setOrden(o => (o?.col === col ? { col, asc: !o.asc } : { col, asc: true }))
  }

  const visibles = useMemo(() => {
    const t = buscar.trim().toUpperCase()
    const lista = datos?.sucursales ?? []
    const filtradas = t ? lista.filter(s => [s.sucursal, s.razon_social, s.ciudad, s.departamento, s.direccion].some(v => (v ?? '').toUpperCase().includes(t))) : lista
    if (!orden) return filtradas
    const valor = (s: SucursalListado) => {
      if (orden.col === 'ciudad') return [s.ciudad, s.departamento].filter(Boolean).join(', ')
      if (orden.col === 'estado') return `${s.activa ? 1 : 0}${s.sinDireccion ? 0 : 1}${String(s.eans.length).padStart(3, '0')}`
      return s[orden.col] ?? ''
    }
    // Las vacías ("—") siempre al final, en cualquier sentido
    return [...filtradas].sort((a, b) => {
      const va = valor(a), vb = valor(b)
      if (!va !== !vb) return va ? -1 : 1
      const r = va.localeCompare(vb, 'es', { numeric: true, sensitivity: 'base' })
      return orden.asc ? r : -r
    })
  }, [datos, buscar, orden])

  async function guardar() {
    setError(''); setGuardando(true)
    try {
      const sucursal = manual ? sucManual : elegida?.sucursal
      const razon = manual ? razonManual : elegida?.razon_social
      const res = await fetch('/api/logistica/ordenes-cen/puntos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ean, nit, sucursal, razon_social: razon, bodega }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'No se pudo guardar'); return }
      onGuardado(data.ordenesActualizadas)
    } finally { setGuardando(false) }
  }

  // Gmail se abre en el mismo clic (si se abre después de esperar al servidor, el navegador lo bloquea);
  // la constancia de la solicitud se guarda enseguida.
  function abrirGmail() {
    if (!datos) return
    window.open(enlaceGmail({ para: datos.correo.para, cc: datos.correo.cc, asunto, cuerpo }), '_blank', 'noopener')
    fetch('/api/logistica/ordenes-cen/puntos/sucursales', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ean, nit }),
    }).then(r => { if (r.ok) setAvisoEnviado(true) })
  }

  const puedeGuardar = nit && (manual ? sucManual && razonManual : elegida)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(4px, 2vw, 16px)' }}>
      {/* Ancho: casi toda la pantalla hasta 1280 px; en celular ocupa todo y la tabla se desplaza de lado */}
      <div onClick={e => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 1280, maxHeight: '94vh', overflowY: 'auto', padding: 'clamp(12px, 2.5vw, 24px)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Asignar sucursal de Siesa</h2>
        <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 12 }}>
          {datos?.cadena ? <>{datos.cadena} · </> : null}EAN del punto de entrega <strong>{ean}</strong>. Al guardarlo, todas sus órdenes quedan asociadas y las próximas entran solas.
        </p>

        {datos?.solicitud && (
          <div style={{ background: '#FEF3C7', color: '#92400E', borderRadius: 6, padding: '8px 10px', fontSize: 13, marginBottom: 12 }}>
            ✉ Ya se pidió crear esta sucursal en Siesa: {new Date(datos.solicitud.created_at).toLocaleString('es-CO')} por {datos.solicitud.usuario}.
            Cuando la creen, aparece en el listado.
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
          <label style={{ ...etiqueta, flex: '0 0 200px' }}>NIT DEL CLIENTE
            <input value={nit} onChange={e => setNit(e.target.value.replace(/\D/g, ''))} style={inp} placeholder="890900608" />
          </label>
          <button className="btn" onClick={() => cargar(nit)} disabled={!nit || cargando}>Ver sucursales</button>
          {!manual && datos && datos.sucursales.length > 0 && (
            <label style={{ ...etiqueta, flex: 1, minWidth: 200 }}>BUSCAR
              <input value={buscar} onChange={e => setBuscar(e.target.value)} style={inp} placeholder="Código, nombre, ciudad o dirección" />
            </label>
          )}
        </div>

        {cargando && <div style={{ padding: 16, color: 'var(--text2)', fontSize: 13 }}>Consultando las sucursales en Siesa...</div>}
        {!cargando && datos?.errorSiesa && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>{datos.errorSiesa} Puedes escribir los datos a mano.</div>}

        {!cargando && !manual && datos && (
          datos.sucursales.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text2)', padding: 8 }}>{nit ? `Siesa no tiene sucursales para el NIT ${nit}.` : 'Escribe el NIT del cliente.'}</div>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: 'min(52vh, 460px)', overflow: 'auto' }}>
              <table style={{ width: '100%', minWidth: 720, fontSize: 12, borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 1 }}>
                  <tr>
                    <th style={{ width: 32 }} />
                    {COLUMNAS.map(c => (
                      <th key={c.col} style={{ textAlign: 'left', padding: 0, width: c.ancho }}
                        aria-sort={orden?.col === c.col ? (orden.asc ? 'ascending' : 'descending') : 'none'}>
                        <button type="button" onClick={() => ordenarPor(c.col)} title={`Ordenar por ${c.titulo.toLowerCase()}`}
                          style={{ all: 'unset', cursor: 'pointer', display: 'flex', gap: 4, alignItems: 'center', width: '100%', padding: '8px', fontWeight: 700, boxSizing: 'border-box' }}>
                          {c.titulo}
                          <span style={{ color: orden?.col === c.col ? 'var(--primary, #1E40AF)' : 'var(--text2)', opacity: orden?.col === c.col ? 1 : 0.45, fontSize: 11 }}>
                            {orden?.col === c.col ? (orden.asc ? '▲' : '▼') : '↕'}
                          </span>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibles.map(s => (
                    <tr key={s.sucursal} onClick={() => s.activa && setElegida(s)}
                      style={{ cursor: s.activa ? 'pointer' : 'not-allowed', opacity: s.activa ? 1 : 0.55, borderTop: '1px solid var(--border)',
                        background: elegida?.sucursal === s.sucursal ? '#E0ECFF' : undefined }}>
                      <td style={{ padding: '6px 8px' }}><input type="radio" checked={elegida?.sucursal === s.sucursal} disabled={!s.activa} onChange={() => setElegida(s)} aria-label={`Sucursal ${s.sucursal}`} /></td>
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{s.sucursal}</td>
                      <td style={{ padding: '6px 8px' }}>{s.razon_social}</td>
                      <td style={{ padding: '6px 8px' }}>{[s.ciudad, s.departamento].filter(Boolean).join(', ') || '—'}</td>
                      <td style={{ padding: '6px 8px' }}>{s.direccion ?? '—'}</td>
                      <td style={{ padding: '6px 8px', fontSize: 11 }}>
                        {!s.activa && <span style={{ color: '#991B1B' }}>⛔ Inactiva en Siesa</span>}
                        {s.activa && s.sinDireccion && <span style={{ color: '#92400E' }}>⚠ Sin dirección en el sistema</span>}
                        {s.eans.length > 0 && <div style={{ color: 'var(--text2)' }}>Ya tiene {s.eans.length} EAN</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {manual && (
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={etiqueta}>SUCURSAL<input value={sucManual} onChange={e => setSucManual(e.target.value)} maxLength={3} style={inp} placeholder="001" /></label>
            <label style={etiqueta}>RAZÓN SOCIAL DE LA SUCURSAL<input value={razonManual} onChange={e => setRazonManual(e.target.value)} maxLength={100} style={inp} placeholder="ALMACENES EXITO CEDI VEGAS" /></label>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 12 }}>
          <label style={{ ...etiqueta, flex: 1, minWidth: 240 }}>BODEGA DE DESPACHO
            <BodegaSelect value={bodega} onChange={setBodega} style={inp} />
          </label>
          {elegida && !manual && <div style={{ fontSize: 13 }}>Seleccionada: <strong>{elegida.sucursal}</strong> · {elegida.razon_social}</div>}
        </div>

        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', marginTop: 16 }}>
          <button className="btn" style={{ marginRight: 'auto', fontSize: 12 }} onClick={() => setAvisando(v => !v)} disabled={!datos}>
            ✉ La sucursal no está creada en Siesa
          </button>
          {!manual && <button className="btn" style={{ fontSize: 12 }} onClick={() => setManual(true)}>Escribir a mano</button>}
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardar} disabled={guardando || !puedeGuardar}>{guardando ? 'Guardando...' : 'Guardar'}</button>
        </div>

        {avisando && datos && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginTop: 12, display: 'grid', gap: 8 }}>
            <strong style={{ fontSize: 14 }}>Avisar que la sucursal no está creada</strong>
            {datos.correo.para.length === 0 ? (
              <div style={{ color: 'var(--danger)', fontSize: 13 }}>Faltan los destinatarios del aviso: configurar CORREO_SUCURSALES_PARA (y CORREO_SUCURSALES_CC) en Vercel.</div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                  Para: {datos.correo.para.join(', ')}{datos.correo.cc.length > 0 && <> · CC: {datos.correo.cc.join(', ')}</>}
                </div>
                <label style={etiqueta}>ASUNTO<input value={asunto} onChange={e => setAsunto(e.target.value)} style={inp} maxLength={200} /></label>
                <label style={etiqueta}>CONTENIDO<textarea value={cuerpo} onChange={e => setCuerpo(e.target.value)} style={{ ...inp, minHeight: 150, fontFamily: 'inherit' }} /></label>
                <div style={{ fontSize: 13, background: '#E0ECFF', color: '#1E3A8A', borderRadius: 6, padding: '8px 10px' }}>
                  Se abre Gmail con el correo ya escrito. Ahí <strong>adjunta el PDF de la orden de compra</strong> que descargas de la plataforma del CEN y dale Enviar.
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {avisoEnviado && <span style={{ fontSize: 13, color: '#065F46' }}>✓ Quedó registrado que se pidió la sucursal.</span>}
                  <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={abrirGmail} disabled={!asunto.trim()}>Abrir correo en Gmail</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
