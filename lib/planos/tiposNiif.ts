// Modelo de fila para el plano de Saldos Iniciales NIIF (Siesa, documento contable
// 350 v02 + movimiento contable por libros 351/00 v03). Columnas tomadas de la
// plantilla "NIIF SALDOS INICIALES" y de "Imp-UnoEE-Docto contable Libros.xls".
// Libro 1 = PCGA (local), libro 2 = NIIF. El libro 3 no se maneja: va en cero en el plano.

import type { DocumentoContableRow } from './tipos'

export interface MovimientoContableNiifRow {
  centroOperacion: string
  tipoDocumento: string
  numeroDocumento: string
  auxiliar: string
  tercero: string
  centroOperacionMov: string
  unidadNegocio: string
  centroCostos: string
  conceptoFlujoEfectivo: string
  valorDebito: number // libro 1 (PCGA)
  valorCredito: number
  valorBaseGravable: number
  valorDebito2: number // libro 2 (NIIF)
  valorCredito2: number
  valorBaseGravable2: number
  observaciones: string
}

export interface SaldosNiif {
  compania: string // F_CIA
  documentoContable: DocumentoContableRow[]
  movimientoContable: MovimientoContableNiifRow[]
}

export function saldosNiifVacios(): SaldosNiif {
  return { compania: '001', documentoContable: [], movimientoContable: [] }
}

export function filaDocumentoNiifVacia(): DocumentoContableRow {
  return { centroOperacion: '001', tipoDocumento: '', numeroDocumento: '', fecha: '', tercero: '', observaciones: '' }
}

export function filaMovimientoNiifVacia(): MovimientoContableNiifRow {
  return {
    centroOperacion: '001', tipoDocumento: '', numeroDocumento: '', auxiliar: '', tercero: '',
    centroOperacionMov: '', unidadNegocio: '', centroCostos: '', conceptoFlujoEfectivo: '',
    valorDebito: 0, valorCredito: 0, valorBaseGravable: 0,
    valorDebito2: 0, valorCredito2: 0, valorBaseGravable2: 0,
    observaciones: '',
  }
}
