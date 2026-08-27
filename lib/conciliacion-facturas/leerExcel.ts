import * as XLSX from 'xlsx'
import type {
  HojaExcel, FacturaInvoicing, DocumentoErp, MapeoInvoicing, MapeoErp,
} from '@/types/conciliacion-facturas'

// Se usa SheetJS (xlsx) para LEER, porque a diferencia de ExcelJS sí soporta
// el formato binario .xls antiguo (BIFF) — el archivo real de Siesa
// Invoicing viene en ese formato, no en .xlsx. La escritura del Excel de
// salida se sigue haciendo con ExcelJS (con estilos), igual que el resto de
// la app.
export async function leerLibroExcel(file: File): Promise<HojaExcel[]> {
  const buffer = await file.arrayBuffer()
  const libro = XLSX.read(buffer, { type: 'array', cellDates: true })
  return libro.SheetNames.map(nombre => {
    const hoja = libro.Sheets[nombre]
    const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: null, raw: true })
    const encabezados = filas.length > 0
      ? Object.keys(filas[0]).filter(h => !h.startsWith('__EMPTY') || filas.some(f => f[h] != null))
      : []
    return { nombre, encabezados, filas }
  })
}

// Elige por defecto la hoja con más filas (evita hojas de referencia/vacías
// como "RUTA" que trae el archivo de causación de Siesa).
export function hojaConMasDatos(hojas: HojaExcel[]): HojaExcel {
  return hojas.reduce((mejor, h) => h.filas.length > mejor.filas.length ? h : mejor, hojas[0])
}

function limpiarTexto(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function limpiarNumero(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, ''))
  return isNaN(n) ? 0 : n
}

function limpiarFecha(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v)
}

// ── Sugerencia automática de columnas (el usuario puede corregirla) ────────
function buscarColumna(encabezados: string[], candidatos: string[]): string {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  for (const candidato of candidatos) {
    const encontrado = encabezados.find(h => norm(h) === norm(candidato))
    if (encontrado) return encontrado
  }
  for (const candidato of candidatos) {
    const encontrado = encabezados.find(h => norm(h).includes(norm(candidato)))
    if (encontrado) return encontrado
  }
  return ''
}

export function sugerirMapeoInvoicing(encabezados: string[]): MapeoInvoicing {
  return {
    nit: buscarColumna(encabezados, ['Nit Emisor', 'Nit proveedor', 'Nit']),
    razonSocial: buscarColumna(encabezados, ['Emisor', 'Razon Social', 'Proveedor']),
    factura: buscarColumna(encabezados, ['Factura', 'Numero Factura', 'No. Factura']),
    valor: buscarColumna(encabezados, ['Valor', 'Monto', 'Total']),
    estadoDocto: buscarColumna(encabezados, ['Estado Docto.', 'Estado Documento', 'Estado']),
    fecha: buscarColumna(encabezados, ['Fecha']),
  }
}

export function sugerirMapeoErp(encabezados: string[]): MapeoErp {
  return {
    nit: buscarColumna(encabezados, ['Nit tercero', 'Nit']),
    razonSocial: buscarColumna(encabezados, ['Razon social tercero docto.', 'Razon Social', 'Tercero']),
    tipoDocto: buscarColumna(encabezados, ['Tipo docto.', 'Tipo Documento', 'Tipo']),
    doctoInterno: buscarColumna(encabezados, ['Docto.', 'Documento']),
    doctoProveedor: buscarColumna(encabezados, ['Docto. Proveedor', 'Documento Proveedor', 'Factura Proveedor']),
    debitos: buscarColumna(encabezados, ['Debitos', 'Débitos']),
    creditos: buscarColumna(encabezados, ['Creditos', 'Créditos']),
    notas: buscarColumna(encabezados, ['Notas', 'Observaciones']),
    fecha: buscarColumna(encabezados, ['Fecha']),
    fechaProveedor: buscarColumna(encabezados, ['Fecha del proveedor', 'Fecha proveedor']),
  }
}

export function mapearInvoicing(filas: Record<string, unknown>[], mapeo: MapeoInvoicing): FacturaInvoicing[] {
  return filas.map((fila, i) => ({
    fila: i + 2, // +2: fila 1 es encabezado, y las hojas de Excel empiezan en 1
    nit: limpiarTexto(fila[mapeo.nit]),
    razonSocial: limpiarTexto(fila[mapeo.razonSocial]),
    facturaOriginal: limpiarTexto(fila[mapeo.factura]),
    valor: limpiarNumero(fila[mapeo.valor]),
    estadoDocto: limpiarTexto(fila[mapeo.estadoDocto]),
    fecha: limpiarFecha(fila[mapeo.fecha]),
  })).filter(f => f.nit !== '' || f.facturaOriginal !== '')
}

export function mapearErp(filas: Record<string, unknown>[], mapeo: MapeoErp): DocumentoErp[] {
  return filas.map((fila, i) => {
    const debitos = limpiarNumero(fila[mapeo.debitos])
    const creditos = limpiarNumero(fila[mapeo.creditos])
    return {
      fila: i + 2,
      nit: limpiarTexto(fila[mapeo.nit]),
      razonSocial: limpiarTexto(fila[mapeo.razonSocial]),
      tipoDocto: limpiarTexto(fila[mapeo.tipoDocto]),
      doctoInterno: limpiarTexto(fila[mapeo.doctoInterno]),
      doctoProveedorOriginal: limpiarTexto(fila[mapeo.doctoProveedor]),
      neto: debitos - creditos,
      notas: limpiarTexto(fila[mapeo.notas]),
      fecha: limpiarFecha(fila[mapeo.fecha]),
      fechaProveedor: limpiarFecha(fila[mapeo.fechaProveedor]),
    }
  }).filter(d => d.nit !== '')
}
