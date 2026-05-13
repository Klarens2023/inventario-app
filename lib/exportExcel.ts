import ExcelJS from 'exceljs'

type Valor = string | number | null | undefined

// ── Paleta de colores ──────────────────────────────────────────────────────
const C = {
  azulOscuro : 'FF00154E',   // encabezado principal
  azulMedio  : 'FF0047BA',   // fila de columnas
  azulClaro  : 'FFE8F0FE',   // subtítulo
  blanco     : 'FFFFFFFF',
  grisClaro  : 'FFF8FAFF',   // fila par
  totalBg    : 'FFE2EBF8',   // fila de totales
  borde      : 'FFE5E7EB',
  bordeHeader: 'FF003399',
  texto      : 'FF111827',
  rojo       : 'FFDC2626',
  verde      : 'FF16A34A',
  grisTexto  : 'FF6B7280',
}

// ── Detección de tipo de columna ───────────────────────────────────────────
function esCurrency(col: string) {
  const l = col.toLowerCase()
  return l.includes('costo') || l.startsWith('c. ') || l.includes('valor') || l.includes('precio')
}
function esEntero(col: string) {
  const l = col.toLowerCase()
  return l.includes('cant') || l.includes('conteo') || l.includes('diferencia') ||
         l.includes('existencia') || l.includes('cantidad') || l === 'dif'
}

// ── Título legible desde el nombre de archivo ──────────────────────────────
function parseTitulo(nombre: string) {
  const partes = nombre.split('_').filter(p => !/^\d{4}-\d{2}-\d{2}$/.test(p) && p)
  return partes.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('  ·  ')
}

// ── Estilo de borde fino ───────────────────────────────────────────────────
function bordeFino(color = C.borde): Partial<ExcelJS.Borders> {
  const s: ExcelJS.BorderStyle = 'hair'
  return { top: { style: s, color: { argb: color } }, left: { style: s, color: { argb: color } },
           bottom: { style: s, color: { argb: color } }, right: { style: s, color: { argb: color } } }
}

// ── Exportar ───────────────────────────────────────────────────────────────
export async function exportarExcel(
  nombre   : string,
  columnas : string[],
  filas    : Valor[][]
) {
  const wb = new ExcelJS.Workbook()
  wb.creator  = 'Klarens Inventario'
  wb.created  = new Date()
  wb.modified = new Date()

  const ws      = wb.addWorksheet('Informe', { views: [{ state: 'frozen', ySplit: 5 }] })
  const nCols   = columnas.length
  const titulo  = parseTitulo(nombre)
  const fechaGen = new Date().toLocaleString('es-CO', {
    weekday: 'long', day: '2-digit', month: 'long',
    year: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  // ── Fila 1: Empresa ───────────────────────────────────────────────────────
  ws.addRow(['KLARENS  —  Sistema de Inventarios'])
  ws.mergeCells(1, 1, 1, nCols)
  const r1 = ws.getRow(1)
  r1.height = 30
  Object.assign(r1.getCell(1), {
    font      : { bold: true, size: 15, color: { argb: C.blanco } },
    fill      : { type: 'pattern', pattern: 'solid', fgColor: { argb: C.azulOscuro } },
    alignment : { horizontal: 'center', vertical: 'middle' },
  })

  // ── Fila 2: Título del informe ────────────────────────────────────────────
  ws.addRow([titulo])
  ws.mergeCells(2, 1, 2, nCols)
  const r2 = ws.getRow(2)
  r2.height = 22
  Object.assign(r2.getCell(1), {
    font      : { bold: true, size: 11, color: { argb: C.azulOscuro } },
    fill      : { type: 'pattern', pattern: 'solid', fgColor: { argb: C.azulClaro } },
    alignment : { horizontal: 'center', vertical: 'middle' },
  })

  // ── Fila 3: Fecha de generación ───────────────────────────────────────────
  ws.addRow([`Generado: ${fechaGen}`])
  ws.mergeCells(3, 1, 3, nCols)
  const r3 = ws.getRow(3)
  r3.height = 15
  Object.assign(r3.getCell(1), {
    font      : { italic: true, size: 9, color: { argb: C.grisTexto } },
    fill      : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } },
    alignment : { horizontal: 'right', vertical: 'middle' },
  })

  // ── Fila 4: Espaciador ────────────────────────────────────────────────────
  ws.addRow([])
  ws.getRow(4).height = 5

  // ── Fila 5: Encabezados de columnas ───────────────────────────────────────
  ws.addRow(columnas)
  const rH = ws.getRow(5)
  rH.height = 24
  for (let c = 1; c <= nCols; c++) {
    const cell = rH.getCell(c)
    cell.value     = columnas[c - 1]
    cell.font      = { bold: true, size: 10, color: { argb: C.blanco } }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.azulMedio } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border    = {
      top   : { style: 'thin', color: { argb: C.bordeHeader } },
      left  : { style: 'thin', color: { argb: C.bordeHeader } },
      bottom: { style: 'thin', color: { argb: C.bordeHeader } },
      right : { style: 'thin', color: { argb: C.bordeHeader } },
    }
  }

  // Autofiltro en encabezados
  ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: nCols } }

  // ── Filas de datos ────────────────────────────────────────────────────────
  filas.forEach((fila, rowIdx) => {
    const wsr  = ws.addRow(fila.map(v => v ?? ''))
    const bgAr = rowIdx % 2 === 0 ? C.blanco : C.grisClaro
    wsr.height = 17

    for (let c = 1; c <= nCols; c++) {
      const cell    = wsr.getCell(c)
      const colName = columnas[c - 1] ?? ''
      const val     = cell.value

      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgAr } }
      cell.border = bordeFino()
      cell.font   = { size: 10, color: { argb: C.texto } }

      if (typeof val === 'number') {
        if (esCurrency(colName)) {
          cell.numFmt    = '"$"#,##0.00'
          cell.alignment = { horizontal: 'right' }
          if (val < 0) cell.font = { size: 10, color: { argb: C.rojo } }
        } else if (esEntero(colName)) {
          cell.numFmt    = '#,##0'
          cell.alignment = { horizontal: 'right' }
          if (val < 0) cell.font = { size: 10, color: { argb: C.rojo } }
          else if (val > 0 && colName.toLowerCase().includes('dif'))
            cell.font = { size: 10, color: { argb: C.verde } }
        } else {
          cell.numFmt    = '#,##0.##'
          cell.alignment = { horizontal: 'right' }
        }
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' }
      }
    }
  })

  // ── Fila de totales ───────────────────────────────────────────────────────
  if (filas.length > 0) {
    const totales: Valor[] = columnas.map((col, i) => {
      if (i === 0) return 'TOTAL'
      const vals = filas.map(f => f[i])
      const sonNum = vals.some(v => typeof v === 'number')
      if (!sonNum) return null
      return vals.reduce<number>((s, v) => s + (typeof v === 'number' ? v : 0), 0)
    })

    const wsTot = ws.addRow(totales)
    wsTot.height = 22
    for (let c = 1; c <= nCols; c++) {
      const cell    = wsTot.getCell(c)
      const colName = columnas[c - 1] ?? ''
      const val     = cell.value

      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.totalBg } }
      cell.border = {
        top   : { style: 'medium', color: { argb: C.azulMedio } },
        left  : { style: 'hair',   color: { argb: C.borde } },
        bottom: { style: 'medium', color: { argb: C.azulMedio } },
        right : { style: 'hair',   color: { argb: C.borde } },
      }

      if (c === 1) {
        cell.font      = { bold: true, size: 10, color: { argb: C.azulOscuro } }
        cell.alignment = { horizontal: 'left', vertical: 'middle' }
      } else if (typeof val === 'number') {
        if (esCurrency(colName)) {
          cell.numFmt    = '"$"#,##0.00'
          cell.alignment = { horizontal: 'right' }
          cell.font      = { bold: true, size: 10, color: { argb: val < 0 ? C.rojo : C.texto } }
        } else if (esEntero(colName)) {
          cell.numFmt    = '#,##0'
          cell.alignment = { horizontal: 'right' }
          cell.font      = { bold: true, size: 10 }
        } else {
          cell.font = { bold: true, size: 10 }
        }
      }
    }
  }

  // ── Fila de firma ─────────────────────────────────────────────────────────
  const filaFirmaIdx = 5 + filas.length + (filas.length > 0 ? 1 : 0) + 2  // 2 filas de separación
  ws.addRow([])
  ws.addRow([])
  const firmaTexto = 'Desarrollado por el Área de Sistemas  ·  Luis Alberto Torres — Asistente de Sistemas  ·  Lácteos del Cesar SAS — Klarens'
  ws.addRow([firmaTexto])
  const firmaRowNum = ws.lastRow!.number
  ws.mergeCells(firmaRowNum, 1, firmaRowNum, nCols)
  const rFirma = ws.getRow(firmaRowNum)
  rFirma.height = 18
  Object.assign(rFirma.getCell(1), {
    font      : { italic: true, size: 9, color: { argb: C.grisTexto } },
    fill      : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } },
    alignment : { horizontal: 'center', vertical: 'middle' },
    border    : {
      top   : { style: 'thin', color: { argb: C.azulMedio } },
      left  : { style: 'hair', color: { argb: C.borde } },
      bottom: { style: 'hair', color: { argb: C.borde } },
      right : { style: 'hair', color: { argb: C.borde } },
    },
  })

  // ── Anchos de columna ─────────────────────────────────────────────────────
  ws.columns.forEach((col, i) => {
    const maxData = filas.reduce((m, f) => Math.max(m, String(f[i] ?? '').length), 0)
    col.width = Math.min(Math.max((columnas[i]?.length ?? 8), maxData) + 4, 45)
  })

  // ── Descargar ─────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const blob   = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href    = url
  a.download = `${nombre}_${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
