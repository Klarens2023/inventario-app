'use client'

import { useRef, useState } from 'react'
import {
  impuestosRetencionesVacio, filaImpuestoRetencionVacia,
  type ImpuestosRetenciones, type ImpuestoRetencionRow,
} from '@/lib/planos/tiposImpuestos'
import { leerExcelImpuestos, generarExcelImpuestos } from '@/lib/planos/excelImpuestos'
import { generarPlanoImpuestos } from '@/lib/planos/generarTxtImpuestos'
import { codificarLatin1 } from '@/lib/planos/formato'
import { TablaEditable, descargarBlob, type ColumnaDef } from './compartido'

const COLUMNAS: ColumnaDef<ImpuestoRetencionRow>[] = [
  { campo: 'tercero', etiqueta: 'Tercero' },
  { campo: 'sucursal', etiqueta: 'Sucursal' },
  { campo: 'tipo', etiqueta: 'Tipo (cliente/proveedor)' },
  { campo: 'concepto', etiqueta: 'Concepto (impuesto/retencion)' },
  { campo: 'clase', etiqueta: 'Clase (sigla)' },
  { campo: 'valor', etiqueta: 'Valor (0/1/2)' },
  { campo: 'llave', etiqueta: 'Llave' },
]

export function ImpuestosRetencionesForm() {
  const [datos, setDatos] = useState<ImpuestosRetenciones>(impuestosRetencionesVacio())
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const inputArchivo = useRef<HTMLInputElement>(null)

  async function importarExcel(archivo: File) {
    setError(null)
    setMensaje(null)
    try {
      const buffer = await archivo.arrayBuffer()
      const importado = await leerExcelImpuestos(buffer)
      setDatos((prev) => ({ ...importado, compania: prev.compania }))
      setMensaje(`Excel importado: ${archivo.name}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el Excel')
    }
  }

  async function exportarExcel() {
    setError(null)
    try {
      const buffer = await generarExcelImpuestos(datos)
      descargarBlob(
        buffer,
        `IMPUESTOS_RETENCIONES_KLARENS_${new Date().toISOString().slice(0, 10)}.xlsx`,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el Excel')
    }
  }

  function generarPlano() {
    setError(null)
    try {
      const texto = generarPlanoImpuestos(datos)
      const bytes = codificarLatin1(texto)
      descargarBlob(bytes, `PLANO_IMPUESTOS_RETENCIONES_${new Date().toISOString().slice(0, 10)}.txt`, 'text/plain')
      setMensaje('Plano generado correctamente.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el plano')
    }
  }

  return (
    <div style={{ padding: 32, maxWidth: 1600, margin: '0 auto' }}>
      <a href="/planos" style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>&larr; Generación de Planos</a>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, marginTop: 8 }}>Impuestos y Retenciones</h1>
      <p style={{ color: 'var(--text2)', marginBottom: 24 }}>
        Configuración de impuestos y retenciones de clientes y proveedores, y generación del plano de ancho fijo para Siesa ERP.
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
          Total registros: <strong>{datos.registros.length}</strong>
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

      <TablaEditable
        columnas={COLUMNAS}
        filas={datos.registros}
        setFilas={(filas) => setDatos({ ...datos, registros: filas })}
        filaVacia={filaImpuestoRetencionVacia}
      />
    </div>
  )
}
