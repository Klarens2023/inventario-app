import * as XLSX from 'xlsx'

export function exportarExcel(
  nombre: string,
  columnas: string[],
  filas: (string | number | null)[][]
) {
  const fechaGen = new Date().toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })

  // Fila de meta-info
  const metaFila = [`Generado: ${fechaGen}`, ...Array(columnas.length - 1).fill('')]

  const wsData = [metaFila, columnas, ...filas]
  const ws     = XLSX.utils.aoa_to_sheet(wsData)

  // Estilo de encabezado (fila 2, índice 1)
  const rango  = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  const numCols = columnas.length

  // Anchos automáticos
  ws['!cols'] = columnas.map((_, i) => ({
    wch: Math.max(
      columnas[i].length,
      ...filas.map(f => String(f[i] ?? '').length)
    ) + 2
  }))

  // Auto-filtro en fila de encabezados
  ws['!autofilter'] = { ref: `A2:${XLSX.utils.encode_col(numCols - 1)}2` }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Datos')
  XLSX.writeFile(wb, `${nombre}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}