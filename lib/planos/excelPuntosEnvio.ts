// Importación/exportación del Excel de Puntos de Envío, usando ExcelJS.
// Formato "una fila = un punto de envío" (registro 215 v04 de Siesa).

import ExcelJS from 'exceljs'
import { puntosEnvioVacio } from './tiposPuntosEnvio'
import type { PuntosEnvio } from './tiposPuntosEnvio'
import { agregarNotasEncabezado } from './notasExcel'

const HOJA = 'Puntos de envio'

const ENCABEZADOS = [
  'Reemplaza si ya existe 0=No, 1=Si',
  'Código del cliente',
  'Sucursal del cliente',
  'Código punto de envío',
  'Descripción',
  'Vendedor',
  'Contacto',
  'Dirección 1',
  'Dirección 2',
  'Dirección 3',
  'País',
  'Departamento',
  'Ciudad',
  'Barrio',
  'Teléfono',
  'Fax',
  'Código postal',
  'Email',
  'Parámetro EDI',
  'Código EAN',
  'Activo 0=No, 1=Si',
  'Criterio mayor cliente',
  'Valor pedido mínimo',
  'Celular',
]

const NOTAS = [
  '0=No, 1=Si. Si el punto de envío ya existe y la deja en 1, reemplaza su información.',
  'Obligatorio. Código del cliente tal como está en Siesa (F215_ID_TERCERO), máx. 15 caracteres.',
  'Obligatorio. Sucursal del cliente (F215_ID_SUCURSAL), 3 caracteres. Si escribe 1 se envía 001.',
  'Obligatorio. Código del punto de envío (F215_ID), 3 caracteres, debe ser diferente de 000. Si escribe 1 se envía 001.',
  'Obligatorio. Descripción del punto de envío, máx. 40 caracteres.',
  'Valida en maestro, código de vendedor asignado al punto de envío (máx. 4 caracteres).',
  'Nombre de la persona de contacto, máx. 50 caracteres.',
  'Renglón 1 de la dirección del contacto, máx. 40 caracteres.',
  'Renglón 2 de la dirección del contacto, máx. 40 caracteres.',
  'Renglón 3 de la dirección del contacto, máx. 40 caracteres.',
  'Valida en maestro, código del país (Colombia = 169).',
  'Valida en maestro, código del departamento (2 dígitos, ej. Cesar = 20). Solo se usa si hay país.',
  'Valida en maestro, código de la ciudad (3 dígitos, ej. Valledupar = 001). Solo se usa si hay departamento.',
  'Barrio, máx. 40 caracteres.',
  'Teléfono, máx. 20 caracteres.',
  'Fax, máx. 20 caracteres.',
  'Código postal o apartado aéreo, máx. 10 caracteres.',
  'Dirección de correo electrónico, máx. 50 caracteres.',
  'Código del parámetro EDI, valida en maestro de parámetros EDI (máx. 4 caracteres).',
  'Código EAN del cliente, máx. 35 caracteres.',
  '1=Activo, 0=Inactivo. Si se deja vacío se toma como activo.',
  'Código del criterio mayor del cliente (máx. 10). Valida si viene con el parámetro EDI y que exista en un plan.',
  'Valor del pedido mínimo. Si no aplica déjelo en 0.',
  'Número de celular del contacto, máx. 50 caracteres.',
]

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

function booleano(v: ExcelJS.CellValue, porDefecto: boolean): boolean {
  const s = texto(v).toLowerCase()
  if (s === '') return porDefecto
  return s === '1' || s === 'si' || s === 'sí'
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

export async function leerExcelPuntosEnvio(datos: ArrayBuffer): Promise<PuntosEnvio> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(datos)
  const resultado = puntosEnvioVacio()

  // Si la hoja no se llama exactamente igual, se usa la primera del libro.
  const ws = wb.getWorksheet(HOJA) ?? wb.worksheets[0]
  for (const f of filasDeHoja(ws)) {
    resultado.puntos.push({
      reemplaza: booleano(f[0], true),
      tercero: texto(f[1]),
      sucursal: texto(f[2]),
      codigo: texto(f[3]),
      descripcion: texto(f[4]),
      vendedor: texto(f[5]),
      contacto: texto(f[6]),
      direccion1: texto(f[7]),
      direccion2: texto(f[8]),
      direccion3: texto(f[9]),
      pais: texto(f[10]),
      departamento: texto(f[11]),
      ciudad: texto(f[12]),
      barrio: texto(f[13]),
      telefono: texto(f[14]),
      fax: texto(f[15]),
      codigoPostal: texto(f[16]),
      email: texto(f[17]),
      parametroEdi: texto(f[18]),
      codigoEan: texto(f[19]),
      activo: booleano(f[20], true),
      criterioMayor: texto(f[21]),
      pedidoMinimo: numero(f[22]),
      celular: texto(f[23]),
    })
  }

  return resultado
}

export async function generarExcelPuntosEnvio(datos: PuntosEnvio): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(HOJA)
  ws.addRow(ENCABEZADOS)
  ws.getRow(1).font = { bold: true }
  agregarNotasEncabezado(ws, NOTAS)

  // Columnas de códigos como texto, para que Excel no quite los ceros a la izquierda.
  for (const col of [2, 3, 4, 11, 12, 13]) ws.getColumn(col).numFmt = '@'

  for (const r of datos.puntos) {
    ws.addRow([
      r.reemplaza ? 1 : 0, r.tercero, r.sucursal, r.codigo, r.descripcion, r.vendedor, r.contacto,
      r.direccion1, r.direccion2, r.direccion3, r.pais, r.departamento, r.ciudad, r.barrio,
      r.telefono, r.fax, r.codigoPostal, r.email, r.parametroEdi, r.codigoEan,
      r.activo ? 1 : 0, r.criterioMayor, r.pedidoMinimo, r.celular,
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
