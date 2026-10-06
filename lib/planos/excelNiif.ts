// Importación/exportación del Excel de Saldos Iniciales NIIF (plantilla
// "NIIF SALDOS INICIALES"), usando ExcelJS. Dos hojas: Documentocontable y
// Movimientocontable; las columnas se leen por posición, igual que en la plantilla.
// El libro 3 no se maneja: si la plantilla trae sus columnas se ignoran, y la
// columna NOTAS se ubica por su encabezado para soportar ambas versiones.

import ExcelJS from 'exceljs'
import { saldosNiifVacios } from './tiposNiif'
import type { SaldosNiif } from './tiposNiif'
import { agregarNotasEncabezado } from './notasExcel'

const HOJAS = {
  documentoContable: 'Documentocontable',
  movimientoContable: 'Movimientocontable',
} as const

const ENCABEZADOS: Record<keyof typeof HOJAS, string[]> = {
  documentoContable: ['C.O', 'TIPO DOC', 'NUMERO DOC', 'FECHA', 'TERCERO', 'NOTAS'],
  movimientoContable: [
    'C.O', 'TIPO DOC', 'NUMERO DOC', 'AUXILIAR CONTABLE', 'TERCERO', 'C.O MOV', 'U.N',
    'AUX CENTRO COSTOS', 'AUX FLUJO EFECT',
    'Valor debito (PCGA)', 'Valor crédito (PCGA)', 'Valor base gravable (PCGA)',
    'Valor debito (NIIF)', 'Valor crédito (NIIF)', 'Valor base gravable (NIIF)',
    'NOTAS',
  ],
}

// Observaciones de la regla de Siesa para cada columna (mismo orden que ENCABEZADOS).
const NOTAS: Record<keyof typeof HOJAS, string[]> = {
  documentoContable: [
    'Valida en maestro, código de centro de operación del documento',
    'Valida en maestro, código de tipo de documento',
    'Numero de documento',
    'El formato debe ser AAAAMMDD',
    'Valida en maestro, código de tercero',
    'Observaciones',
  ],
  movimientoContable: [
    'Valida en maestro, código de centro de operación del documento',
    'Valida en maestro, código de tipo de documento',
    'Numero de documento',
    'Valida en maestro, código de cuenta contable',
    'Valida en maestro, código de tercero, solo se requiere si la auxiliar contable maneja tercero',
    'Valida en maestro, código de centro de operación del movimiento, es obligatorio si la auxiliar no tiene uno por defecto.',
    'Valida en maestro, código de unidad de negocio, es obligatorio si la auxiliar no tiene uno por defecto.',
    'Valida en maestro, código de centro de costos, solo se requiere si la auxiliar contable maneja centro de costos',
    'Solo si la cuenta es disponible, valida en maestro, código de concepto de flujo de efectivo.',
    'Libro 1 (PCGA). Valor debito del asiento, si el asiento es crédito este debe ir en cero.',
    'Libro 1 (PCGA). Valor crédito del asiento, si el asiento es debito este debe ir en cero.',
    'Libro 1 (PCGA). Solo si la cuenta maneja tasa, es el valor que da origen al impuesto o retención.',
    'Libro 2 (NIIF). Valor debito del asiento, si el asiento es crédito este debe ir en cero. Aplica para cuentas que no son de banco.',
    'Libro 2 (NIIF). Valor crédito del asiento, si el asiento es debito este debe ir en cero. Aplica para cuentas que no son de banco.',
    'Libro 2 (NIIF). Solo si la cuenta maneja tasa, es el valor que da origen al impuesto o retención.',
    'Observaciones del movimiento',
  ],
}

function texto(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object' && 'text' in (v as object)) return String((v as { text: unknown }).text ?? '')
  if (typeof v === 'object' && 'result' in (v as object)) return String((v as { result: unknown }).result ?? '')
  return String(v).trim()
}

function numero(v: ExcelJS.CellValue): number {
  const n = Number(texto(v).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function fechaTexto(v: ExcelJS.CellValue): string {
  if (v instanceof Date) {
    const y = v.getUTCFullYear()
    const m = String(v.getUTCMonth() + 1).padStart(2, '0')
    const d = String(v.getUTCDate()).padStart(2, '0')
    return `${y}${m}${d}`
  }
  return texto(v).replace(/[^0-9]/g, '')
}

function filasDeHoja(ws: ExcelJS.Worksheet | undefined): ExcelJS.CellValue[][] {
  if (!ws) return []
  const filas: ExcelJS.CellValue[][] = []
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // encabezado
    const valores: ExcelJS.CellValue[] = []
    row.eachCell({ includeEmpty: true }, (cell) => valores.push(cell.value))
    if (valores.some((v) => texto(v) !== '')) filas.push(valores)
  })
  return filas
}

function columnaPorEncabezado(ws: ExcelJS.Worksheet | undefined, nombre: string): number | undefined {
  if (!ws) return undefined
  let indice: number | undefined
  ws.getRow(1).eachCell((cell, col) => {
    if (texto(cell.value).toUpperCase() === nombre) indice = col - 1
  })
  return indice
}

export async function leerExcelNiif(datos: ArrayBuffer): Promise<SaldosNiif> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(datos)
  const resultado = saldosNiifVacios()

  const wsDoc = wb.getWorksheet(HOJAS.documentoContable)
  const wsMov = wb.getWorksheet(HOJAS.movimientoContable)
  if (!wsDoc && !wsMov) {
    throw new Error(`El Excel debe tener las hojas "${HOJAS.documentoContable}" y "${HOJAS.movimientoContable}"`)
  }

  for (const f of filasDeHoja(wsDoc)) {
    resultado.documentoContable.push({
      centroOperacion: texto(f[0]), tipoDocumento: texto(f[1]), numeroDocumento: texto(f[2]),
      fecha: fechaTexto(f[3]), tercero: texto(f[4]), observaciones: texto(f[5]),
    })
  }

  const colNotas = columnaPorEncabezado(wsMov, 'NOTAS') ?? 15
  for (const f of filasDeHoja(wsMov)) {
    resultado.movimientoContable.push({
      centroOperacion: texto(f[0]), tipoDocumento: texto(f[1]), numeroDocumento: texto(f[2]),
      auxiliar: texto(f[3]), tercero: texto(f[4]), centroOperacionMov: texto(f[5]),
      unidadNegocio: texto(f[6]), centroCostos: texto(f[7]), conceptoFlujoEfectivo: texto(f[8]),
      valorDebito: numero(f[9]), valorCredito: numero(f[10]), valorBaseGravable: numero(f[11]),
      valorDebito2: numero(f[12]), valorCredito2: numero(f[13]), valorBaseGravable2: numero(f[14]),
      observaciones: texto(f[colNotas]),
    })
  }

  return resultado
}

function agregarHoja(wb: ExcelJS.Workbook, nombre: string, encabezados: string[], notas: string[], filas: unknown[][]) {
  const ws = wb.addWorksheet(nombre)
  ws.addRow(encabezados)
  ws.getRow(1).font = { bold: true }
  agregarNotasEncabezado(ws, notas)
  for (const fila of filas) ws.addRow(fila)
  ws.columns.forEach((col) => {
    let max = 10
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      max = Math.max(max, String(cell.value ?? '').length)
    })
    col.width = Math.min(max + 2, 45)
  })
}

export async function generarExcelNiif(datos: SaldosNiif): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook()

  agregarHoja(wb, HOJAS.documentoContable, ENCABEZADOS.documentoContable, NOTAS.documentoContable, datos.documentoContable.map((r) => [
    r.centroOperacion, r.tipoDocumento, r.numeroDocumento, r.fecha, r.tercero, r.observaciones,
  ]))

  agregarHoja(wb, HOJAS.movimientoContable, ENCABEZADOS.movimientoContable, NOTAS.movimientoContable, datos.movimientoContable.map((r) => [
    r.centroOperacion, r.tipoDocumento, r.numeroDocumento, r.auxiliar, r.tercero, r.centroOperacionMov,
    r.unidadNegocio, r.centroCostos, r.conceptoFlujoEfectivo,
    r.valorDebito, r.valorCredito, r.valorBaseGravable,
    r.valorDebito2, r.valorCredito2, r.valorBaseGravable2,
    r.observaciones,
  ]))

  return wb.xlsx.writeBuffer()
}
