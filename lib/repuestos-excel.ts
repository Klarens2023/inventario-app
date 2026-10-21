import ExcelJS from 'exceljs'
import type { ReporteConsumo, FiltrosConsumo } from '@/types/repuestos'

const AZUL_OSCURO = 'FF00154E'
const AZUL_MEDIO  = 'FF0047BA'
const AZUL_CLARO  = 'FFE8F0FE'
const BLANCO      = 'FFFFFFFF'
const FMT_PESOS   = '"$"#,##0;-"$"#,##0;"-"'

type Col = { titulo: string; ancho: number; pesos?: boolean; fecha?: boolean }

function hoja(wb: ExcelJS.Workbook, nombre: string, subtitulo: string, cols: Col[], filas: (string | number | null)[][]) {
  const ws = wb.addWorksheet(nombre, { views: [{ state: 'frozen', ySplit: 4 }] })
  ws.columns = cols.map(c => ({ width: c.ancho }))

  ws.addRow(['KLARENS  —  Consumo y gasto de repuestos, insumos y periféricos TIC'])
  ws.mergeCells(1, 1, 1, cols.length)
  Object.assign(ws.getRow(1).getCell(1), {
    font: { bold: true, size: 13, color: { argb: BLANCO } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_OSCURO } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  })
  ws.getRow(1).height = 26
  ws.addRow([subtitulo])
  ws.mergeCells(2, 1, 2, cols.length)
  Object.assign(ws.getRow(2).getCell(1), {
    font: { bold: true, size: 10, color: { argb: AZUL_OSCURO } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_CLARO } },
    alignment: { horizontal: 'center' },
  })
  ws.addRow([])

  const h = ws.addRow(cols.map(c => c.titulo))
  h.height = 22
  h.eachCell(cell => {
    cell.font = { bold: true, color: { argb: BLANCO } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_MEDIO } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  })
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: cols.length } }

  for (const f of filas) ws.addRow(f.map(v => v ?? ''))
  cols.forEach((c, i) => {
    if (c.pesos) ws.getColumn(i + 1).numFmt = FMT_PESOS
  })

  // Totales con fórmula para las columnas de pesos y unidades
  if (filas.length > 0) {
    const ini = 5, fin = 4 + filas.length
    const tot = ws.addRow(cols.map((c, i) => {
      if (i === 0) return 'TOTAL'
      if (c.titulo === 'Gasto' || c.titulo === 'Unidades') {
        const L = ws.getColumn(i + 1).letter
        return { formula: `SUBTOTAL(9,${L}${ini}:${L}${fin})` }
      }
      return ''
    }))
    tot.font = { bold: true }
    tot.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_CLARO } } })
  }
  return ws
}

export async function exportarConsumo(r: ReporteConsumo, f: FiltrosConsumo) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Inventario TIC'
  const periodo = `Periodo ${f.desde} a ${f.hasta}` + (f.categoria ? ` · ${f.categoria}` : '') +
    (f.equipo_id ? ` · Equipo ${f.equipo_id}` : '') + (f.area ? ` · Área ${f.area}` : '')

  hoja(wb, 'Por equipo', periodo, [
    { titulo: 'Equipo', ancho: 12 }, { titulo: 'Tipo', ancho: 20 }, { titulo: 'Marca', ancho: 12 }, { titulo: 'Modelo', ancho: 22 },
    { titulo: 'Área', ancho: 20 }, { titulo: 'Usuario', ancho: 24 }, { titulo: 'Artículos', ancho: 30 },
    { titulo: 'Salidas', ancho: 9 }, { titulo: 'Unidades', ancho: 10 }, { titulo: 'Gasto', ancho: 14, pesos: true },
    { titulo: 'Último', ancho: 12 },
  ], r.por_equipo.map(e => [e.equipo_id ?? 'Sin equipo', e.tipo_equipo, e.marca, e.modelo, e.area, e.usuario_asignado,
    e.tipos, e.salidas, e.unidades, e.gasto, e.ultimo]))

  hoja(wb, 'Por área', periodo, [
    { titulo: 'Área', ancho: 26 }, { titulo: 'Equipos', ancho: 10 }, { titulo: 'Unidades', ancho: 10 }, { titulo: 'Gasto', ancho: 14, pesos: true },
  ], r.por_area.map(a => [a.area, a.equipos, a.unidades, a.gasto]))

  hoja(wb, 'Por artículo', periodo, [
    { titulo: 'Código', ancho: 11 }, { titulo: 'Artículo', ancho: 40 }, { titulo: 'Tipo', ancho: 22 }, { titulo: 'Categoría', ancho: 12 },
    { titulo: 'Equipos', ancho: 10 }, { titulo: 'Unidades', ancho: 10 }, { titulo: 'Gasto', ancho: 14, pesos: true },
  ], r.por_articulo.map(a => [a.articulo_codigo, a.descripcion, a.tipo_articulo, a.categoria, a.equipos, a.unidades, a.gasto]))

  hoja(wb, 'Mensual', periodo, [
    { titulo: 'Mes', ancho: 10 }, { titulo: 'Insumos', ancho: 10 }, { titulo: 'Repuestos', ancho: 10 },
    { titulo: 'Periféricos', ancho: 11 }, { titulo: 'Gasto', ancho: 14, pesos: true },
  ], r.por_mes.map(m => [m.mes, m.insumos ?? 0, m.repuestos ?? 0, m.perifericos ?? 0, m.gasto]))

  if (r.rendimiento.length > 0) {
    hoja(wb, 'Rendimiento tóner', periodo, [
      { titulo: 'Impresora', ancho: 12 }, { titulo: 'Marca / Modelo', ancho: 26 }, { titulo: 'Insumo', ancho: 34 },
      { titulo: 'Cambios medidos', ancho: 10 }, { titulo: 'Páginas por cambio', ancho: 12 }, { titulo: 'Días por cambio', ancho: 10 },
      { titulo: 'Costo por página', ancho: 12, pesos: false }, { titulo: 'Último contador', ancho: 12 },
    ], r.rendimiento.map(x => [x.equipo_id, [x.marca, x.modelo].filter(Boolean).join(' '), `${x.articulo_codigo} ${x.descripcion}`,
      x.cambios, x.paginas_promedio, x.dias_promedio, x.costo_pagina != null ? Math.round(x.costo_pagina * 10) / 10 : null, x.ultimo_contador]))
  }

  if (r.detalle) {
    hoja(wb, 'Detalle', `${periodo} · un renglón por movimiento (para tablas dinámicas)`, [
      { titulo: 'Fecha', ancho: 11 }, { titulo: 'Tipo', ancho: 9 }, { titulo: 'Motivo', ancho: 26 }, { titulo: 'Código', ancho: 11 },
      { titulo: 'Artículo', ancho: 34 }, { titulo: 'Tipo artículo', ancho: 18 }, { titulo: 'Categoría', ancho: 11 },
      { titulo: 'Equipo', ancho: 11 }, { titulo: 'Área', ancho: 18 }, { titulo: 'Persona', ancho: 22 },
      { titulo: 'Unidades', ancho: 9 }, { titulo: 'Costo unitario', ancho: 13, pesos: true }, { titulo: 'Gasto', ancho: 13, pesos: true },
      { titulo: 'Contador', ancho: 10 }, { titulo: 'Registró', ancho: 18 },
    ], r.detalle.map(d => [d.fecha, d.tipo, d.motivo, d.articulo_codigo, d.descripcion, d.tipo_articulo, d.categoria,
      d.equipo_id, d.area, d.destino_nombre, d.unidades, d.costo_unitario, d.gasto, d.contador_paginas, d.registrado_por]))
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Consumo_TIC_${f.desde}_a_${f.hasta}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
