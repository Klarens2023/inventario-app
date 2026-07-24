'use client'

import { useRef, useState } from 'react'
import { adicionesAFVacio, filaAdicionAFVacia, type AdicionesAF, type AdicionAFRow } from '@/lib/planos/tiposAdiciones'
import { leerExcelAdiciones, generarExcelAdiciones } from '@/lib/planos/excelAdiciones'
import { generarPlanoAdicionesAF } from '@/lib/planos/generarTxtAdiciones'
import { codificarLatin1 } from '@/lib/planos/formato'
import { TablaEditable, descargarBlob, type ColumnaDef } from './compartido'

const COLUMNAS: ColumnaDef<AdicionAFRow>[] = [
  { campo: 'codigoActivo', etiqueta: 'Código activo' },
  { campo: 'numeroAdicion', etiqueta: 'Número adición (1-999)' },
  { campo: 'descripcion', etiqueta: 'Descripción', ancho: 240 },
  { campo: 'numeroPiezas', etiqueta: 'Número de piezas', numero: true },
  { campo: 'fechaAdquisicion', etiqueta: 'Fecha adquisición (AAAAMMDD)' },
  { campo: 'costoAdquisicion', etiqueta: 'Costo adquisición', numero: true },
  { campo: 'metodoDepreciacion', etiqueta: 'Método depreciación (0-3)' },
  { campo: 'vidaUtilPeriodos', etiqueta: 'Vida útil (períodos)', numero: true },
  { campo: 'unidadesDepreciar', etiqueta: 'Unidades a depreciar', numero: true },
  { campo: 'valorSalvamento', etiqueta: 'Valor salvamento', numero: true },
  { campo: 'porcentajeSalvamento', etiqueta: '% salvamento', numero: true },
  { campo: 'costoAdquisicionNiif', etiqueta: 'Costo adquisición NIIF', numero: true },
  { campo: 'metodoDepreciacionNiif', etiqueta: 'Método depreciación NIIF (0-3)' },
  { campo: 'vidaUtilPeriodosNiif', etiqueta: 'Vida útil NIIF (períodos)', numero: true },
  { campo: 'unidadesDepreciarNiif', etiqueta: 'Unidades NIIF a depreciar', numero: true },
  { campo: 'valorSalvamentoNiif', etiqueta: 'Valor salvamento NIIF', numero: true },
  { campo: 'porcentajeSalvamentoNiif', etiqueta: '% salvamento NIIF', numero: true },
  { campo: 'vidaUtilRemanente', etiqueta: 'Vida útil remanente', numero: true },
  { campo: 'unidadesRemanente', etiqueta: 'Unidades remanente', numero: true },
]

export function AdicionesAFForm() {
  const [datos, setDatos] = useState<AdicionesAF>(adicionesAFVacio())
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const inputArchivo = useRef<HTMLInputElement>(null)

  async function importarExcel(archivo: File) {
    setError(null)
    setMensaje(null)
    try {
      const buffer = await archivo.arrayBuffer()
      const importado = await leerExcelAdiciones(buffer)
      setDatos((prev) => ({ ...importado, compania: prev.compania }))
      setMensaje(`Excel importado: ${archivo.name}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el Excel')
    }
  }

  async function exportarExcel() {
    setError(null)
    try {
      const buffer = await generarExcelAdiciones(datos)
      descargarBlob(
        buffer,
        `ADICIONES_ACTIVOS_FIJOS_KLARENS_${new Date().toISOString().slice(0, 10)}.xlsx`,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el Excel')
    }
  }

  function generarPlano() {
    setError(null)
    try {
      const texto = generarPlanoAdicionesAF(datos)
      const bytes = codificarLatin1(texto)
      descargarBlob(bytes, `PLANO_ADICIONES_AF_${new Date().toISOString().slice(0, 10)}.txt`, 'text/plain')
      setMensaje('Plano generado correctamente.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el plano')
    }
  }

  return (
    <div style={{ padding: 32, maxWidth: 1600, margin: '0 auto' }}>
      <a href="/planos" style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>&larr; Generación de Planos</a>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, marginTop: 8 }}>Adiciones de Activos Fijos</h1>
      <p style={{ color: 'var(--text2)', marginBottom: 24 }}>
        Cargue de adiciones a activos fijos ya creados y generación del plano de ancho fijo para Siesa ERP.
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
          Total adiciones: <strong>{datos.adiciones.length}</strong>
        </span>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)', marginBottom: 16 }}>
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
        filas={datos.adiciones}
        setFilas={(filas) => setDatos({ ...datos, adiciones: filas })}
        filaVacia={filaAdicionAFVacia}
      />
    </div>
  )
}
