import ExcelJS from 'exceljs'
import type { ResultadoComparacion, ResumenProcesamiento, FacturaInvoicing } from '@/types/conciliacion-facturas'
import { NIVEL_LABELS } from './constants'

const C = {
  azulOscuro: 'FF00154E', azulMedio: 'FF0047BA', azulClaro: 'FFE8F0FE',
  blanco: 'FFFFFFFF', grisClaro: 'FFF8FAFF', borde: 'FFE5E7EB',
  bordeHeader: 'FF003399', texto: 'FF111827', grisTexto: 'FF6B7280',
  verdeBg: 'FFD1FAE5', verdeTx: 'FF065F46',
  rojoBg: 'FFFEE2E2', rojoTx: 'FF991B1B',
  amarilloBg: 'FFFEF3C7', amarilloTx: 'FF92400E',
}

function encabezadoHoja(ws: ExcelJS.Worksheet, titulo: string, nCols: number) {
  ws.addRow(['KLARENS  —  Conciliación de Facturas de Proveedores'])
  ws.mergeCells(1, 1, 1, nCols)
  Object.assign(ws.getRow(1).getCell(1), {
    font: { bold: true, size: 14, color: { argb: C.blanco } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.azulOscuro } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  })
  ws.getRow(1).height = 28

  ws.addRow([titulo])
  ws.mergeCells(2, 1, 2, nCols)
  Object.assign(ws.getRow(2).getCell(1), {
    font: { bold: true, size: 11, color: { argb: C.azulOscuro } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.azulClaro } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  })
  ws.getRow(2).height = 20

  const fecha = new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })
  ws.addRow([`Generado: ${fecha}`])
  ws.mergeCells(3, 1, 3, nCols)
  Object.assign(ws.getRow(3).getCell(1), {
    font: { italic: true, size: 9, color: { argb: C.grisTexto } },
    alignment: { horizontal: 'right' },
  })
  ws.addRow([])
}

function filaEncabezados(ws: ExcelJS.Worksheet, columnas: string[]) {
  const row = ws.addRow(columnas)
  row.height = 24
  row.eachCell(cell => {
    cell.font = { bold: true, size: 10, color: { argb: C.blanco } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.azulMedio } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: C.bordeHeader } }, left: { style: 'thin', color: { argb: C.bordeHeader } },
      bottom: { style: 'thin', color: { argb: C.bordeHeader } }, right: { style: 'thin', color: { argb: C.bordeHeader } },
    }
  })
  ws.autoFilter = { from: { row: row.number, column: 1 }, to: { row: row.number, column: columnas.length } }
}

function filaDatos(ws: ExcelJS.Worksheet, valores: (string | number | null)[], colorEstado?: { bg: string; tx: string }, colEstado?: number) {
  const row = ws.addRow(valores.map(v => v ?? ''))
  row.eachCell((cell, colNumber) => {
    cell.border = {
      top: { style: 'hair', color: { argb: C.borde } }, left: { style: 'hair', color: { argb: C.borde } },
      bottom: { style: 'hair', color: { argb: C.borde } }, right: { style: 'hair', color: { argb: C.borde } },
    }
    cell.font = { size: 10, color: { argb: C.texto } }
    cell.alignment = { vertical: 'middle', wrapText: colNumber === valores.length }
    if (typeof cell.value === 'number') {
      cell.numFmt = '"$"#,##0'
      cell.alignment = { horizontal: 'right' }
    }
    if (colorEstado && colNumber === colEstado) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorEstado.bg } }
      cell.font = { bold: true, size: 10, color: { argb: colorEstado.tx } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    }
  })
  return row
}

function ajustarAnchos(ws: ExcelJS.Worksheet, columnas: string[], filas: unknown[][]) {
  ws.columns.forEach((col, i) => {
    const maxDato = filas.reduce((m, f) => Math.max(m, String(f[i] ?? '').length), 0)
    col.width = Math.min(Math.max((columnas[i]?.length ?? 8), Math.min(maxDato, 60)) + 3, 55)
  })
}

export async function exportarConciliacion(
  resultados: ResultadoComparacion[],
  resumen: ResumenProcesamiento,
  rechazadas: FacturaInvoicing[],
  exportadoPor?: string,
) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Klarens Contabilidad'
  wb.created = new Date()

  // ── Hoja: Resumen ──────────────────────────────────────────────────────
  const wsResumen = wb.addWorksheet('Resumen')
  encabezadoHoja(wsResumen, 'Resumen del procesamiento', 2)
  const pct = (n: number) => resumen.totalInvoicing > 0 ? `${((n / resumen.totalInvoicing) * 100).toFixed(1)}%` : '—'
  const filasResumen: [string, string | number][] = [
    ['Total de facturas recibidas en Invoicing', resumen.totalInvoicing],
    ['Excluidas por estar Rechazadas', resumen.totalRechazadas],
    ['Causadas', `${resumen.causadas}  (${pct(resumen.causadas)})`],
    ['No causadas', `${resumen.noCausadas}  (${pct(resumen.noCausadas)})`],
    ['Requieren revisión', `${resumen.requierenRevision}  (${pct(resumen.requierenRevision)})`],
    ['Coincidencias exactas', resumen.coincidenciasExactas],
    ['Coincidencias por normalización de formato', resumen.coincidenciasNormalizacion],
    ['Causadas por coincidencia probable (posible error de digitación en ERP)', resumen.coincidenciasProbables],
    ['Posibles documentos internos', resumen.posiblesDocumentoInterno],
    ['Documentos ERP usados más de una vez (duplicados)', resumen.duplicados],
  ]
  for (const [label, valor] of filasResumen) {
    const row = wsResumen.addRow([label, valor])
    row.getCell(1).font = { size: 11, color: { argb: C.texto } }
    row.getCell(2).font = { bold: true, size: 11, color: { argb: C.azulOscuro } }
    row.getCell(2).alignment = { horizontal: 'right' }
  }
  wsResumen.getColumn(1).width = 48
  wsResumen.getColumn(2).width = 24

  // ── Hoja: Causadas ─────────────────────────────────────────────────────
  const causadas = resultados.filter(r => r.estado === 'CAUSADA')
  const colsCausadas = ['NIT', 'Razón Social', 'Factura Invoicing', 'Factura ERP', 'Estado', 'Tipo de coincidencia', 'Valor Invoicing', 'Valor ERP', 'Monto coincide', 'Observación']
  const wsCausadas = wb.addWorksheet('CAUSADAS')
  encabezadoHoja(wsCausadas, `Facturas causadas (${causadas.length})`, colsCausadas.length)
  filaEncabezados(wsCausadas, colsCausadas)
  const filasCausadasVal = causadas.map(r => [
    r.nit, r.razonSocial, r.facturaInvoicingOriginal, r.facturaErpOriginal, r.estado,
    NIVEL_LABELS[r.nivel], r.valorInvoicing, r.montoErp, r.montoCoincide ? 'Sí' : 'No', r.observacion,
  ])
  for (const f of filasCausadasVal) filaDatos(wsCausadas, f as (string | number | null)[], { bg: C.verdeBg, tx: C.verdeTx }, 5)
  ajustarAnchos(wsCausadas, colsCausadas, filasCausadasVal)

  // ── Hoja: No causadas ──────────────────────────────────────────────────
  const noCausadas = resultados.filter(r => r.estado === 'NO_CAUSADA')
  const colsNoCausadas = ['NIT', 'Razón Social', 'Factura Invoicing', 'Valor', 'Estado', 'Observación']
  const wsNoCausadas = wb.addWorksheet('NO CAUSADAS')
  encabezadoHoja(wsNoCausadas, `Facturas pendientes de causar (${noCausadas.length})`, colsNoCausadas.length)
  filaEncabezados(wsNoCausadas, colsNoCausadas)
  const filasNoCausadasVal = noCausadas.map(r => [r.nit, r.razonSocial, r.facturaInvoicingOriginal, r.valorInvoicing, r.estado, r.observacion])
  for (const f of filasNoCausadasVal) filaDatos(wsNoCausadas, f as (string | number | null)[], { bg: C.rojoBg, tx: C.rojoTx }, 5)
  ajustarAnchos(wsNoCausadas, colsNoCausadas, filasNoCausadasVal)

  // ── Hoja: Requiere revisión (la más importante para el usuario) ───────
  const revision = resultados.filter(r => r.estado === 'REQUIERE_REVISION')
  const colsRevision = ['NIT', 'Razón Social', 'Factura Invoicing', 'Factura encontrada en ERP', 'Estado', 'Tipo de coincidencia', 'Valor Invoicing', 'Valor ERP', 'Motivo de revisión']
  const wsRevision = wb.addWorksheet('REQUIERE REVISION')
  encabezadoHoja(wsRevision, `Casos que requieren revisión humana (${revision.length})`, colsRevision.length)
  filaEncabezados(wsRevision, colsRevision)
  const filasRevisionVal = revision.map(r => [
    r.nit, r.razonSocial, r.facturaInvoicingOriginal, r.facturaErpOriginal, r.estado,
    NIVEL_LABELS[r.nivel], r.valorInvoicing, r.montoErp, r.observacion,
  ])
  for (const f of filasRevisionVal) filaDatos(wsRevision, f as (string | number | null)[], { bg: C.amarilloBg, tx: C.amarilloTx }, 5)
  ajustarAnchos(wsRevision, colsRevision, filasRevisionVal)

  // ── Hoja: Rechazadas (excluidas del análisis, informativa) ────────────
  if (rechazadas.length > 0) {
    const colsRechazadas = ['NIT', 'Razón Social', 'Factura', 'Valor', 'Estado Docto.']
    const wsRechazadas = wb.addWorksheet('RECHAZADAS (excluidas)')
    encabezadoHoja(wsRechazadas, `Facturas rechazadas — excluidas del análisis (${rechazadas.length})`, colsRechazadas.length)
    filaEncabezados(wsRechazadas, colsRechazadas)
    const filasRechazadasVal = rechazadas.map(r => [r.nit, r.razonSocial, r.facturaOriginal, r.valor, r.estadoDocto])
    for (const f of filasRechazadasVal) filaDatos(wsRechazadas, f as (string | number | null)[])
    ajustarAnchos(wsRechazadas, colsRechazadas, filasRechazadasVal)
  }

  // ── Firma ──────────────────────────────────────────────────────────────
  for (const ws of wb.worksheets) {
    ws.addRow([])
    const firma = exportadoPor
      ? `Exportado por: ${exportadoPor}  ·  Lácteos del Cesar SAS — Klarens`
      : 'Lácteos del Cesar SAS — Klarens'
    const row = ws.addRow([firma])
    ws.mergeCells(row.number, 1, row.number, Math.max(ws.columnCount, 2))
    Object.assign(row.getCell(1), {
      font: { italic: true, size: 9, color: { argb: C.grisTexto } },
      alignment: { horizontal: 'center' },
    })
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Conciliacion_Facturas_${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
