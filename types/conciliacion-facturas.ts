export type EstadoFactura = 'CAUSADA' | 'NO_CAUSADA' | 'REQUIERE_REVISION'

export type NivelCoincidencia =
  | 'exacta'
  | 'equivalente'
  | 'probable'
  | 'documento_interno'
  | 'no_encontrada'

// Fila cruda de Invoicing, ya con las columnas mapeadas a nombres fijos.
export type FacturaInvoicing = {
  fila: number
  nit: string
  razonSocial: string
  facturaOriginal: string
  valor: number
  estadoDocto: string
  fecha: string | null
}

// Fila cruda del ERP (Siesa causación), ya con las columnas mapeadas.
export type DocumentoErp = {
  fila: number
  nit: string
  razonSocial: string
  tipoDocto: string
  doctoInterno: string        // columna "Docto." — el consecutivo interno de Siesa
  doctoProveedorOriginal: string // columna "Docto. Proveedor" — puede venir vacía
  neto: number
  notas: string
  fecha: string | null
  fechaProveedor: string | null
}

// Un "documento" de causación puede tener varias líneas contables (débito,
// crédito, costos por centro) que comparten el mismo "Docto." — por eso el
// monto se guarda como lista de líneas, no como un solo neto.
export type CandidatoErp = {
  doctoInterno: string
  doctoProveedorOriginal: string
  montos: number[]
  tipoDocto: string
  fecha: string | null
}

export type ResultadoComparacion = {
  id: number
  nit: string
  razonSocial: string
  facturaInvoicingOriginal: string
  facturaInvoicingNormalizada: string
  valorInvoicing: number
  facturaErpOriginal: string | null
  facturaErpNormalizada: string | null
  doctoInternoErp: string | null
  montoErp: number | null
  montoCoincide: boolean
  estado: EstadoFactura
  nivel: NivelCoincidencia
  observacion: string
  candidatosAlternos: CandidatoErp[]   // otros documentos ERP del mismo NIT que también podrían aplicar
  duplicadoEnErp: boolean             // el documento ERP emparejado ya fue usado por otra factura de Invoicing
}

export type ResumenProcesamiento = {
  totalInvoicing: number
  totalRechazadas: number
  causadas: number
  noCausadas: number
  requierenRevision: number
  coincidenciasExactas: number
  coincidenciasNormalizacion: number
  coincidenciasProbables: number
  posiblesDocumentoInterno: number
  duplicados: number
}

// ── Mapeo de columnas (el usuario puede reasignarlas si los archivos cambian) ──
export type MapeoInvoicing = {
  nit: string
  razonSocial: string
  factura: string
  valor: string
  estadoDocto: string
  fecha: string
}

export type MapeoErp = {
  nit: string
  razonSocial: string
  tipoDocto: string
  doctoInterno: string
  doctoProveedor: string
  debitos: string
  creditos: string
  notas: string
  fecha: string
  fechaProveedor: string
}

export type HojaExcel = {
  nombre: string
  encabezados: string[]
  filas: Record<string, unknown>[]
}
