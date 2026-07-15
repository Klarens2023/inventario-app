'use client'

import { useRef, useState } from 'react'
import {
  saldosVacios,
  type SaldosIniciales,
  type DocumentoContableRow,
  type MovimientoContableRow,
  type MovimientoCxPRow,
  type MovimientoCxCRow,
  type DiferidoRow,
} from '@/lib/planos/tipos'
import { leerExcelSaldos, generarExcelSaldos } from '@/lib/planos/excelSaldos'
import { generarPlanoTxt } from '@/lib/planos/generarTxt'
import { codificarLatin1 } from '@/lib/planos/formato'

type Tab = 'documentoContable' | 'movimientoContable' | 'movimientoCxP' | 'movimientoCxC' | 'diferidos'

const TABS: { key: Tab; label: string }[] = [
  { key: 'documentoContable', label: 'Documento contable' },
  { key: 'movimientoContable', label: 'Movimiento contable' },
  { key: 'movimientoCxP', label: 'Movimiento CxP' },
  { key: 'movimientoCxC', label: 'Movimiento CxC' },
  { key: 'diferidos', label: 'Diferidos' },
]

interface ColumnaDef<T> {
  campo: keyof T
  etiqueta: string
  numero?: boolean
  ancho?: number
}

const filaVaciaDocumento = (): DocumentoContableRow => ({
  centroOperacion: '001', tipoDocumento: '', numeroDocumento: '', fecha: '', tercero: '', observaciones: '',
})
const COLS_DOCUMENTO: ColumnaDef<DocumentoContableRow>[] = [
  { campo: 'centroOperacion', etiqueta: 'C.O.' },
  { campo: 'tipoDocumento', etiqueta: 'Tipo doc.' },
  { campo: 'numeroDocumento', etiqueta: 'Núm. documento' },
  { campo: 'fecha', etiqueta: 'Fecha (AAAAMMDD)' },
  { campo: 'tercero', etiqueta: 'Tercero' },
  { campo: 'observaciones', etiqueta: 'Observaciones', ancho: 320 },
]

const filaVaciaMovimiento = (): MovimientoContableRow => ({
  centroOperacion: '001', tipoDocumento: '', numeroDocumento: '', auxiliar: '', tercero: '',
  centroOperacionMov: '001', unidadNegocio: '999', centroCostos: '', conceptoFlujoEfectivo: '',
  valorDebito: 0, valorCredito: 0, valorBaseGravable: 0, tipoDocumentoBanco: '', numeroDocumentoBanco: '',
  observaciones: '',
})
const COLS_MOVIMIENTO: ColumnaDef<MovimientoContableRow>[] = [
  { campo: 'centroOperacion', etiqueta: 'C.O.' },
  { campo: 'tipoDocumento', etiqueta: 'Tipo doc.' },
  { campo: 'numeroDocumento', etiqueta: 'Núm. documento' },
  { campo: 'auxiliar', etiqueta: 'Cuenta contable' },
  { campo: 'tercero', etiqueta: 'Tercero' },
  { campo: 'centroOperacionMov', etiqueta: 'C.O. movimiento' },
  { campo: 'unidadNegocio', etiqueta: 'Unidad negocio' },
  { campo: 'centroCostos', etiqueta: 'C. costos' },
  { campo: 'conceptoFlujoEfectivo', etiqueta: 'Flujo efectivo' },
  { campo: 'valorDebito', etiqueta: 'Valor débito', numero: true },
  { campo: 'valorCredito', etiqueta: 'Valor crédito', numero: true },
  { campo: 'valorBaseGravable', etiqueta: 'Base gravable', numero: true },
  { campo: 'tipoDocumentoBanco', etiqueta: 'Tipo doc. banco' },
  { campo: 'numeroDocumentoBanco', etiqueta: 'Núm. doc. banco' },
  { campo: 'observaciones', etiqueta: 'Observaciones', ancho: 320 },
]

const filaVaciaCxP = (): MovimientoCxPRow => ({
  centroOperacion: '001', tipoDocumento: '', numeroDocumento: '', auxiliar: '', tercero: '',
  centroOperacionMov: '001', unidadNegocio: '999', valorDebito: 0, valorCredito: 0, observaciones: '',
  sucursalProveedor: '001', prefijoCruce: '', numeroDocumentoCruce: '', numeroCuotaCruce: '0',
  conceptoFlujoEfectivo: '', fechaVencimiento: '', fechaProntoPago: '', fechaDocumentoCruce: '',
  observacionesSaldoAbierto: 'SALDOS INICIALES',
})
const COLS_CXP: ColumnaDef<MovimientoCxPRow>[] = [
  { campo: 'centroOperacion', etiqueta: 'C.O.' },
  { campo: 'tipoDocumento', etiqueta: 'Tipo doc.' },
  { campo: 'numeroDocumento', etiqueta: 'Núm. documento' },
  { campo: 'auxiliar', etiqueta: 'Cuenta contable' },
  { campo: 'tercero', etiqueta: 'Tercero (NIT)' },
  { campo: 'centroOperacionMov', etiqueta: 'C.O. movimiento' },
  { campo: 'unidadNegocio', etiqueta: 'Unidad negocio' },
  { campo: 'valorDebito', etiqueta: 'Valor débito', numero: true },
  { campo: 'valorCredito', etiqueta: 'Valor crédito', numero: true },
  { campo: 'observaciones', etiqueta: 'Observaciones', ancho: 260 },
  { campo: 'sucursalProveedor', etiqueta: 'Sucursal proveedor' },
  { campo: 'prefijoCruce', etiqueta: 'Prefijo cruce' },
  { campo: 'numeroDocumentoCruce', etiqueta: 'Núm. doc. cruce' },
  { campo: 'numeroCuotaCruce', etiqueta: 'Cuota cruce' },
  { campo: 'conceptoFlujoEfectivo', etiqueta: 'Flujo efectivo' },
  { campo: 'fechaVencimiento', etiqueta: 'Fecha vcto (AAAAMMDD)' },
  { campo: 'fechaProntoPago', etiqueta: 'Fecha pronto pago' },
  { campo: 'fechaDocumentoCruce', etiqueta: 'Fecha doc. cruce' },
  { campo: 'observacionesSaldoAbierto', etiqueta: 'Obs. saldo abierto', ancho: 260 },
]

const filaVaciaCxC = (): MovimientoCxCRow => ({
  centroOperacion: '001', tipoDocumento: '', numeroDocumento: '', auxiliar: '', tercero: '',
  centroOperacionMov: '001', unidadNegocio: '999', valorDebito: 0, valorCredito: 0, observaciones: '',
  sucursalCliente: '001', tipoDocumentoCruce: '', numeroDocumentoCruce: '', numeroCuotaCruce: '0',
  fechaVencimiento: '', fechaProntoPago: '', terceroVendedor: '', observacionesSaldoAbierto: 'SALDOS INICIALES',
})
const COLS_CXC: ColumnaDef<MovimientoCxCRow>[] = [
  { campo: 'centroOperacion', etiqueta: 'C.O.' },
  { campo: 'tipoDocumento', etiqueta: 'Tipo doc.' },
  { campo: 'numeroDocumento', etiqueta: 'Núm. documento' },
  { campo: 'auxiliar', etiqueta: 'Cuenta contable' },
  { campo: 'tercero', etiqueta: 'Tercero (NIT)' },
  { campo: 'centroOperacionMov', etiqueta: 'C.O. movimiento' },
  { campo: 'unidadNegocio', etiqueta: 'Unidad negocio' },
  { campo: 'valorDebito', etiqueta: 'Valor débito', numero: true },
  { campo: 'valorCredito', etiqueta: 'Valor crédito', numero: true },
  { campo: 'observaciones', etiqueta: 'Observaciones', ancho: 260 },
  { campo: 'sucursalCliente', etiqueta: 'Sucursal cliente' },
  { campo: 'tipoDocumentoCruce', etiqueta: 'Tipo doc. cruce' },
  { campo: 'numeroDocumentoCruce', etiqueta: 'Núm. doc. cruce' },
  { campo: 'numeroCuotaCruce', etiqueta: 'Cuota cruce' },
  { campo: 'fechaVencimiento', etiqueta: 'Fecha vcto (AAAAMMDD)' },
  { campo: 'fechaProntoPago', etiqueta: 'Fecha pronto pago' },
  { campo: 'terceroVendedor', etiqueta: 'Tercero vendedor' },
  { campo: 'observacionesSaldoAbierto', etiqueta: 'Obs. saldo abierto', ancho: 260 },
]

const filaVaciaDiferido = (): DiferidoRow => ({
  centroOperacion: '001', tipoDocumento: '', numeroDocumento: '', auxiliar: '', tercero: '',
  centroOperacionMov: '001', unidadNegocio: '999', centroCostos: '', valorDebito: 0, valorCredito: 0,
  observaciones: '', documentoDiferido: '', numeroCuotaDiferido: '0', fechaInicial: '', fechaFinal: '',
  auxiliarContrapartida: '', terceroContrapartida: '', centroOperacionContrapartida: '001',
  unidadNegocioContrapartida: '999', centroCostosContrapartida: '', observacionesContrapartida: '',
})
const COLS_DIFERIDOS: ColumnaDef<DiferidoRow>[] = [
  { campo: 'centroOperacion', etiqueta: 'C.O.' },
  { campo: 'tipoDocumento', etiqueta: 'Tipo doc.' },
  { campo: 'numeroDocumento', etiqueta: 'Núm. documento' },
  { campo: 'auxiliar', etiqueta: 'Cuenta contable' },
  { campo: 'tercero', etiqueta: 'Tercero' },
  { campo: 'centroOperacionMov', etiqueta: 'C.O. movimiento' },
  { campo: 'unidadNegocio', etiqueta: 'Unidad negocio' },
  { campo: 'centroCostos', etiqueta: 'C. costos' },
  { campo: 'valorDebito', etiqueta: 'Valor débito', numero: true },
  { campo: 'valorCredito', etiqueta: 'Valor crédito', numero: true },
  { campo: 'observaciones', etiqueta: 'Observaciones', ancho: 220 },
  { campo: 'documentoDiferido', etiqueta: 'Doc. diferido' },
  { campo: 'numeroCuotaDiferido', etiqueta: 'Cuota' },
  { campo: 'fechaInicial', etiqueta: 'Fecha inicial' },
  { campo: 'fechaFinal', etiqueta: 'Fecha final' },
  { campo: 'auxiliarContrapartida', etiqueta: 'Cuenta contrapartida' },
  { campo: 'terceroContrapartida', etiqueta: 'Tercero contrapartida' },
  { campo: 'centroOperacionContrapartida', etiqueta: 'C.O. contrapartida' },
  { campo: 'unidadNegocioContrapartida', etiqueta: 'U.N. contrapartida' },
  { campo: 'centroCostosContrapartida', etiqueta: 'C. costos contrapartida' },
  { campo: 'observacionesContrapartida', etiqueta: 'Obs. contrapartida', ancho: 220 },
]

function TablaEditable<T extends object>({
  columnas, filas, setFilas, filaVacia,
}: {
  columnas: ColumnaDef<T>[]
  filas: T[]
  setFilas: (filas: T[]) => void
  filaVacia: () => T
}) {
  function cambiar(i: number, campo: keyof T, valor: string, esNumero?: boolean) {
    const copia = filas.slice()
    const fila = { ...copia[i] } as Record<string, string | number>
    fila[campo as string] = esNumero ? Number(valor.replace(',', '.')) || 0 : valor
    copia[i] = fila as T
    setFilas(copia)
  }
  function agregar() { setFilas([...filas, filaVacia()]) }
  function eliminar(i: number) { setFilas(filas.filter((_, idx) => idx !== i)) }

  return (
    <div>
      <div style={{ overflow: 'auto', maxHeight: 480, border: '1px solid var(--border)', borderRadius: 8 }}>
        <table className="inv-table">
          <thead>
            <tr>
              {columnas.map((c) => (
                <th key={String(c.campo)} style={{ minWidth: c.ancho ?? 120 }}>{c.etiqueta}</th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr><td colSpan={columnas.length + 1} style={{ textAlign: 'center', color: 'var(--text2)', padding: 24 }}>
                Sin filas. Importe un Excel de saldos o agregue filas manualmente.
              </td></tr>
            )}
            {filas.map((fila, i) => (
              <tr key={i}>
                {columnas.map((c) => (
                  <td key={String(c.campo)}>
                    <input
                      value={String(fila[c.campo] ?? '')}
                      onChange={(e) => cambiar(i, c.campo, e.target.value, c.numero)}
                    />
                  </td>
                ))}
                <td>
                  <button className="btn btn-danger" onClick={() => eliminar(i)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn" onClick={agregar}>+ Agregar fila</button>
        <span style={{ color: 'var(--text2)', fontSize: 13 }}>{filas.length} fila(s)</span>
      </div>
    </div>
  )
}

function descargarBlob(contenido: BlobPart | Uint8Array, nombre: string, tipo: string) {
  const blob = new Blob([contenido as BlobPart], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function PlanosForm() {
  const [datos, setDatos] = useState<SaldosIniciales>(saldosVacios())
  const [tab, setTab] = useState<Tab>('documentoContable')
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const inputArchivo = useRef<HTMLInputElement>(null)

  async function importarExcel(archivo: File) {
    setError(null)
    setMensaje(null)
    try {
      const buffer = await archivo.arrayBuffer()
      const importado = await leerExcelSaldos(buffer)
      setDatos((prev) => ({ ...importado, compania: prev.compania }))
      setMensaje(`Excel importado: ${archivo.name}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el Excel')
    }
  }

  async function exportarExcel() {
    setError(null)
    try {
      const buffer = await generarExcelSaldos(datos)
      descargarBlob(
        buffer,
        `SALDOS_INICIALES_CONTABLES_KLARENS_${new Date().toISOString().slice(0, 10)}.xlsx`,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el Excel')
    }
  }

  function generarPlano() {
    setError(null)
    try {
      const texto = generarPlanoTxt(datos)
      const bytes = codificarLatin1(texto)
      descargarBlob(bytes, `PLANO_SALDOS_INICIALES_${new Date().toISOString().slice(0, 10)}.txt`, 'text/plain')
      setMensaje('Plano generado correctamente.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el plano')
    }
  }

  const totalFilas = datos.documentoContable.length + datos.movimientoContable.length +
    datos.movimientoCxP.length + datos.movimientoCxC.length + datos.diferidos.length

  return (
    <div style={{ padding: 32, maxWidth: 1400, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Generación de Planos</h1>
      <p style={{ color: 'var(--text2)', marginBottom: 24 }}>
        Cargue de saldos iniciales contables y generación del plano de ancho fijo para Siesa ERP.
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
        <button className="btn" onClick={() => inputArchivo.current?.click()}>Importar Excel de saldos</button>
        <button className="btn" onClick={exportarExcel}>Exportar Excel</button>
        <button className="btn btn-primary" onClick={generarPlano}>Generar plano (.txt)</button>

        <span style={{ marginLeft: 'auto', color: 'var(--text2)', fontSize: 13 }}>
          Total registros: <strong>{totalFilas}</strong>
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
          filaVacia={filaVaciaDocumento}
        />
      )}
      {tab === 'movimientoContable' && (
        <TablaEditable
          columnas={COLS_MOVIMIENTO}
          filas={datos.movimientoContable}
          setFilas={(filas) => setDatos({ ...datos, movimientoContable: filas })}
          filaVacia={filaVaciaMovimiento}
        />
      )}
      {tab === 'movimientoCxP' && (
        <TablaEditable
          columnas={COLS_CXP}
          filas={datos.movimientoCxP}
          setFilas={(filas) => setDatos({ ...datos, movimientoCxP: filas })}
          filaVacia={filaVaciaCxP}
        />
      )}
      {tab === 'movimientoCxC' && (
        <TablaEditable
          columnas={COLS_CXC}
          filas={datos.movimientoCxC}
          setFilas={(filas) => setDatos({ ...datos, movimientoCxC: filas })}
          filaVacia={filaVaciaCxC}
        />
      )}
      {tab === 'diferidos' && (
        <TablaEditable
          columnas={COLS_DIFERIDOS}
          filas={datos.diferidos}
          setFilas={(filas) => setDatos({ ...datos, diferidos: filas })}
          filaVacia={filaVaciaDiferido}
        />
      )}
    </div>
  )
}
