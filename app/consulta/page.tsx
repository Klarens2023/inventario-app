'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { exportarExcel } from '@/lib/exportExcel'
import type { Modo, Row, EditState } from '@/types/consulta'
import { getFechas, getInventario, putConteo, postAcumulaciones } from '@/lib/api/consulta'
import { fmt, evaluarConteo } from '@/components/consulta/utils'
import { HeaderBar } from '@/components/consulta/HeaderBar'
import { StatsCards } from '@/components/consulta/StatsCards'
import { TablaConteo } from '@/components/consulta/TablaConteo'

export default function ConsultaPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.rol === 'admin'

  const [modo,      setModo]      = useState<Modo>('items')
  const [fechas,    setFechas]    = useState<string[]>([])
  const [fecha,     setFecha]     = useState('')
  const [tipoSel,   setTipoSel]   = useState('todos')
  const [bodegaSel, setBodegaSel] = useState('todas')
  const [loteSel,   setLoteSel]   = useState('todos')
  const [rows,      setRows]      = useState<Row[]>([])
  const [loading,   setLoading]   = useState(false)
  const [acumulando,setAcum]      = useState(false)
  const [edits,     setEdits]     = useState<Record<number, EditState>>({})
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  const puedeEditar = useCallback((row: Row) => {
    if (row.acumulado) return false
    if (isAdmin) return true
    return String(row.cargado_por) === session?.user?.id
  }, [isAdmin, session?.user?.id])

  // Cargar fechas disponibles al cambiar de modo
  useEffect(() => {
    setFecha(''); setRows([]); setEdits({})
    getFechas(modo).then(fs => {
      setFechas(fs)
      if (fs.length > 0) setFecha(fs[0])
    })
  }, [modo])

  // Cargar filas al cambiar fecha
  useEffect(() => {
    if (!fecha) return
    setLoading(true); setBodegaSel('todas'); setTipoSel('todos'); setLoteSel('todos')
    getInventario(fecha, modo).then(rowsData => {
      const init: Record<number, EditState> = {}
      rowsData.forEach(r => { init[r.id] = { conteo: r.conteo_fisico > 0 ? String(r.conteo_fisico) : '', obs: r.observaciones || '', status: 'idle' } })
      setRows(rowsData); setEdits(init); setLoading(false)
    })
  }, [fecha, modo])

  useEffect(() => { setTipoSel('todos') }, [bodegaSel])

  const autoguardar = useCallback((id: number, conteo: string, obs: string) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], status: 'saving' } }))
    if (timers.current[id]) clearTimeout(timers.current[id])
    timers.current[id] = setTimeout(async () => {
      try {
        await putConteo(id, conteo !== '' ? Number(conteo) : null, obs || null)
        setEdits(prev => ({ ...prev, [id]: { ...prev[id], status: 'saved' } }))
        setTimeout(() => setEdits(prev => ({ ...prev, [id]: { ...prev[id], status: 'idle' } })), 2000)
      } catch { setEdits(prev => ({ ...prev, [id]: { ...prev[id], status: 'error' } })) }
    }, 1000)
  }, [])

  function handleChange(id: number, field: 'conteo' | 'obs', value: string) {
    const current = edits[id]
    setEdits(prev => ({ ...prev, [id]: { ...current, [field]: value, status: 'saving' } }))
    // Para conteo solo autoguarda si NO tiene operadores (mientras escribe la expresión no guarda)
    if (field === 'obs' || !/[+\-*]/.test(value)) {
      autoguardar(id, field === 'conteo' ? value : current.conteo, field === 'obs' ? value : current.obs)
    }
  }

  function resolverConteo(id: number) {
    const e = edits[id]
    if (!e || !e.conteo) return
    const resultado = evaluarConteo(e.conteo)
    if (resultado === e.conteo) return
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], conteo: resultado } }))
    autoguardar(id, resultado, e.obs)
  }

  async function acumular() {
    if (Object.values(edits).some(e => e.status === 'saving')) { alert('Hay cambios guardandose. Espera un momento.'); return }
    const pendientes = rowsMostradas.filter(r => puedeEditar(r))
    if (pendientes.length === 0) { alert('No hay registros por acumular en el filtro actual.'); return }
    const filtroDesc = tipoSel !== 'todos' ? `tipo "${tipoSel}"` : bodegaSel !== 'todas' ? `bodega "${bodegaSel}"` : 'todos'
    if (!confirm(`Acumular ${pendientes.length} registros (${filtroDesc})?\n\nUna vez acumulados no podrán modificarse.`)) return
    setAcum(true)
    for (const row of pendientes) {
      const e = edits[row.id]; if (!e) continue
      await putConteo(row.id, e.conteo !== '' ? Number(e.conteo) : null, e.obs || null)
    }
    const ids = pendientes.map(r => r.id)
    await postAcumulaciones(ids, fecha)
    setRows(prev => prev.map(r => ids.includes(r.id) ? { ...r, acumulado: true } : r))
    setAcum(false)
    alert(`Listo! ${ids.length} registros acumulados y bloqueados.`)
  }

  async function exportar() {
    const cols = modo === 'lotes'
      ? ['Referencia','Lote','Descripcion','Loc','UM','Tipo','Cant Sistema','Conteo Fisico','Diferencia','Costo Unitario','Costo Diferencia','Costo Bodega','Observaciones']
      : ['Referencia','Descripcion','Loc','UM','Tipo','Cant Sistema','Conteo Fisico','Diferencia','Costo Unitario','Costo Diferencia','Costo Bodega','Observaciones']
    const filas = rows.map(r => {
      const e = edits[r.id]
      const conteo = e?.conteo !== '' ? Number(e?.conteo) : 0
      const dif    = conteo - Number(r.cantidad_sistema)
      const base = [r.descripcion, r.localizacion, r.um, r.tipo, Number(r.cantidad_sistema), conteo || '', dif || '', Number(r.costo_unitario), dif * Number(r.costo_unitario) || '', Number(r.costo_bodega), e?.obs || '']
      return modo === 'lotes'
        ? [r.referencia, r.lote || '', ...base]
        : [r.referencia, ...base]
    })
    await exportarExcel(`Conteo_${modo}_${tipoSel}_${fecha}`, cols, filas as any, session?.user?.name ?? undefined)
  }

  const esLotes            = modo === 'lotes'
  const bodegasDisponibles = Array.from(new Set(rows.map(r => r.localizacion).filter(Boolean))).sort()
  const rowsPorBodega      = bodegaSel !== 'todas' ? rows.filter(r => r.localizacion === bodegaSel) : rows
  const lotesDisponibles   = esLotes ? Array.from(new Set(rowsPorBodega.map(r => r.lote).filter(Boolean))).sort() as string[] : []
  const rowsPorLote        = esLotes && loteSel !== 'todos' ? rowsPorBodega.filter(r => r.lote === loteSel) : rowsPorBodega
  const tiposDisponibles   = Array.from(new Set(rowsPorLote.map(r => r.tipo).filter(Boolean))).sort()
  const rowsMostradas      = tipoSel !== 'todos' ? rowsPorLote.filter(r => r.tipo === tipoSel) : rowsPorLote

  const totalCantidad    = rowsMostradas.reduce((s, r) => s + Number(r.cantidad_sistema), 0)
  const totalConteo      = rowsMostradas.reduce((s, r) => { const c = edits[r.id]?.conteo; return s + (c !== '' && c !== undefined ? Number(c) : 0) }, 0)
  const totalBodega      = rowsMostradas.reduce((s, r) => s + Number(r.costo_bodega), 0)
  const totalDif         = rowsMostradas.reduce((s, r) => { const c = edits[r.id]?.conteo !== '' ? Number(edits[r.id]?.conteo ?? 0) : 0; return s + (c - Number(r.cantidad_sistema)) * Number(r.costo_unitario) }, 0)
  const totalDifCantidad = rowsMostradas.reduce((s, r) => { const c = edits[r.id]?.conteo !== '' ? Number(edits[r.id]?.conteo ?? 0) : 0; return s + (c - Number(r.cantidad_sistema)) }, 0)
  const hayConteo        = rowsMostradas.some(r => edits[r.id]?.conteo !== '' && edits[r.id]?.conteo !== undefined)
  const hayPendientes    = Object.values(edits).some(e => e.status === 'saving')
  const todoAcumulado    = rowsMostradas.length > 0 && rowsMostradas.every(r => !puedeEditar(r))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', padding: '20px 24px', gap: 12, boxSizing: 'border-box' }}>
      <HeaderBar
        modo={modo} onModoChange={setModo}
        fecha={fecha} onFechaChange={setFecha} fechas={fechas}
        tipoSel={tipoSel} onTipoChange={setTipoSel} tiposDisponibles={tiposDisponibles}
        bodegaSel={bodegaSel} onBodegaChange={setBodegaSel} bodegasDisponibles={bodegasDisponibles}
        esLotes={esLotes} loteSel={loteSel} onLoteChange={setLoteSel} lotesDisponibles={lotesDisponibles}
        rowsLength={rows.length} todoAcumulado={todoAcumulado}
        acumulando={acumulando} hayPendientes={hayPendientes}
        onExportar={exportar} onAcumular={acumular}
      />

      <StatsCards stats={[
        { label: 'REFERENCIAS',      value: rowsMostradas.length,                                                  color: '#1d4ed8' },
        { label: 'CON CONTEO',       value: rowsMostradas.filter(r => edits[r.id]?.conteo !== '').length,          color: '#16a34a' },
        { label: 'COSTO BODEGA',     value: fmt(totalBodega),                                                      color: '#1d4ed8' },
        { label: 'COSTO DIFERENCIA', value: fmt(totalDif),                                                         color: totalDif < 0 ? '#ef4444' : '#16a34a' },
        { label: 'PARTICIPACION',    value: totalBodega !== 0 ? ((totalDif/totalBodega)*100).toFixed(1)+'%' : '—', color: '#d97706' },
      ]} />

      <TablaConteo
        loading={loading}
        hayDatos={rows.length > 0}
        esLotes={esLotes}
        rowsMostradas={rowsMostradas}
        edits={edits}
        puedeEditar={puedeEditar}
        onChangeConteo={(id, value) => handleChange(id, 'conteo', value)}
        onChangeObs={(id, value) => handleChange(id, 'obs', value)}
        onBlurConteo={resolverConteo}
        totals={{ totalCantidad, totalConteo, totalBodega, totalDif, totalDifCantidad, hayConteo }}
      />
    </div>
  )
}
