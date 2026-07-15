// Modelos de fila para cada tipo de registro del plano contable de Siesa.
// Los nombres de campo siguen las columnas de los Excel SALDOS_INICIALES_CONTABLES_KLARENS.

export interface DocumentoContableRow {
  centroOperacion: string
  tipoDocumento: string
  numeroDocumento: string
  fecha: string // AAAAMMDD
  tercero: string
  observaciones: string
}

export interface MovimientoContableRow {
  centroOperacion: string
  tipoDocumento: string
  numeroDocumento: string
  auxiliar: string
  tercero: string
  centroOperacionMov: string
  unidadNegocio: string
  centroCostos: string
  conceptoFlujoEfectivo: string
  valorDebito: number
  valorCredito: number
  valorBaseGravable: number
  tipoDocumentoBanco: string // 'CH' | 'CG' | 'ND' | 'NC'
  numeroDocumentoBanco: string
  observaciones: string
}

export interface MovimientoCxPRow {
  centroOperacion: string
  tipoDocumento: string
  numeroDocumento: string
  auxiliar: string
  tercero: string
  centroOperacionMov: string
  unidadNegocio: string
  valorDebito: number
  valorCredito: number
  observaciones: string
  sucursalProveedor: string
  prefijoCruce: string
  numeroDocumentoCruce: string
  numeroCuotaCruce: string
  conceptoFlujoEfectivo: string
  fechaVencimiento: string
  fechaProntoPago: string
  fechaDocumentoCruce: string
  observacionesSaldoAbierto: string
}

export interface MovimientoCxCRow {
  centroOperacion: string
  tipoDocumento: string
  numeroDocumento: string
  auxiliar: string
  tercero: string
  centroOperacionMov: string
  unidadNegocio: string
  valorDebito: number
  valorCredito: number
  observaciones: string
  sucursalCliente: string
  tipoDocumentoCruce: string
  numeroDocumentoCruce: string
  numeroCuotaCruce: string
  fechaVencimiento: string
  fechaProntoPago: string
  terceroVendedor: string
  observacionesSaldoAbierto: string
}

export interface DiferidoRow {
  centroOperacion: string
  tipoDocumento: string
  numeroDocumento: string
  auxiliar: string
  tercero: string
  centroOperacionMov: string
  unidadNegocio: string
  centroCostos: string
  valorDebito: number
  valorCredito: number
  observaciones: string
  documentoDiferido: string
  numeroCuotaDiferido: string
  fechaInicial: string
  fechaFinal: string
  auxiliarContrapartida: string
  terceroContrapartida: string
  centroOperacionContrapartida: string
  unidadNegocioContrapartida: string
  centroCostosContrapartida: string
  observacionesContrapartida: string
}

export interface SaldosIniciales {
  compania: string // F_CIA — código de compañía, ej. '001'
  documentoContable: DocumentoContableRow[]
  movimientoContable: MovimientoContableRow[]
  movimientoCxP: MovimientoCxPRow[]
  movimientoCxC: MovimientoCxCRow[]
  diferidos: DiferidoRow[]
}

export function saldosVacios(): SaldosIniciales {
  return {
    compania: '001',
    documentoContable: [],
    movimientoContable: [],
    movimientoCxP: [],
    movimientoCxC: [],
    diferidos: [],
  }
}
