'use client'

import { useRef, useState } from 'react'
import type { DocumentoContableRow } from '@/lib/planos/tipos'
import {
  saldosNiifVacios, filaDocumentoNiifVacia, filaMovimientoNiifVacia,
  type SaldosNiif, type MovimientoContableNiifRow,
} from '@/lib/planos/tiposNiif'
import { leerExcelNiif, generarExcelNiif } from '@/lib/planos/excelNiif'
import { generarPlanoNiif } from '@/lib/planos/generarTxtNiif'
import { codificarLatin1 } from '@/lib/planos/formato'
import { TablaEditable, descargarBlob, type ColumnaDef } from './compartido'

type Tab = 'documentoContable' | 'movimientoContable'

const TABS: { key: Tab; label: string }[] = [
  { key: 'documentoContable', label: 'Documento contable' },
  { key: 'movimientoContable', label: 'Movimiento contable (libros)' },
]

const COLS_DOCUMENTO: ColumnaDef<DocumentoContableRow>[] = [
  { campo: 'centroOperacion', etiqueta: 'C.O.' },
  { campo: 'tipoDocumento', etiqueta: 'Tipo doc.' },
  { campo: 'numeroDocumento', etiqueta: 'Núm. documento' },
  { campo: 'fecha', etiqueta: 'Fecha (AAAAMMDD)' },
  { campo: 'tercero', etiqueta: 'Tercero' },
  { campo: 'observaciones', etiqueta: 'Notas', ancho: 320 },
]

const COLS_MOVIMIENTO: ColumnaDef<MovimientoContableNiifRow>[] = [
  { campo: 'centroOperacion', etiqueta: 'C.O.' },
  { campo: 'tipoDocumento', etiqueta: 'Tipo doc.' },
  { campo: 'numeroDocumento', etiqueta: 'Núm. documento' },
  { campo: 'auxiliar', etiqueta: 'Cuenta contable' },
  { campo: 'tercero', etiqueta: 'Tercero' },
  { campo: 'centroOperacionMov', etiqueta: 'C.O. mov.' },
  { campo: 'unidadNegocio', etiqueta: 'U.N.' },
  { campo: 'centroCostos', etiqueta: 'C. costos' },
  { campo: 'conceptoFlujoEfectivo', etiqueta: 'Flujo efectivo' },
  { campo: 'valorDebito', etiqueta: 'Débito PCGA', numero: true },
  { campo: 'valorCredito', etiqueta: 'Crédito PCGA', numero: true },
  { campo: 'valorBaseGravable', etiqueta: 'Base grav. PCGA', numero: true },
  { campo: 'valorDebito2', etiqueta: 'Débito NIIF', numero: true },
  { campo: 'valorCredito2', etiqueta: 'Crédito NIIF', numero: true },
  { campo: 'valorBaseGravable2', etiqueta: 'Base grav. NIIF', numero: true },
  { campo: 'observaciones', etiqueta: 'Notas', ancho: 320 },
]

export function SaldosNiifForm() {
  const [datos, setDatos] = useState<SaldosNiif>(saldosNiifVacios())
  const [tab, setTab] = useState<Tab>('documentoContable')
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const inputArchivo = useRef<HTMLInputElement>(null)

  async function importarExcel(archivo: File) {
    setError(null)
    setMensaje(null)
    try {
      const buffer = await archivo.arrayBuffer()
      const importado = await leerExcelNiif(buffer)
      setDatos((prev) => ({ ...importado, compania: prev.compania }))
      setMensaje(`Excel importado: ${archivo.name}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el Excel')
    }
  }

  async function exportarExcel() {
    setError(null)
    try {
      const buffer = await generarExcelNiif(datos)
      descargarBlob(
        buffer,
        `NIIF_SALDOS_INICIALES_${new Date().toISOString().slice(0, 10)}.xlsx`,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el Excel')
    }
  }

  function generarPlano() {
    setError(null)
    try {
      const texto = generarPlanoNiif(datos)
      const bytes = codificarLatin1(texto)
      descargarBlob(bytes, `PLANO_SALDOS_INICIALES_NIIF_${new Date().toISOString().slice(0, 10)}.txt`, 'text/plain')
      setMensaje('Plano generado correctamente.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el plano')
    }
  }

  const totalFilas = datos.documentoContable.length + datos.movimientoContable.length

  return (
    <div style={{ padding: 32, maxWidth: 1600, margin: '0 auto' }}>
      <a href="/planos" style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>&larr; Generación de Planos</a>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, marginTop: 8 }}>Saldos Iniciales NIIF</h1>
      <p style={{ color: 'var(--text2)', marginBottom: 24 }}>
        Documento contable con movimiento por libros (PCGA y NIIF) y generación del plano de ancho fijo para Siesa ERP.
      </p>

      <div className="card" style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>COMPAÑÍA (F_CIA)</span>
          <input
            value={datos.compania}
            onChange={(e) => setDatos({ ...datos, compania: e.target.value })}
            style={{ width: 100, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)' }}
          />
        </label>

        <input
          ref={inputArchivo}
          type="file"
          accept=".xlsx"
          style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importarExcel(f); e.target.value = '' }}
        />
        <button className="btn" onClick={() => inputArchivo.current?.click()}>Importar Excel</button>
        <button className="btn" onClick={exportarExcel}>Exportar Excel</button>
        <button className="btn btn-primary" onClick={generarPlano}>Generar plano (.txt)</button>

        <span style={{ marginLeft: 'auto', color: 'var(--text2)', fontSize: 13 }}>
          Total registros: <strong>{totalFilas}</strong>
        </span>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)', marginBottom: 16, whiteSpace: 'pre-wrap' }}>
          {error}
        </div>
      )}
      {mensaje && !error && (
        <div className="card" style={{ borderColor: 'var(--accent2)', color: 'var(--accent2)', marginBottom: 16 }}>
          {mensaje}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className="btn"
            style={tab === t.key ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : undefined}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'documentoContable' && (
        <TablaEditable
          columnas={COLS_DOCUMENTO}
          filas={datos.documentoContable}
          setFilas={(filas) => setDatos({ ...datos, documentoContable: filas })}
          filaVacia={filaDocumentoNiifVacia}
        />
      )}
      {tab === 'movimientoContable' && (
        <TablaEditable
          columnas={COLS_MOVIMIENTO}
          filas={datos.movimientoContable}
          setFilas={(filas) => setDatos({ ...datos, movimientoContable: filas })}
          filaVacia={filaMovimientoNiifVacia}
        />
      )}
    </div>
  )
}
