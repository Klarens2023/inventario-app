// Importación/exportación del Excel de Adiciones de Activos Fijos, usando ExcelJS.
// La hoja y columnas replican el archivo "Adiciones Activos Fijos_AF00039.xlsx".

import ExcelJS from 'exceljs'
import { adicionesAFVacio } from './tiposAdiciones'
import type { AdicionesAF, AdicionAFRow } from './tiposAdiciones'
import { agregarNotasEncabezado } from './notasExcel'

const HOJA = 'Adiciones'

const ENCABEZADOS = [
  'Reemplaza la información 0=No, 1=Si', 'Código de activo fijo', 'Número o código de adición',
  'Descripción de la adición', 'Número de piezas', 'Fecha de adquisición (AAAAMMDD)',
  'Costo de adquisición de la adición', 'Método de depreciación local (0-3)', 'Vida útil de la adición',
  'Unidades a depreciar', 'Valor del salvamento', 'Porcentaje de salvamento',
  'Costo de adquisición de la adición NIIF', 'Método de depreciación NIIF (0-3)', 'Vida útil NIIF',
  'Unidades NIIF a depreciar', 'Valor NIIF del salvamento', 'Porcentaje NIIF de salvamento',
  'Vida útil remanente', 'Unidades remanente',
]

// Observaciones de la regla de Siesa para cada columna, en el mismo orden que ENCABEZADOS.
// Nota: f263_ind_genera_ajuste es obligatoria en el spec pero no tiene columna aquí — queda
// fija en 0 en el motor de generación (ver generarTxtAdiciones.ts).
const NOTAS = [
  '0=No, 1=Si',
  'Valida en maestro activos fijos.',
  'Valida en maestro, no debe existir, valor entre 1 y 999.',
  'Descripción de la adición',
  'Número entre 1 y 99999999',
  'El formato debe ser AAAAMMDD, debe ser una fecha menor o igual a la actual',
  'Mayor a cero(0). El número de decimales según lo configurado en la moneda.',
  '0=No depreciable; 1=Linea recta; 2=Reducción de saldos; 3=Unidades de producción',
  'Si método 1 o 2: entre 1 y 9999. Si método 0 o 3: debe ser 0.',
  'Si método=3 (unidades de producción): entre 1 y 9999999999999. Si método 0, 1 o 2: debe ser 0.',
  'Si método=2 y porcentaje de salvamento=0, debe ser mayor a 0.',
  'Si método=2 y valor de salvamento=0, debe ser mayor a 0. Formato: 3 enteros + punto + 6 decimales.',
  'Mayor a cero(0). El número de decimales según lo configurado en la moneda.',
  '0=No depreciable; 1=Linea recta; 2=Reducción de saldos; 3=Unidades de producción. Si método local=0, debe ser 0.',
  'Si método NIIF 1 o 2: entre 1 y 9999. Si método 0 o 3: debe ser 0.',
  'Si método local=3 y NIIF=3, hereda el valor local; si local≠3 y NIIF=3: entre 1 y 9999999999999. Si método NIIF 0, 1 o 2: debe ser 0.',
  'Si método NIIF=2 y porcentaje de salvamento NIIF=0, debe ser mayor a 0.',
  'Si método NIIF=2 y valor de salvamento NIIF=0, debe ser mayor a 0. Formato: 3 enteros + punto + 6 decimales.',
  'Debe estar entre 1 y 9999. Si método de depreciación es 0 o 3, debe ser 0.',
  'Se debe dejar en cero por el momento.',
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

export async function leerExcelAdiciones(datos: ArrayBuffer): Promise<AdicionesAF> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(datos)
  const resultado = adicionesAFVacio()

  for (const f of filasDeHoja(wb.getWorksheet(HOJA))) {
    const r: AdicionAFRow = {
      reemplaza: booleano(f[0]),
      codigoActivo: texto(f[1]),
      numeroAdicion: texto(f[2]),
      descripcion: texto(f[3]),
      numeroPiezas: numero(f[4]) || 1,
      fechaAdquisicion: fechaTexto(f[5]),
      costoAdquisicion: numero(f[6]),
      metodoDepreciacion: texto(f[7]) || '1',
      vidaUtilPeriodos: numero(f[8]),
      unidadesDepreciar: numero(f[9]),
      valorSalvamento: numero(f[10]),
      porcentajeSalvamento: numero(f[11]),
      costoAdquisicionNiif: numero(f[12]),
      metodoDepreciacionNiif: texto(f[13]) || '1',
      vidaUtilPeriodosNiif: numero(f[14]),
      unidadesDepreciarNiif: numero(f[15]),
      valorSalvamentoNiif: numero(f[16]),
      porcentajeSalvamentoNiif: numero(f[17]),
      vidaUtilRemanente: numero(f[18]),
      unidadesRemanente: numero(f[19]),
    }
    resultado.adiciones.push(r)
  }

  return resultado
}

export async function generarExcelAdiciones(datos: AdicionesAF): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(HOJA)
  ws.addRow(ENCABEZADOS)
  ws.getRow(1).font = { bold: true }
  agregarNotasEncabezado(ws, NOTAS)

  for (const r of datos.adiciones) {
    ws.addRow([
      r.reemplaza ? 1 : 0, r.codigoActivo, r.numeroAdicion, r.descripcion, r.numeroPiezas,
      r.fechaAdquisicion, r.costoAdquisicion, r.metodoDepreciacion, r.vidaUtilPeriodos,
      r.unidadesDepreciar, r.valorSalvamento, r.porcentajeSalvamento, r.costoAdquisicionNiif,
      r.metodoDepreciacionNiif, r.vidaUtilPeriodosNiif, r.unidadesDepreciarNiif,
      r.valorSalvamentoNiif, r.porcentajeSalvamentoNiif, r.vidaUtilRemanente, r.unidadesRemanente,
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
