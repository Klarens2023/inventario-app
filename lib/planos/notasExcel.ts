import type ExcelJS from 'exceljs'

// Agrega como nota/comentario de Excel (visible al pasar el mouse sobre el encabezado)
// la explicación de la regla de Siesa para cada columna, en el mismo orden de ENCABEZADOS.
export function agregarNotasEncabezado(ws: ExcelJS.Worksheet, notas: (string | undefined)[]) {
  notas.forEach((nota, i) => {
    if (!nota) return
    ws.getRow(1).getCell(i + 1).note = nota
  })
}
