// Importación/exportación del Excel de Impuestos y Retenciones, usando ExcelJS.
// Formato "una fila = un registro del plano" (tercero + clase + configuración),
// igual que la hoja "Impuestos" del tercero en Siesa.

import ExcelJS from 'exceljs'
import { impuestosRetencionesVacio } from './tiposImpuestos'
import type { ImpuestosRetenciones, ImpuestoRetencionRow } from './tiposImpuestos'
import { agregarNotasEncabezado } from './notasExcel'
import {
  buscarClasePorSigla, buscarLlave, catalogoClases, catalogoLlaves,
  type TipoTercero, type Concepto,
} from './catalogosImpuestos'

const HOJA = 'Impuestos y Retenciones'

const ENCABEZADOS = [
  'Reemplaza si ya existe 0=No, 1=Si',
  'Código de tercero',
  'Sucursal',
  'Tipo (Cliente / Proveedor)',
  'Concepto (Impuesto / Retención)',
  'Clase',
  'Valor (0/1/2)',
  'Llave',
]

const NOTAS = [
  '0=No, 1=Si. Si ya existe esta clase configurada para el tercero y la deja en 1, la reemplaza.',
  'Código del cliente o proveedor tal como está en Siesa (F_ID_TERCERO).',
  'Sucursal del cliente/proveedor (F_ID_SUCURSAL).',
  'Escriba "Cliente" o "Proveedor". Junto con Concepto define el tipo de registro: Cliente+Impuesto=46, Cliente+Retención=47, Proveedor+Impuesto=49, Proveedor+Retención=50.',
  'Escriba "Impuesto" o "Retención".',
  'Sigla de la clase tal como aparece en Siesa (IVA, ICO, RENTA, RTBIENES, etc). Debe existir en el catálogo de Clases de Impuestos o de Retención según el Concepto.',
  '0=No aplica/No retiene, 1=Aplica/Retiene/Sujeto a retención, 2=Régimen especial/Autoretenedor (según la clase, ver Anexo 2 de la regla de Siesa).',
  'Código de la llave (ver catálogo de llaves de impuestos/retenciones de la clase). Déjelo en blanco si la clase no requiere llave.',
]

function texto(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object' && 'text' in (v as object)) return String((v as { text: unknown }).text ?? '')
  return String(v).trim()
}

function booleano(v: ExcelJS.CellValue): boolean {
  const s = texto(v).toLowerCase()
  return s === '1' || s === 'si' || s === 'sí'
}

function normalizarTipo(v: ExcelJS.CellValue): TipoTercero {
  const s = texto(v).toLowerCase()
  if (s.startsWith('prov')) return 'proveedor'
  if (s.startsWith('cli')) return 'cliente'
  throw new Error(`Tipo "${texto(v)}" inválido, use "Cliente" o "Proveedor"`)
}

function normalizarConcepto(v: ExcelJS.CellValue): Concepto {
  const s = texto(v).toLowerCase()
  if (s.startsWith('imp')) return 'impuesto'
  if (s.startsWith('ret')) return 'retencion'
  throw new Error(`Concepto "${texto(v)}" inválido, use "Impuesto" o "Retención"`)
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

// Valida clase y llave contra los catálogos reales; lanza un error claro con
// las opciones válidas si el dato no coincide con lo que Siesa tiene configurado.
function validarFila(r: ImpuestoRetencionRow, numeroFila: number) {
  const clase = buscarClasePorSigla(r.concepto, r.clase)
  if (!clase) {
    const opciones = catalogoClases(r.concepto).map((c) => c.sigla).join(', ')
    throw new Error(`Fila ${numeroFila}: la clase "${r.clase}" no existe para ${r.concepto === 'impuesto' ? 'Impuestos' : 'Retenciones'}. Opciones válidas: ${opciones}`)
  }
  if (r.llave.trim()) {
    const llave = buscarLlave(r.concepto, clase.sigla, r.llave)
    if (!llave) {
      const llavesClase = catalogoLlaves(r.concepto)[clase.sigla]
      const opciones = llavesClase ? llavesClase.map((l) => `${l.codigo}=${l.descripcion}`).join(' | ') : '(esta clase no tiene llaves configuradas)'
      throw new Error(`Fila ${numeroFila}: la llave "${r.llave}" no es válida para la clase "${clase.sigla}". Opciones válidas: ${opciones}`)
    }
  }
}

export async function leerExcelImpuestos(datos: ArrayBuffer): Promise<ImpuestosRetenciones> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(datos)
  const resultado = impuestosRetencionesVacio()

  const filas = filasDeHoja(wb.getWorksheet(HOJA))
  filas.forEach((f, i) => {
    const r: ImpuestoRetencionRow = {
      reemplaza: booleano(f[0]),
      tercero: texto(f[1]),
      sucursal: texto(f[2]),
      tipo: normalizarTipo(f[3]),
      concepto: normalizarConcepto(f[4]),
      clase: texto(f[5]),
      valor: texto(f[6]) || '1',
      llave: texto(f[7]),
    }
    validarFila(r, i + 2) // +2: fila 1 es encabezado, i es 0-based
    resultado.registros.push(r)
  })

  return resultado
}

export async function generarExcelImpuestos(datos: ImpuestosRetenciones): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(HOJA)
  ws.addRow(ENCABEZADOS)
  ws.getRow(1).font = { bold: true }
  agregarNotasEncabezado(ws, NOTAS)

  for (const r of datos.registros) {
    ws.addRow([
      r.reemplaza ? 1 : 0,
      r.tercero,
      r.sucursal,
      r.tipo === 'cliente' ? 'Cliente' : 'Proveedor',
      r.concepto === 'impuesto' ? 'Impuesto' : 'Retención',
      r.clase,
      r.valor,
      r.llave,
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
