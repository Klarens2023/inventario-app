'use client'

import { useRef, useState } from 'react'
import {
  puntosEnvioVacio, filaPuntoEnvioVacia,
  type PuntosEnvio, type PuntoEnvioRow,
} from '@/lib/planos/tiposPuntosEnvio'
import { leerExcelPuntosEnvio, generarExcelPuntosEnvio } from '@/lib/planos/excelPuntosEnvio'
import { generarPlanoPuntosEnvio } from '@/lib/planos/generarTxtPuntosEnvio'
import { codificarLatin1 } from '@/lib/planos/formato'
import { TablaEditable, descargarBlob, type ColumnaDef } from './compartido'

const COLUMNAS: ColumnaDef<PuntoEnvioRow>[] = [
  { campo: 'tercero', etiqueta: 'Cliente' },
  { campo: 'sucursal', etiqueta: 'Sucursal', ancho: 80 },
  { campo: 'codigo', etiqueta: 'Cód. punto envío', ancho: 100 },
  { campo: 'descripcion', etiqueta: 'Descripción', ancho: 260 },
  { campo: 'vendedor', etiqueta: 'Vendedor', ancho: 90 },
  { campo: 'contacto', etiqueta: 'Contacto', ancho: 200 },
  { campo: 'direccion1', etiqueta: 'Dirección 1', ancho: 240 },
  { campo: 'direccion2', etiqueta: 'Dirección 2', ancho: 200 },
  { campo: 'direccion3', etiqueta: 'Dirección 3', ancho: 200 },
  { campo: 'pais', etiqueta: 'País', ancho: 70 },
  { campo: 'departamento', etiqueta: 'Depto', ancho: 70 },
  { campo: 'ciudad', etiqueta: 'Ciudad', ancho: 70 },
  { campo: 'barrio', etiqueta: 'Barrio', ancho: 180 },
  { campo: 'telefono', etiqueta: 'Teléfono' },
  { campo: 'fax', etiqueta: 'Fax' },
  { campo: 'codigoPostal', etiqueta: 'Cód. postal', ancho: 100 },
  { campo: 'email', etiqueta: 'Email', ancho: 220 },
  { campo: 'parametroEdi', etiqueta: 'Parám. EDI', ancho: 90 },
  { campo: 'codigoEan', etiqueta: 'Código EAN', ancho: 160 },
  { campo: 'criterioMayor', etiqueta: 'Criterio mayor', ancho: 110 },
  { campo: 'pedidoMinimo', etiqueta: 'Pedido mínimo', numero: true },
  { campo: 'celular', etiqueta: 'Celular' },
]

export function PuntosEnvioForm() {
  const [datos, setDatos] = useState<PuntosEnvio>(puntosEnvioVacio())
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const inputArchivo = useRef<HTMLInputElement>(null)

  async function importarExcel(archivo: File) {
    setError(null)
    setMensaje(null)
    try {
      const buffer = await archivo.arrayBuffer()
      const importado = await leerExcelPuntosEnvio(buffer)
      setDatos((prev) => ({ ...importado, compania: prev.compania }))
      setMensaje(`Excel importado: ${archivo.name}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el Excel')
    }
  }

  async function exportarExcel() {
    setError(null)
    try {
      const buffer = await generarExcelPuntosEnvio(datos)
      descargarBlob(
        buffer,
        `PUNTOS_ENVIO_KLARENS_${new Date().toISOString().slice(0, 10)}.xlsx`,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el Excel')
    }
  }

  function generarPlano() {
    setError(null)
    try {
      const texto = generarPlanoPuntosEnvio(datos)
      const bytes = codificarLatin1(texto)
      descargarBlob(bytes, `PLANO_PUNTOS_ENVIO_${new Date().toISOString().slice(0, 10)}.txt`, 'text/plain')
      setMensaje('Plano generado correctamente.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el plano')
    }
  }

  return (
    <div style={{ padding: 32, maxWidth: 1600, margin: '0 auto' }}>
      <a href="/planos" style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>&larr; Generación de Planos</a>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, marginTop: 8 }}>Puntos de Envío</h1>
      <p style={{ color: 'var(--text2)', marginBottom: 24 }}>
        Creación y actualización de puntos de envío de clientes, y generación del plano de ancho fijo para Siesa ERP.
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
          Total registros: <strong>{datos.puntos.length}</strong>
        </span>
      </div>

      <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 16 }}>
        Para empezar, use <strong>Exportar Excel</strong> con la tabla vacía: descarga la plantilla con las columnas y una nota de ayuda en cada encabezado.
        Las columnas &quot;Reemplaza&quot; y &quot;Activo&quot; solo se editan desde el Excel (por defecto ambas en 1).
      </p>

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
        filas={datos.puntos}
        setFilas={(filas) => setDatos({ ...datos, puntos: filas })}
        filaVacia={filaPuntoEnvioVacia}
      />
    </div>
  )
}
