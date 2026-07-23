// Importación/exportación del Excel de creación de Activos Fijos, usando ExcelJS.
// La hoja y columnas replican el archivo "Creación de activos fijos Klarens".

import ExcelJS from 'exceljs'
import { activosFijosVacio } from './tiposAF'
import type { ActivosFijos, ActivoFijoRow } from './tiposAF'

const HOJA = 'AF'

const ENCABEZADOS = [
  'Reemplaza activo 0=No y 1=Si', 'CODIGO DEL ACTIVO (9)', 'REFERENCIA DEL ACTIVO (20)',
  'DESCRIPCIÓN DEL ACTIVO (40)', 'DESCRIPCION CORTA (20)', 'TIPO DE INVENTARIO AF', 'CO', 'UN',
  'CCOSTOS', 'TERCERO RESPONSABLE (CEDULA)', 'DEPRECIABLE 0=NO, 1=SI', 'AJUSTABLE 0=NO, 1=SI',
  'FECHA DE ADQUISICION AAAAMMDD', 'COSTO DE ADQUISICION', 'METODO DE DEPRECIACION', 'VIDA UTIL',
  'VALOR DE SALVAMENTO', 'COSTO DE ADQUISICION LIBRO NIIF', 'METODO DE DEPRE NIIF',
  'VIDA UTIL NIIF PERIODOS DEPRECIAR NIIF', 'VALOR DE SALVAMENTO NIIF',
  'PORCENTAJE DE SALVAMENTO NIIF', 'VIDA UTIL REMANENTE', 'UNIDADES REMANENTE',
  'CALCULA DEPRECIACION A LA REVALORIZACION',
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

function booleano(v: ExcelJS.CellValue): boolean {
  return texto(v) === '1'
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
    if (rowNumber === 1) return
    const valores: ExcelJS.CellValue[] = []
    row.eachCell({ includeEmpty: true }, (cell) => valores.push(cell.value))
    if (valores.some((v) => texto(v) !== '')) filas.push(valores)
  })
  return filas
}

export async function leerExcelAF(datos: ArrayBuffer): Promise<ActivosFijos> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(datos)
  const resultado = activosFijosVacio()

  for (const f of filasDeHoja(wb.getWorksheet(HOJA))) {
    const r: ActivoFijoRow = {
      reemplaza: booleano(f[0]),
      codigoActivo: texto(f[1]),
      referencia: texto(f[2]),
      descripcion: texto(f[3]),
      descripcionCorta: texto(f[4]),
      tipoInventario: texto(f[5]),
      centroOperacion: texto(f[6]),
      unidadNegocio: texto(f[7]),
      centroCostos: texto(f[8]),
      tercero: texto(f[9]),
      depreciable: booleano(f[10]),
      ajustable: booleano(f[11]),
      fechaAdquisicion: fechaTexto(f[12]),
      costoAdquisicion: numero(f[13]),
      metodoDepreciacion: texto(f[14]),
      vidaUtilPeriodos: numero(f[15]),
      valorSalvamento: numero(f[16]),
      costoAdquisicionNiif: numero(f[17]),
      metodoDepreciacionNiif: texto(f[18]),
      vidaUtilPeriodosNiif: numero(f[19]),
      valorSalvamentoNiif: numero(f[20]),
      porcentajeSalvamentoNiif: numero(f[21]),
      vidaUtilRemanente: numero(f[22]),
      unidadesRemanente: numero(f[23]),
      calculaDepreRevalorizacion: booleano(f[24]),
    }
    resultado.activos.push(r)
  }

  return resultado
}

export async function generarExcelAF(datos: ActivosFijos): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(HOJA)
  ws.addRow(ENCABEZADOS)
  ws.getRow(1).font = { bold: true }

  for (const r of datos.activos) {
    ws.addRow([
      r.reemplaza ? 1 : 0, r.codigoActivo, r.referencia, r.descripcion, r.descripcionCorta,
      r.tipoInventario, r.centroOperacion, r.unidadNegocio, r.centroCostos, r.tercero,
      r.depreciable ? 1 : 0, r.ajustable ? 1 : 0, r.fechaAdquisicion, r.costoAdquisicion,
      r.metodoDepreciacion, r.vidaUtilPeriodos, r.valorSalvamento, r.costoAdquisicionNiif,
      r.metodoDepreciacionNiif, r.vidaUtilPeriodosNiif, r.valorSalvamentoNiif,
      r.porcentajeSalvamentoNiif, r.vidaUtilRemanente, r.unidadesRemanente,
      r.calculaDepreRevalorizacion ? 1 : 0,
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
