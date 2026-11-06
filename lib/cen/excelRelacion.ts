// Excel de la relación de despacho (reportes de órdenes EDI), como las hojas por ruta del libro de
// logística: líneas, totales por ítem y por cliente, y la planilla de control de entrega para firmar.
// Se arma en el navegador.
import ExcelJS from 'exceljs'
import type { FilaRelacion } from './reportes'

const AZUL = 'FF0047BA', AZUL_OSCURO = 'FF00154E', TOTAL = 'FFE2EBF8', BLANCO = 'FFFFFFFF'
const borde: Partial<ExcelJS.Borders> = Object.fromEntries(['top', 'left', 'bottom', 'right'].map(k => [k, { style: 'thin', color: { argb: 'FFCBD5E1' } }]))

function encabezado(ws: ExcelJS.Worksheet, titulo: string, subtitulo: string, columnas: { h: string; w: number }[]) {
  ws.columns = columnas.map(c => ({ width: c.w }))
  ws.mergeCells(1, 1, 1, columnas.length); ws.getCell(1, 1).value = titulo
  ws.getCell(1, 1).style = { font: { bold: true, size: 14, color: { argb: BLANCO } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_OSCURO } }, alignment: { vertical: 'middle' } }
  ws.getRow(1).height = 26
  ws.mergeCells(2, 1, 2, columnas.length); ws.getCell(2, 1).value = subtitulo; ws.getCell(2, 1).font = { italic: true, color: { argb: 'FF475569' } }
  const r = ws.getRow(4)
  columnas.forEach((c, i) => { const x = r.getCell(i + 1); x.value = c.h; x.style = { font: { bold: true, color: { argb: BLANCO } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }, alignment: { wrapText: true, vertical: 'middle', horizontal: 'center' }, border: borde } })
  r.height = 30
  ws.views = [{ state: 'frozen', ySplit: 4 }]
}

function fila(ws: ExcelJS.Worksheet, valores: (string | number | null)[], formatos: (string | undefined)[], total = false) {
  const r = ws.addRow(valores)
  r.eachCell({ includeEmpty: true }, (c, n) => {
    c.border = borde; c.alignment = { vertical: 'top', wrapText: true }
    if (formatos[n - 1]) c.numFmt = formatos[n - 1]!
    if (total) { c.font = { bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL } } }
  })
  return r
}

const MONEDA = '"$"#,##0', ENTERO = '#,##0', KG = '#,##0.0" kg"', DEC = '#,##0.0', TEXTO = '@'

export async function excelRelacion(relaciones: string[], filas: FilaRelacion[], periodo: string, exportadoPor?: string) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Klarens Inventario'; wb.created = new Date()
  const titulo = relaciones.length === 1 ? `RELACIÓN ${relaciones[0]}` : `RELACIONES ${relaciones.join(', ')}`
  const sub = `${periodo} · Generado ${new Date().toLocaleString('es-CO')}${exportadoPor ? ` por ${exportadoPor}` : ''}`
  const sum = (xs: FilaRelacion[], k: 'cantidad' | 'valor') => xs.reduce((s, x) => s + x[k], 0)
  const peso = (xs: FilaRelacion[]) => xs.some(x => x.peso === null) ? null : xs.reduce((s, x) => s + (x.peso ?? 0), 0)
  const cajas = (xs: FilaRelacion[]) => xs.every(x => x.cajas === null) ? null : Math.round(xs.reduce((s, x) => s + (x.cajas ?? 0), 0) * 10) / 10

  // 1. Líneas (como las hojas de relación del libro)
  const w1 = wb.addWorksheet('Relación')
  encabezado(w1, titulo, sub, [
    { h: 'Relación', w: 15 }, { h: 'OC', w: 16 }, { h: 'Cliente', w: 12 }, { h: 'F. despacho', w: 12 }, { h: 'F. mín. entrega', w: 12 }, { h: 'F. máx. entrega', w: 12 }, { h: 'Ciudad', w: 15 },
    { h: 'Punto de venta', w: 32 }, { h: 'Ítem Siesa', w: 9 }, { h: 'Descripción', w: 34 }, { h: 'Cant. despacho', w: 11 }, { h: 'Valor', w: 14 },
    { h: 'Peso', w: 11 }, { h: 'Cajas', w: 8 }, { h: 'Pedido Siesa', w: 13 },
  ])
  const fmt1 = [undefined, TEXTO, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, ENTERO, MONEDA, KG, DEC, undefined]
  let ocAnterior = ''
  for (const f of filas) {
    if (ocAnterior && f.numero_orden !== ocAnterior) w1.addRow([]) // una fila en blanco entre órdenes, como en el libro
    fila(w1, [f.relacion, f.numero_orden, f.cadena, f.fecha_despacho, f.fecha_entrega, f.fecha_entrega_max ?? f.fecha_entrega, f.ciudad, f.razon_social, f.f120_id, f.descripcion,
      f.cantidad, f.valor, f.peso, f.cajas, f.pedido || null], fmt1)
    ocAnterior = f.numero_orden
  }
  fila(w1, ['Total general', null, null, null, null, null, null, null, null, null, sum(filas, 'cantidad'), sum(filas, 'valor'), peso(filas), cajas(filas), null], fmt1, true)

  // 2. Totales por ítem
  const w2 = wb.addWorksheet('Totales por ítem')
  encabezado(w2, `${titulo} · Totales por ítem`, sub, [{ h: 'Ítem Siesa', w: 10 }, { h: 'Descripción', w: 40 }, { h: 'Cant. despacho', w: 13 }, { h: '$ Total', w: 15 }, { h: 'Peso', w: 12 }, { h: 'Cajas', w: 9 }])
  const porItem = new Map<string, FilaRelacion[]>(); for (const f of filas) porItem.set(f.ean_item, [...(porItem.get(f.ean_item) ?? []), f])
  const fmt2 = [undefined, undefined, ENTERO, MONEDA, KG, DEC]
  for (const xs of Array.from(porItem.values()).sort((a, b) => a[0].descripcion.localeCompare(b[0].descripcion)))
    fila(w2, [xs[0].f120_id, xs[0].descripcion, sum(xs, 'cantidad'), sum(xs, 'valor'), peso(xs), cajas(xs)], fmt2)
  fila(w2, [null, 'Total general', sum(filas, 'cantidad'), sum(filas, 'valor'), peso(filas), cajas(filas)], fmt2, true)

  // 3. Totales por cliente (punto de venta) con sus ítems
  const w3 = wb.addWorksheet('Totales por cliente')
  encabezado(w3, `${titulo} · Totales por cliente`, sub, [{ h: 'Cliente / punto de venta', w: 44 }, { h: 'Ítem Siesa', w: 10 }, { h: 'Descripción', w: 36 }, { h: 'Cant. despacho', w: 13 }, { h: '$ Total', w: 15 }, { h: 'Peso', w: 12 }])
  const porPunto = new Map<string, FilaRelacion[]>(); for (const f of filas) { const k = `${f.cadena} · ${f.razon_social}`; porPunto.set(k, [...(porPunto.get(k) ?? []), f]) }
  const fmt3 = [undefined, undefined, undefined, ENTERO, MONEDA, KG]
  for (const [punto, xs] of Array.from(porPunto).sort((a, b) => a[0].localeCompare(b[0]))) {
    const r = fila(w3, [punto, null, null, sum(xs, 'cantidad'), sum(xs, 'valor'), peso(xs)], fmt3); r.font = { bold: true }
    const items = new Map<string, FilaRelacion[]>(); for (const f of xs) items.set(f.ean_item, [...(items.get(f.ean_item) ?? []), f])
    for (const is of Array.from(items.values())) fila(w3, [null, is[0].f120_id, is[0].descripcion, sum(is, 'cantidad'), sum(is, 'valor'), peso(is)], fmt3)
  }
  fila(w3, ['Total general', null, null, sum(filas, 'cantidad'), sum(filas, 'valor'), peso(filas)], fmt3, true)

  // 4. Control de entrega (planilla para firmar al entregar la relación al transportador)
  const w4 = wb.addWorksheet('Control de entrega')
  encabezado(w4, 'CONTROL DE ENTREGA', sub, [{ h: 'Fecha despacho', w: 12 }, { h: 'Relación', w: 18 }, { h: 'OC', w: 16 }, { h: 'Punto de venta', w: 34 }, { h: 'Cajas', w: 8 }, { h: 'Peso', w: 11 }, { h: 'Entrega', w: 18 }, { h: 'Recibe', w: 18 }, { h: 'Observaciones', w: 28 }])
  const porOc = new Map<string, FilaRelacion[]>(); for (const f of filas) porOc.set(`${f.relacion}|${f.numero_orden}`, [...(porOc.get(`${f.relacion}|${f.numero_orden}`) ?? []), f])
  for (const xs of Array.from(porOc.values())) {
    const r = fila(w4, [xs[0].fecha_despacho, xs[0].relacion, xs[0].numero_orden, xs[0].razon_social, cajas(xs), peso(xs), null, null, null], [undefined, undefined, TEXTO, undefined, DEC, KG])
    r.height = 24
  }
  w4.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }
  for (const w of [w1, w2, w3]) w.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }

  const buffer = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url; a.download = `Relacion_${relaciones.length === 1 ? relaciones[0] : 'despacho'}_${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
}
