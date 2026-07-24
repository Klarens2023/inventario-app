// Importación/exportación del Excel de saldos iniciales contables (formato
// SALDOS_INICIALES_CONTABLES_KLARENS), usando ExcelJS igual que lib/exportExcel.ts.
// Las hojas y columnas replican exactamente los archivos de origen de Siesa.

import ExcelJS from 'exceljs'
import { saldosVacios } from './tipos'
import type {
  SaldosIniciales,
  DocumentoContableRow,
  MovimientoContableRow,
  MovimientoCxPRow,
  MovimientoCxCRow,
  DiferidoRow,
} from './tipos'
import { agregarNotasEncabezado } from './notasExcel'

const HOJAS = {
  documentoContable: 'Documentocontable',
  movimientoContable: 'Movimientocontable',
  movimientoCxP: 'MovimientoCxP',
  movimientoCxC: 'MovimientoCxC',
  diferidos: 'Diferidos',
} as const

const ENCABEZADOS: Record<keyof typeof HOJAS, string[]> = {
  documentoContable: [
    'Centro de operación del documento', 'Tipo de documento', 'Numero de documento',
    'Fecha del documento', 'Tercero del documento', 'Observaciones del documento',
  ],
  movimientoContable: [
    'Centro de operación del documento', 'Tipo de documento', 'Numero de documento',
    'Auxiliar de cuenta contable', 'Tercero', 'Centro de operación del movimiento',
    'Unidad de negocio', 'Auxiliar de centro de costos', 'Auxiliar de concepto de flujo de efectivo',
    'Valor debito', 'Valor crédito', 'Valor base gravable', 'Tipo de documento de banco',
    'Numero de documento de banco', 'Observaciones del movimiento',
  ],
  movimientoCxP: [
    'Centro de operación del documento', 'Tipo de documento', 'Numero de documento',
    'Auxiliar de cuenta contable', 'Tercero', 'Centro de operación del movimiento',
    'Unidad de negocio', 'Valor debito', 'Valor crédito', 'Observaciones del movimiento',
    'Sucursal proveedor', 'Prefijo de documento de cruce', 'Numero de documento de cruce',
    'Numero de cuota de documento de cruce', 'Auxiliar de concepto de flujo de efectivo',
    'Fecha de vencimiento del documento', 'Fecha de pronto pago del documento',
    'Fecha del documento de cruce', 'Observaciones del movimiento de saldo abierto',
  ],
  movimientoCxC: [
    'Centro de operación del documento', 'Tipo de documento', 'Numero de documento',
    'Auxiliar de cuenta contable', 'Tercero', 'Centro de operación del movimiento',
    'Unidad de negocio', 'Valor debito', 'Valor crédito', 'Observaciones del movimiento',
    'Sucursal cliente', 'Tipo de documento de cruce', 'Numero de documento de cruce',
    'Numero de cuota de documento de cruce', 'Fecha de vencimiento del documento',
    'Fecha de pronto pago del documento', 'Tercero vendedor', 'Observaciones del movimiento de saldo abierto',
  ],
  diferidos: [
    'Centro de operación del documento', 'Tipo de documento', 'Numero de documento',
    'Auxiliar de cuenta contable', 'Tercero', 'Centro de operación del movimiento',
    'Unidad de negocio', 'Auxiliar de centro de costos', 'Valor debito', 'Valor crédito',
    'Observaciones del movimiento', 'Documento de diferidos', 'Numero de cuota de documento de diferidos',
    'Fecha inicial de amortización del diferido', 'Fecha final de amortización del diferido',
    'Auxiliar de cuenta contable de la contrapartida', 'Tercero para el asiento contrapartida',
    'Centro de operación para el asiento contrapartida', 'Unidad de negocio para el asiento contrapartida',
    'Centro de costo para el asiento contrapartida', 'Observaciones del movimiento contrapartida',
  ],
}

// Observaciones de la regla de Siesa para cada columna (mismo orden que ENCABEZADOS),
// mostradas como nota de Excel al pasar el mouse sobre el encabezado.
const NOTAS: Record<keyof typeof HOJAS, string[]> = {
  documentoContable: [
    'Valida en maestro, código de centro de operación del documento',
    'Valida en maestro, código de tipo de documento',
    'Numero de documento',
    'El formato debe ser AAAAMMDD',
    'Valida en maestro, código de tercero',
    'Observaciones',
  ],
  movimientoContable: [
    'Valida en maestro, código de centro de operación del documento',
    'Valida en maestro, código de tipo de documento',
    'Numero de documento',
    'Valida en maestro, código de cuenta contable',
    'Valida en maestro, código de tercero, solo se requiere si la auxiliar contable maneja tercero',
    'Valida en maestro, código de centro de operación del movimiento, es obligatorio si la auxiliar no tiene uno por defecto.',
    'Valida en maestro, código de unidad de negocio, es obligatorio si la auxiliar no tiene uno por defecto.',
    'Valida en maestro, código de centro de costos, solo se requiere si la auxiliar contable maneja centro de costos',
    'Solo si la cuenta es disponible, valida en maestro, código de concepto de flujo de efectivo.',
    'Valor debito del asiento, si el asiento es crédito este debe ir en cero.',
    'Valor crédito del asiento, si el asiento es debito este debe ir en cero.',
    'Solo si la cuenta maneja tasa, es el valor que da origen al impuesto o retención.',
    "Solo si la cuenta es de bancos: 'CH' cheques, 'CG' consignaciones, 'ND' notas débito, 'NC' notas crédito.",
    "Solo si la cuenta es de bancos, corresponde al numero 'CH', 'CG', 'ND' o 'NC'.",
    'Observaciones',
  ],
  movimientoCxP: [
    'Valida en maestro, código de centro de operación del documento',
    'Valida en maestro, código de tipo de documento',
    'Numero de documento',
    'Valida en maestro, código de cuenta contable',
    'Valida en maestro, código de tercero, solo se requiere si la auxiliar contable maneja tercero',
    'Valida en maestro, código de centro de operación del movimiento, es obligatorio si la auxiliar no tiene uno por defecto.',
    'Valida en maestro, código de unidad de negocio, es obligatorio si la auxiliar no tiene uno por defecto.',
    'Valor debito del asiento, si el asiento es crédito este debe ir en cero.',
    'Valor crédito del asiento, si el asiento es debito este debe ir en cero.',
    'Observaciones',
    'Valida en maestro, código de sucursal del proveedor',
    'Es el prefijo del documento del proveedor, no se valida contra nada y puede dejarse vacío.',
    'Numero de documento de cruce, es un numero entre 1 y 99999999.',
    'Numero de cuota de documento de cruce, es un numero entre 0 y 99.',
    'Valida en maestro, código de flujo de efectivo que se va a usar para el pago programado de esta obligación.',
    'Fecha de vencimiento del documento, el formato debe ser AAAAMMDD.',
    'Fecha de pronto pago del documento, el formato debe ser AAAAMMDD.',
    'Fecha de documento de cruce del proveedor, el formato debe ser AAAAMMDD.',
    'Observaciones del movimiento de saldo abierto.',
  ],
  movimientoCxC: [
    'Valida en maestro, código de centro de operación del documento',
    'Valida en maestro, código de tipo de documento',
    'Numero de documento',
    'Valida en maestro, código de cuenta contable',
    'Valida en maestro, código de tercero, solo se requiere si la auxiliar contable maneja tercero',
    'Valida en maestro, código de centro de operación del movimiento, es obligatorio si la auxiliar no tiene uno por defecto.',
    'Valida en maestro, código de unidad de negocio, es obligatorio si la auxiliar no tiene uno por defecto.',
    'Valor debito del asiento, si el asiento es crédito este debe ir en cero.',
    'Valor crédito del asiento, si el asiento es debito este debe ir en cero.',
    'Observaciones',
    'Valida en maestro, código de sucursal del cliente.',
    'Valida en maestro, código de tipo de documento.',
    'Numero de documento de cruce, es un numero entre 1 y 99999999.',
    'Numero de cuota de documento de cruce, es un numero entre 0 y 99.',
    'Fecha de vencimiento del documento, el formato debe ser AAAAMMDD.',
    'Fecha de pronto pago del documento, el formato debe ser AAAAMMDD.',
    'Valida en maestro, código de tercero del vendedor.',
    'Observaciones del movimiento de saldo abierto.',
  ],
  diferidos: [
    'Valida en maestro, código de centro de operación del documento',
    'Valida en maestro, código de tipo de documento',
    'Numero de documento',
    'Valida en maestro, código de cuenta contable',
    'Valida en maestro, código de tercero, solo se requiere si la auxiliar contable maneja tercero',
    'Valida en maestro, código de centro de operación del movimiento, es obligatorio si la auxiliar no tiene uno por defecto.',
    'Valida en maestro, código de unidad de negocio, es obligatorio si la auxiliar no tiene uno por defecto.',
    'Valida en maestro, código de centro de costos, solo se requiere si la auxiliar contable maneja centro de costos',
    'Valor debito del asiento, si el asiento es crédito este debe ir en cero.',
    'Valor crédito del asiento, si el asiento es debito este debe ir en cero.',
    'Observaciones',
    'Código identificador del diferido.',
    'Numero de cuota del diferido, es un numero entre 0 y 99.',
    'Fecha inicial de amortización del diferido, el formato debe ser AAAAMMDD.',
    'Fecha final de amortización del diferido, el formato debe ser AAAAMMDD.',
    'Valida en maestro, código de auxiliar contable contrapartida para el proceso de amortización de diferidos.',
    'Valida en maestro, código de tercero para el asiento contrapartida, se requiere si la cuenta contrapartida maneja tercero.',
    'Valida en maestro, código de centro de operación.',
    'Valida en maestro, código de unidad de negocio.',
    'Valida en maestro, código de centro de costo para el asiento contrapartida, se requiere si la cuenta contrapartida maneja centro de costos.',
    'Observaciones del movimiento contrapartida',
  ],
}

function texto(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object' && 'text' in (v as object)) return String((v as { text: unknown }).text ?? '')
  return String(v).trim()
}

function numero(v: ExcelJS.CellValue): number {
  const n = Number(texto(v).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function fechaTexto(v: ExcelJS.CellValue): string {
  if (v instanceof Date) {
    const y = v.getUTCFullYear()
    const m = String(v.getUTCMonth() + 1).padStart(2, '0')
    const d = String(v.getUTCDate()).padStart(2, '0')
    return `${y}${m}${d}`
  }
  return texto(v).replace(/[^0-9]/g, '')
}

function filasDeHoja(ws: ExcelJS.Worksheet | undefined): ExcelJS.CellValue[][] {
  if (!ws) return []
  const filas: ExcelJS.CellValue[][] = []
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // encabezado
    const valores: ExcelJS.CellValue[] = []
    row.eachCell({ includeEmpty: true }, (cell) => valores.push(cell.value))
    if (valores.some((v) => texto(v) !== '')) filas.push(valores)
  })
  return filas
}

export async function leerExcelSaldos(datos: ArrayBuffer): Promise<SaldosIniciales> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(datos)
  const resultado = saldosVacios()

  for (const f of filasDeHoja(wb.getWorksheet(HOJAS.documentoContable))) {
    const r: DocumentoContableRow = {
      centroOperacion: texto(f[0]), tipoDocumento: texto(f[1]), numeroDocumento: texto(f[2]),
      fecha: fechaTexto(f[3]), tercero: texto(f[4]), observaciones: texto(f[5]),
    }
    resultado.documentoContable.push(r)
  }

  for (const f of filasDeHoja(wb.getWorksheet(HOJAS.movimientoContable))) {
    const r: MovimientoContableRow = {
      centroOperacion: texto(f[0]), tipoDocumento: texto(f[1]), numeroDocumento: texto(f[2]),
      auxiliar: texto(f[3]), tercero: texto(f[4]), centroOperacionMov: texto(f[5]),
      unidadNegocio: texto(f[6]), centroCostos: texto(f[7]), conceptoFlujoEfectivo: texto(f[8]),
      valorDebito: numero(f[9]), valorCredito: numero(f[10]), valorBaseGravable: numero(f[11]),
      tipoDocumentoBanco: texto(f[12]), numeroDocumentoBanco: texto(f[13]), observaciones: texto(f[14]),
    }
    resultado.movimientoContable.push(r)
  }

  for (const f of filasDeHoja(wb.getWorksheet(HOJAS.movimientoCxP))) {
    const r: MovimientoCxPRow = {
      centroOperacion: texto(f[0]), tipoDocumento: texto(f[1]), numeroDocumento: texto(f[2]),
      auxiliar: texto(f[3]), tercero: texto(f[4]), centroOperacionMov: texto(f[5]),
      unidadNegocio: texto(f[6]), valorDebito: numero(f[7]), valorCredito: numero(f[8]),
      observaciones: texto(f[9]), sucursalProveedor: texto(f[10]), prefijoCruce: texto(f[11]),
      numeroDocumentoCruce: texto(f[12]), numeroCuotaCruce: texto(f[13]),
      conceptoFlujoEfectivo: texto(f[14]), fechaVencimiento: fechaTexto(f[15]),
      fechaProntoPago: fechaTexto(f[16]), fechaDocumentoCruce: fechaTexto(f[17]),
      observacionesSaldoAbierto: texto(f[18]),
    }
    resultado.movimientoCxP.push(r)
  }

  for (const f of filasDeHoja(wb.getWorksheet(HOJAS.movimientoCxC))) {
    const r: MovimientoCxCRow = {
      centroOperacion: texto(f[0]), tipoDocumento: texto(f[1]), numeroDocumento: texto(f[2]),
      auxiliar: texto(f[3]), tercero: texto(f[4]), centroOperacionMov: texto(f[5]),
      unidadNegocio: texto(f[6]), valorDebito: numero(f[7]), valorCredito: numero(f[8]),
      observaciones: texto(f[9]), sucursalCliente: texto(f[10]), tipoDocumentoCruce: texto(f[11]),
      numeroDocumentoCruce: texto(f[12]), numeroCuotaCruce: texto(f[13]),
      fechaVencimiento: fechaTexto(f[14]), fechaProntoPago: fechaTexto(f[15]),
      terceroVendedor: texto(f[16]), observacionesSaldoAbierto: texto(f[17]),
    }
    resultado.movimientoCxC.push(r)
  }

  for (const f of filasDeHoja(wb.getWorksheet(HOJAS.diferidos))) {
    const r: DiferidoRow = {
      centroOperacion: texto(f[0]), tipoDocumento: texto(f[1]), numeroDocumento: texto(f[2]),
      auxiliar: texto(f[3]), tercero: texto(f[4]), centroOperacionMov: texto(f[5]),
      unidadNegocio: texto(f[6]), centroCostos: texto(f[7]), valorDebito: numero(f[8]),
      valorCredito: numero(f[9]), observaciones: texto(f[10]), documentoDiferido: texto(f[11]),
      numeroCuotaDiferido: texto(f[12]), fechaInicial: fechaTexto(f[13]), fechaFinal: fechaTexto(f[14]),
      auxiliarContrapartida: texto(f[15]), terceroContrapartida: texto(f[16]),
      centroOperacionContrapartida: texto(f[17]), unidadNegocioContrapartida: texto(f[18]),
      centroCostosContrapartida: texto(f[19]), observacionesContrapartida: texto(f[20]),
    }
    resultado.diferidos.push(r)
  }

  return resultado
}

function agregarHoja(wb: ExcelJS.Workbook, nombre: string, encabezados: string[], notas: string[], filas: unknown[][]) {
  const ws = wb.addWorksheet(nombre)
  ws.addRow(encabezados)
  ws.getRow(1).font = { bold: true }
  agregarNotasEncabezado(ws, notas)
  for (const fila of filas) ws.addRow(fila)
  ws.columns.forEach((col) => {
    let max = 10
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      max = Math.max(max, String(cell.value ?? '').length)
    })
    col.width = Math.min(max + 2, 45)
  })
}

export async function generarExcelSaldos(datos: SaldosIniciales): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook()

  agregarHoja(wb, HOJAS.documentoContable, ENCABEZADOS.documentoContable, NOTAS.documentoContable, datos.documentoContable.map((r) => [
    r.centroOperacion, r.tipoDocumento, r.numeroDocumento, r.fecha, r.tercero, r.observaciones,
  ]))

  agregarHoja(wb, HOJAS.movimientoContable, ENCABEZADOS.movimientoContable, NOTAS.movimientoContable, datos.movimientoContable.map((r) => [
    r.centroOperacion, r.tipoDocumento, r.numeroDocumento, r.auxiliar, r.tercero, r.centroOperacionMov,
    r.unidadNegocio, r.centroCostos, r.conceptoFlujoEfectivo, r.valorDebito, r.valorCredito,
    r.valorBaseGravable, r.tipoDocumentoBanco, r.numeroDocumentoBanco, r.observaciones,
  ]))

  agregarHoja(wb, HOJAS.movimientoCxP, ENCABEZADOS.movimientoCxP, NOTAS.movimientoCxP, datos.movimientoCxP.map((r) => [
    r.centroOperacion, r.tipoDocumento, r.numeroDocumento, r.auxiliar, r.tercero, r.centroOperacionMov,
    r.unidadNegocio, r.valorDebito, r.valorCredito, r.observaciones, r.sucursalProveedor, r.prefijoCruce,
    r.numeroDocumentoCruce, r.numeroCuotaCruce, r.conceptoFlujoEfectivo, r.fechaVencimiento,
    r.fechaProntoPago, r.fechaDocumentoCruce, r.observacionesSaldoAbierto,
  ]))

  agregarHoja(wb, HOJAS.movimientoCxC, ENCABEZADOS.movimientoCxC, NOTAS.movimientoCxC, datos.movimientoCxC.map((r) => [
    r.centroOperacion, r.tipoDocumento, r.numeroDocumento, r.auxiliar, r.tercero, r.centroOperacionMov,
    r.unidadNegocio, r.valorDebito, r.valorCredito, r.observaciones, r.sucursalCliente,
    r.tipoDocumentoCruce, r.numeroDocumentoCruce, r.numeroCuotaCruce, r.fechaVencimiento,
    r.fechaProntoPago, r.terceroVendedor, r.observacionesSaldoAbierto,
  ]))

  agregarHoja(wb, HOJAS.diferidos, ENCABEZADOS.diferidos, NOTAS.diferidos, datos.diferidos.map((r) => [
    r.centroOperacion, r.tipoDocumento, r.numeroDocumento, r.auxiliar, r.tercero, r.centroOperacionMov,
    r.unidadNegocio, r.centroCostos, r.valorDebito, r.valorCredito, r.observaciones, r.documentoDiferido,
    r.numeroCuotaDiferido, r.fechaInicial, r.fechaFinal, r.auxiliarContrapartida, r.terceroContrapartida,
    r.centroOperacionContrapartida, r.unidadNegocioContrapartida, r.centroCostosContrapartida,
    r.observacionesContrapartida,
  ]))

  return wb.xlsx.writeBuffer()
}
