// Importación/exportación del Excel de Adopción NIIF por primera vez, usando ExcelJS.
// La hoja y columnas replican el archivo "Adopcion por primera vez_bnieves@klarens.com.co (1)",
// que sí trae "Valor salvamento" y "Porcentaje salvamento" (entre vida útil NIIF y método de costo).

import ExcelJS from 'exceljs'
import { adopcionNiifVacio } from './tiposAdopcion'
import type { AdopcionNiif, AdopcionNiifRow } from './tiposAdopcion'
import { agregarNotasEncabezado } from './notasExcel'

const HOJA = 'Adopción por primera vez'

const ENCABEZADOS = [
  'Compañía', 'Codigo activo fijo', 'Codigo activo fijo Adicion', 'Costo de adquisición de la adición',
  'Vida útil en periodos a depreciación NIIF', 'Valor salvamento', 'Porcentaje salvamento',
  'Código del metodo de costo de adopción por primera vez', 'Costo', 'Depreciación costo',
  'Costo Revalorización', 'Costo depreciación revalorización', 'Costo deterioro',
]

// Observaciones de la regla de Siesa para cada columna, en el mismo orden que ENCABEZADOS.
const NOTAS = [
  'Valida en maestro, código de la compañía a la cual pertenece la información del registro',
  'Código del activo fijo',
  'Código del activo fijo de la adición al activo fijo principal. 0=cuando se quiere afectar el activo principal',
  'El valor es cero(0), se respeta el valor actual.',
  '0=Respeta el valor actual. Aplica si el método es 1=Línea recta o 2=Reducción de saldos; si es 3=Unidades de producción debe ser cero.',
  'Si método NIIF=3 (Unidades de producción) debe ser 0.',
  'Si método NIIF=3 debe ser 0; solo se tiene en cuenta si el valor de salvamento es 0. Si se digita 100% asume los valores de salvamento local.',
  '0=Manual, 1=Costo histórico, 2=Avalúo (valor razonable), 3=Costo revaluado',
  'Obligatorio si el método de costo es 0=Manual. Si el costo es 0, toma el valor actual o el costo de adquisición del activo.',
  'Opcional. Aplica si el método de costo es manual y el activo es depreciable.',
  'Aplica si el método de costo es manual. Excluyente con el costo deterioro.',
  'Aplica si el método de costo es manual, hay costo de revalorización y el activo es depreciable. Excluyente con el costo deterioro.',
  'Aplica si el método de costo es manual. Excluyente con el costo de revalorización.',
]

function texto(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object' && 'text' in (v as object)) return String((v as { text: unknown }).text ?? '')
  return String(v).trim()
}

function numero(v: ExcelJS.CellValue): number {
  const n = Number(texto(v).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function filasDeHoja(ws: ExcelJS.Worksheet | undefined): ExcelJS.CellValue[][] {
  if (!ws) return []
  const filas: ExcelJS.CellValue[][] = []
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const valores: ExcelJS.CellValue[] = []
    row.eachCell({ includeEmpty: true }, (cell) => valores.push(cell.value))
    if (valores.some((v) => texto(v) !== '')) filas.push(valores)
  })
  return filas
}

export async function leerExcelAdopcion(datos: ArrayBuffer): Promise<AdopcionNiif> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(datos)
  const resultado = adopcionNiifVacio()
  const ws = wb.getWorksheet(HOJA)
  const filas = filasDeHoja(ws)

  if (filas[0]?.[0]) resultado.compania = texto(filas[0][0])

  for (const f of filas) {
    const r: AdopcionNiifRow = {
      codigoActivo: texto(f[1]),
      codigoActivoAdicion: texto(f[2]) || '0',
      costoAdquisicionAdicion: numero(f[3]),
      vidaUtilPeriodosNiif: numero(f[4]),
      valorSalvamentoNiif: numero(f[5]),
      porcentajeSalvamentoNiif: numero(f[6]),
      metodoCosto: texto(f[7]) || '0',
      costo: numero(f[8]),
      depreciacionCosto: numero(f[9]),
      costoRevalorizacion: numero(f[10]),
      depreciacionRevalorizacion: numero(f[11]),
      costoDeterioro: numero(f[12]),
    }
    resultado.registros.push(r)
  }

  return resultado
}

export async function generarExcelAdopcion(datos: AdopcionNiif): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(HOJA)
  ws.addRow(ENCABEZADOS)
  ws.getRow(1).font = { bold: true }
  agregarNotasEncabezado(ws, NOTAS)

  for (const r of datos.registros) {
    ws.addRow([
      datos.compania, r.codigoActivo, r.codigoActivoAdicion, r.costoAdquisicionAdicion,
      r.vidaUtilPeriodosNiif, r.valorSalvamentoNiif, r.porcentajeSalvamentoNiif, r.metodoCosto,
      r.costo, r.depreciacionCosto, r.costoRevalorizacion, r.depreciacionRevalorizacion, r.costoDeterioro,
    ])
  }

  ws.columns.forEach((col) => {
    let max = 10
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      max = Math.max(max, String(cell.value ?? '').length)
    })
    col.width = Math.min(max + 2, 45)
  })

  return wb.xlsx.writeBuffer()
}
