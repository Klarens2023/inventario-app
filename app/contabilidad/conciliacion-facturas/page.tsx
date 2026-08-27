'use client'
import { useState, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import type {
  MapeoInvoicing, MapeoErp, ResultadoComparacion, ResumenProcesamiento, FacturaInvoicing, EstadoFactura,
} from '@/types/conciliacion-facturas'
import { leerLibroExcel, hojaConMasDatos, sugerirMapeoInvoicing, sugerirMapeoErp, mapearInvoicing, mapearErp } from '@/lib/conciliacion-facturas/leerExcel'
import { compararFacturas } from '@/lib/conciliacion-facturas/comparar'
import { exportarConciliacion } from '@/lib/conciliacion-facturas/exportarExcel'
import { LOCAL_STORAGE_KEY_MAPEO } from '@/lib/conciliacion-facturas/constants'
import { SubirArchivos } from '@/components/conciliacion-facturas/SubirArchivos'
import { MapeoColumnas } from '@/components/conciliacion-facturas/MapeoColumnas'
import { ResumenCards } from '@/components/conciliacion-facturas/ResumenCards'
import { FiltrosBar } from '@/components/conciliacion-facturas/FiltrosBar'
import { TablaResultados } from '@/components/conciliacion-facturas/TablaResultados'

type MapeoGuardado = { encabezadosInvoicing: string[]; encabezadosErp: string[]; mapeoInvoicing: MapeoInvoicing; mapeoErp: MapeoErp }

export default function ConciliacionFacturasPage() {
  const { data: session } = useSession()

  const [nombreInvoicing, setNombreInvoicing] = useState<string | null>(null)
  const [nombreErp, setNombreErp] = useState<string | null>(null)
  const [filasInvoicing, setFilasInvoicing] = useState<Record<string, unknown>[]>([])
  const [filasErp, setFilasErp] = useState<Record<string, unknown>[]>([])
  const [encabezadosInvoicing, setEncabezadosInvoicing] = useState<string[]>([])
  const [encabezadosErp, setEncabezadosErp] = useState<string[]>([])
  const [mapeoInvoicing, setMapeoInvoicing] = useState<MapeoInvoicing | null>(null)
  const [mapeoErp, setMapeoErp] = useState<MapeoErp | null>(null)

  const [cargandoArchivo, setCargandoArchivo] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')

  const [resultados, setResultados] = useState<ResultadoComparacion[] | null>(null)
  const [resumen, setResumen] = useState<ResumenProcesamiento | null>(null)
  const [rechazadas, setRechazadas] = useState<FacturaInvoicing[]>([])

  const [filtroEstado, setFiltroEstado] = useState<EstadoFactura | 'todos'>('todos')
  const [busqueda, setBusqueda] = useState('')

  const cargarMapeoGuardado = useCallback((encInv: string[], encErp: string[]): MapeoGuardado | null => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY_MAPEO)
      if (!raw) return null
      const guardado = JSON.parse(raw) as MapeoGuardado
      const mismos = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i])
      if (mismos(guardado.encabezadosInvoicing, encInv) && mismos(guardado.encabezadosErp, encErp)) return guardado
      return null
    } catch { return null }
  }, [])

  async function onSeleccionarInvoicing(file: File) {
    setError(''); setCargandoArchivo(true)
    try {
      const hojas = await leerLibroExcel(file)
      const hoja = hojaConMasDatos(hojas)
      setFilasInvoicing(hoja.filas)
      setEncabezadosInvoicing(hoja.encabezados)
      setNombreInvoicing(file.name)
      const guardado = cargarMapeoGuardado(hoja.encabezados, encabezadosErp)
      setMapeoInvoicing(guardado?.mapeoInvoicing ?? sugerirMapeoInvoicing(hoja.encabezados))
      setResultados(null)
    } catch (e) {
      setError('No se pudo leer el archivo de Invoicing. Verifica que sea un Excel válido (.xls o .xlsx).')
    } finally { setCargandoArchivo(false) }
  }

  async function onSeleccionarErp(file: File) {
    setError(''); setCargandoArchivo(true)
    try {
      const hojas = await leerLibroExcel(file)
      const hoja = hojaConMasDatos(hojas)
      setFilasErp(hoja.filas)
      setEncabezadosErp(hoja.encabezados)
      setNombreErp(file.name)
      const guardado = cargarMapeoGuardado(encabezadosInvoicing, hoja.encabezados)
      setMapeoErp(guardado?.mapeoErp ?? sugerirMapeoErp(hoja.encabezados))
      setResultados(null)
    } catch (e) {
      setError('No se pudo leer el archivo del ERP. Verifica que sea un Excel válido (.xls o .xlsx).')
    } finally { setCargandoArchivo(false) }
  }

  function procesar() {
    if (!mapeoInvoicing || !mapeoErp) return
    setError(''); setProcesando(true)
    try {
      const invoicing = mapearInvoicing(filasInvoicing, mapeoInvoicing)
      const erp = mapearErp(filasErp, mapeoErp)
      const { resultados: res, resumen: sum, rechazadas: rech } = compararFacturas(invoicing, erp)
      setResultados(res); setResumen(sum); setRechazadas(rech)
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_MAPEO, JSON.stringify({
          encabezadosInvoicing, encabezadosErp, mapeoInvoicing, mapeoErp,
        } satisfies MapeoGuardado))
      } catch {}
    } catch (e) {
      setError('Ocurrió un error al procesar los archivos. Revisa el mapeo de columnas.')
    } finally { setProcesando(false) }
  }

  const resultadosFiltrados = useMemo(() => {
    if (!resultados) return []
    const q = busqueda.trim().toLowerCase()
    return resultados.filter(r =>
      (filtroEstado === 'todos' || r.estado === filtroEstado) &&
      (!q || r.nit.toLowerCase().includes(q) || r.razonSocial.toLowerCase().includes(q) || r.facturaInvoicingOriginal.toLowerCase().includes(q) || (r.facturaErpOriginal ?? '').toLowerCase().includes(q))
    )
  }, [resultados, filtroEstado, busqueda])

  async function exportar() {
    if (!resultados || !resumen) return
    await exportarConciliacion(resultados, resumen, rechazadas, session?.user?.name ?? undefined)
  }

  return (
    <div style={{ padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Conciliación de Facturas de Proveedores</h1>
        <p style={{ color: 'var(--text2)', fontSize: 14 }}>
          Compara Siesa Invoicing (facturas recibidas) contra Siesa ERP (causación) para saber qué falta por causar.
          Todo el procesamiento ocurre en tu navegador — los archivos no se suben a ningún servidor.
        </p>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: 13 }}>{error}</div>
      )}

      <SubirArchivos
        nombreInvoicing={nombreInvoicing} nombreErp={nombreErp}
        onSeleccionarInvoicing={onSeleccionarInvoicing} onSeleccionarErp={onSeleccionarErp}
        cargando={cargandoArchivo}
      />

      {mapeoInvoicing && mapeoErp && (
        <MapeoColumnas
          encabezadosInvoicing={encabezadosInvoicing} encabezadosErp={encabezadosErp}
          mapeoInvoicing={mapeoInvoicing} mapeoErp={mapeoErp}
          onCambiarMapeoInvoicing={setMapeoInvoicing} onCambiarMapeoErp={setMapeoErp}
          onProcesar={procesar} procesando={procesando}
        />
      )}

      {resultados && resumen && (
        <>
          <ResumenCards resumen={resumen} />
          <FiltrosBar
            filtroEstado={filtroEstado} onFiltroEstadoChange={setFiltroEstado}
            busqueda={busqueda} onBusquedaChange={setBusqueda}
            onExportar={exportar} totalFiltrado={resultadosFiltrados.length}
          />
          <TablaResultados resultados={resultadosFiltrados} loading={false} />
        </>
      )}
    </div>
  )
}
