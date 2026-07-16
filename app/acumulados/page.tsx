'use client'
import { useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { exportarExcel } from '@/lib/exportExcel'
import type { Modo, Row, Totales, PivotItem } from '@/types/acumulados'
import { getAcumulados, reiniciarHistorial } from '@/lib/api/acumulados'
import { fmtFechaCorta } from '@/components/acumulados/utils'
import { HeaderBar } from '@/components/acumulados/HeaderBar'
import { FiltrosBar } from '@/components/acumulados/FiltrosBar'
import { TotalesCards } from '@/components/acumulados/TotalesCards'
import { MatrizPivot } from '@/components/acumulados/MatrizPivot'
import { DetalleModal } from '@/components/acumulados/DetalleModal'

export default function AcumuladosPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.rol === 'admin'
  const [modo,      setModo]     = useState<Modo>('items')
  const [desde,     setDesde]    = useState('')
  const [hasta,     setHasta]    = useState('')
  const [tipoFil,   setTipoFil]  = useState('todos')
  const [bodegaSel, setBodegaSel] = useState('todas')
  const [rows,      setRows]     = useState<Row[]>([])
  const [totales,   setTotales]  = useState<Totales | null>(null)
  const [loading,   setLoading]  = useState(false)
  const [error,     setError]    = useState('')
  const [reiniciando, setRein]   = useState(false)
  const [confirm,   setConfirm]  = useState(0)
  const [detalle,   setDetalle]  = useState<Row | null>(null)

  async function buscar() {
    setLoading(true); setError(''); setDetalle(null)
    try {
      const { rows: rowsData, totales: totalesData, error: errorMsg, ok } = await getAcumulados({ desde, hasta, modo })
      if (!ok) { setError(errorMsg ?? 'Error al buscar'); setRows([]); setTotales(null) }
      else { setRows(rowsData); setTotales(totalesData) }
    } catch (e: any) { setError('Error: ' + e.message) }
    finally { setLoading(false) }
  }

  async function reiniciar() {
    if (confirm < 1) { setConfirm(1); return }
    setRein(true)
    try { await reiniciarHistorial(); setRows([]); setTotales(null); setConfirm(0); alert('Historial eliminado.') }
    catch { alert('Error al reiniciar.') }
    setRein(false)
  }

  function cambiarModo(m: Modo) {
    setModo(m); setRows([]); setTotales(null)
  }

  // Tipos y bodegas únicos en los resultados para los filtros
  const tiposDisponibles = useMemo(() =>
    Array.from(new Set(rows.map(r => r.tipo).filter(Boolean))).sort(),
  [rows])

  const bodegasDisponibles = useMemo(() =>
    Array.from(new Set(rows.map(r => r.localizacion).filter(Boolean))).sort(),
  [rows])

  // Filtrar filas por tipo y bodega seleccionados
  const rowsFiltradas = useMemo(() =>
    rows.filter(r =>
      (tipoFil === 'todos' || r.tipo === tipoFil) &&
      (bodegaSel === 'todas' || r.localizacion === bodegaSel)
    )
  , [rows, tipoFil, bodegaSel])

  const esLotes = modo === 'lotes'

  // Pivot: filas = referencias (+ lote en modo lotes), columnas = fechas
  const pivotData = useMemo(() => {
    const fechasSet = new Set<string>()
    const mapItems: Record<string, PivotItem> = {}
    rowsFiltradas.forEach(r => {
      const f   = fmtFechaCorta(r.fecha)
      const key = esLotes ? `${r.referencia}|${r.lote ?? ''}` : r.referencia
      fechasSet.add(f)
      if (!mapItems[key]) {
        mapItems[key] = {
          referencia: r.referencia,
          descripcion: r.descripcion,
          categoria: r.categoria,
          tipo: r.tipo,
          lote: r.lote ?? null,
          datosPorFecha: {}
        }
      }
      mapItems[key].datosPorFecha[f] = r
    })
    return {
      fechas: Array.from(fechasSet).sort(),
      items:  Object.values(mapItems).sort((a, b) => {
        const c = a.referencia.localeCompare(b.referencia)
        if (c !== 0) return c
        return (a.lote ?? '').localeCompare(b.lote ?? '')
      })
    }
  }, [rowsFiltradas, esLotes])

  async function exportar() {
    const baseCols = esLotes
      ? ['Referencia', 'Lote', 'Descripcion', 'Categoria', 'Tipo']
      : ['Referencia', 'Descripcion', 'Categoria', 'Tipo']

    const cols = [...baseCols, ...pivotData.fechas.flatMap(f => [`Dif ${f}`, `Costo Dif ${f}`])]

    const filas: (string | number)[][] = pivotData.items.map(item => {
      const base: (string | number)[] = esLotes
        ? [item.referencia, item.lote ?? '', item.descripcion, item.categoria, item.tipo]
        : [item.referencia, item.descripcion, item.categoria, item.tipo]

      const datos: (string | number)[] = pivotData.fechas.flatMap(f => {
        const d = item.datosPorFecha[f]
        const valores: (string | number)[] = d ? [Number(d.diferencia), Number(d.costo_diferencia)] : ['', '']
        return valores
      })
      return [...base, ...datos]
    })

    await exportarExcel(`Acumulados_${modo}_${desde}_${hasta}`, cols, filas, session?.user?.name ?? undefined)
  }

  const totalsFiltrados = {
    costo_bodega:     rowsFiltradas.reduce((s, r) => s + Number(r.costo_bodega_total ?? 0), 0),
    costo_diferencia: rowsFiltradas.reduce((s, r) => s + Number(r.costo_diferencia ?? 0), 0),
  }
  const part = totalsFiltrados.costo_bodega !== 0
    ? ((totalsFiltrados.costo_diferencia / totalsFiltrados.costo_bodega) * 100).toFixed(1) + '%'
    : '—'

  return (
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <HeaderBar isAdmin={isAdmin} reiniciando={reiniciando} confirm={confirm} onReiniciar={reiniciar} />

      <FiltrosBar
        modo={modo} onModoChange={cambiarModo}
        desde={desde} onDesdeChange={setDesde}
        hasta={hasta} onHastaChange={setHasta}
        onBuscar={buscar} loading={loading}
        tipoFil={tipoFil} onTipoFilChange={setTipoFil} tiposDisponibles={tiposDisponibles}
        bodegaSel={bodegaSel} onBodegaChange={setBodegaSel} bodegasDisponibles={bodegasDisponibles}
        hayRows={rows.length > 0} onExportar={exportar}
      />

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 6, background: 'rgba(248,81,73,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {totales && (
        <TotalesCards
          esLotes={esLotes}
          itemsCount={pivotData.items.length}
          costoBodega={totalsFiltrados.costo_bodega}
          costoDiferencia={totalsFiltrados.costo_diferencia}
          participacion={part}
        />
      )}

      <MatrizPivot
        loading={loading}
        hayFiltradas={rowsFiltradas.length > 0}
        esLotes={esLotes}
        fechas={pivotData.fechas}
        items={pivotData.items}
        onSelectDetalle={setDetalle}
      />

      {detalle && (
        <DetalleModal detalle={detalle} esLotes={esLotes} onClose={() => setDetalle(null)} />
      )}
    </div>
  )
}
