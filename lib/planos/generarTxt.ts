// Motor de generación del plano contable de ancho fijo para Siesa ERP.
//
// Estructura verificada byte a byte contra los archivos planos reales de Klarens:
//   1 registro de encabezado (F_TIPO_REG=0000)
//   N registros de Documento contable   (350/00, versión 02)
//   N registros de Movimiento contable  (351/00, versión 02)
//   N registros de Movimiento CxC       (351/01, versión 02)
//   N registros de Movimiento CxP       (351/02, versión 03)
//   N registros de Diferidos            (351/03, versión 02)
//   1 registro de cola (F_TIPO_REG=9999), con F_NUMERO_REG = total de líneas del archivo
//
// F_NUMERO_REG es un consecutivo único que corre por todo el archivo, sin reiniciarse
// por tipo de registro. Los campos marcados "Valor fijo" en la especificación (F_TIPO_REG,
// F_SUBTIPO_REG) y demás constantes de la ERP (clase de documento, estado, moneda alterna,
// etc.) se escriben aquí como literales; no se capturan en el Excel de saldos.

import { num, alpha, fecha, valorMonetario, CERO_VALOR } from './formato'
import type {
  SaldosIniciales,
  DocumentoContableRow,
  MovimientoContableRow,
  MovimientoCxPRow,
  MovimientoCxCRow,
  DiferidoRow,
} from './tipos'

function lineaControl(numeroReg: number, tipoReg: string): string {
  return num(numeroReg, 7) + tipoReg + '0001001'
}

function lineaDocumentoContable(reg: number, cia: string, r: DocumentoContableRow): string {
  return (
    num(reg, 7) +
    num(350, 4) + // F_TIPO_REG - fijo
    num(0, 2) + // F_SUBTIPO_REG - fijo
    num(2, 2) + // F_VERSION_REG - fijo (v2)
    num(cia, 3) + // F_CIA
    num(1, 1) + // F_CONSEC_AUTO_REG - fijo (automático)
    alpha(r.centroOperacion, 3) +
    alpha(r.tipoDocumento, 3) +
    num(r.numeroDocumento, 8) +
    fecha(r.fecha) +
    alpha(r.tercero, 15) +
    num(30, 5) + // F350_ID_CLASE_DOCTO - fijo (siempre 30)
    num(0, 1) + // F350_IND_ESTADO - fijo (elaboración)
    num(0, 1) + // F350_IND_IMPRESION - fijo (no impreso)
    alpha(r.observaciones, 255) +
    alpha('', 15) // f350_id_mandato - no usado
  )
}

function lineaMovimientoContable(reg: number, cia: string, r: MovimientoContableRow): string {
  return (
    num(reg, 7) +
    num(351, 4) +
    num(0, 2) + // F_SUBTIPO_REG - movimiento contable
    num(2, 2) + // F_VERSION_REG (v2)
    num(cia, 3) +
    alpha(r.centroOperacion, 3) +
    alpha(r.tipoDocumento, 3) +
    num(r.numeroDocumento, 8) +
    alpha(r.auxiliar, 20) +
    alpha(r.tercero, 15) +
    alpha(r.centroOperacionMov, 3) +
    alpha(r.unidadNegocio, 20) +
    alpha(r.centroCostos, 15) +
    alpha(r.conceptoFlujoEfectivo, 10) +
    valorMonetario(r.valorDebito) +
    valorMonetario(r.valorCredito) +
    CERO_VALOR + // F351_VALOR_DB_ALT - no se maneja moneda alterna
    CERO_VALOR + // F351_VALOR_CR_ALT
    valorMonetario(r.valorBaseGravable) +
    alpha(r.tipoDocumentoBanco, 2) +
    num(r.numeroDocumentoBanco, 8) +
    alpha(r.observaciones, 255)
  )
}

function lineaMovimientoCxC(reg: number, cia: string, r: MovimientoCxCRow): string {
  return (
    num(reg, 7) +
    num(351, 4) +
    num(1, 2) + // F_SUBTIPO_REG - CxC
    num(2, 2) + // F_VERSION_REG (v2)
    num(cia, 3) +
    alpha(r.centroOperacion, 3) +
    alpha(r.tipoDocumento, 3) +
    num(r.numeroDocumento, 8) +
    alpha(r.auxiliar, 20) +
    alpha(r.tercero, 15) +
    alpha(r.centroOperacionMov, 3) +
    alpha(r.unidadNegocio, 20) +
    alpha('', 15) + // F351_ID_CCOSTO - no capturado para CxC
    valorMonetario(r.valorDebito) +
    valorMonetario(r.valorCredito) +
    CERO_VALOR + // F351_VALOR_DB_ALT
    CERO_VALOR + // F351_VALOR_CR_ALT
    alpha(r.observaciones, 255) +
    alpha(r.sucursalCliente, 3) +
    alpha(r.tipoDocumentoCruce, 3) +
    num(r.numeroDocumentoCruce, 8) +
    num(r.numeroCuotaCruce, 3) +
    fecha(r.fechaVencimiento) +
    fecha(r.fechaProntoPago) +
    CERO_VALOR + // F353_VLR_DSCTO_PP
    CERO_VALOR + // F354_VALOR_APLICADO_PP
    CERO_VALOR + // F354_VALOR_APLICADO_PP_ALT
    CERO_VALOR + // F354_VALOR_APROVECHA
    CERO_VALOR + // F354_VALOR_APROVECHA_ALT
    CERO_VALOR + // F354_VALOR_RETENCION
    CERO_VALOR + // F354_VALOR_RETENCION_ALT
    alpha(r.terceroVendedor, 15) +
    alpha(r.observacionesSaldoAbierto, 255)
  )
}

function lineaMovimientoCxP(reg: number, cia: string, r: MovimientoCxPRow): string {
  return (
    num(reg, 7) +
    num(351, 4) +
    num(2, 2) + // F_SUBTIPO_REG - CxP
    num(3, 2) + // F_VERSION_REG (v3)
    num(cia, 3) +
    alpha(r.centroOperacion, 3) +
    alpha(r.tipoDocumento, 3) +
    num(r.numeroDocumento, 8) +
    alpha(r.auxiliar, 20) +
    alpha(r.tercero, 15) +
    alpha(r.centroOperacionMov, 3) +
    alpha(r.unidadNegocio, 20) +
    alpha('', 15) + // F351_ID_CCOSTO - no capturado para CxP
    valorMonetario(r.valorDebito) +
    valorMonetario(r.valorCredito) +
    CERO_VALOR + // F351_VALOR_DB_ALT
    CERO_VALOR + // F351_VALOR_CR_ALT
    alpha(r.observaciones, 255) +
    alpha(r.sucursalProveedor, 3) +
    alpha(r.prefijoCruce, 20) +
    num(r.numeroDocumentoCruce, 8) +
    num(r.numeroCuotaCruce, 3) +
    alpha(r.conceptoFlujoEfectivo, 10) +
    fecha(r.fechaVencimiento) +
    fecha(r.fechaProntoPago) +
    fecha(r.fechaDocumentoCruce) +
    CERO_VALOR + // F353_VLR_DSCTO_PP
    CERO_VALOR + // F354_VALOR_APLICADO_PP
    CERO_VALOR + // F354_VALOR_APLICADO_PP_ALT
    CERO_VALOR + // F354_VALOR_RETENCION
    CERO_VALOR + // F354_VALOR_RETENCION_ALT
    alpha(r.observacionesSaldoAbierto, 255)
  )
}

function lineaDiferido(reg: number, cia: string, r: DiferidoRow): string {
  return (
    num(reg, 7) +
    num(351, 4) +
    num(3, 2) + // F_SUBTIPO_REG - Diferidos
    num(2, 2) + // F_VERSION_REG (v2)
    num(cia, 3) +
    alpha(r.centroOperacion, 3) +
    alpha(r.tipoDocumento, 3) +
    num(r.numeroDocumento, 8) +
    alpha(r.auxiliar, 20) +
    alpha(r.tercero, 15) +
    alpha(r.centroOperacionMov, 3) +
    alpha(r.unidadNegocio, 20) +
    alpha(r.centroCostos, 15) +
    valorMonetario(r.valorDebito) +
    valorMonetario(r.valorCredito) +
    alpha(r.observaciones, 255) +
    alpha(r.documentoDiferido, 12) +
    num(r.numeroCuotaDiferido, 3) +
    fecha(r.fechaInicial) +
    fecha(r.fechaFinal) +
    alpha(r.auxiliarContrapartida, 20) +
    alpha(r.terceroContrapartida, 15) +
    alpha(r.centroOperacionContrapartida, 3) +
    alpha(r.unidadNegocioContrapartida, 20) +
    alpha(r.centroCostosContrapartida, 15) +
    fecha('', 8) + // F356_FECHA_ANT_ULT_AMORT - no aplica en cargue inicial
    alpha(r.observacionesContrapartida, 255)
  )
}

export function generarPlanoTxt(datos: SaldosIniciales): string {
  const cia = datos.compania?.trim() || '001'
  const lineas: string[] = []
  let reg = 1

  lineas.push(lineaControl(reg, '0000'))
  reg++

  for (const r of datos.documentoContable) {
    lineas.push(lineaDocumentoContable(reg, cia, r))
    reg++
  }
  for (const r of datos.movimientoContable) {
    lineas.push(lineaMovimientoContable(reg, cia, r))
    reg++
  }
  for (const r of datos.movimientoCxC) {
    lineas.push(lineaMovimientoCxC(reg, cia, r))
    reg++
  }
  for (const r of datos.movimientoCxP) {
    lineas.push(lineaMovimientoCxP(reg, cia, r))
    reg++
  }
  for (const r of datos.diferidos) {
    lineas.push(lineaDiferido(reg, cia, r))
    reg++
  }

  // El registro de cola lleva como F_NUMERO_REG el total de líneas del archivo
  // (incluyéndose a sí mismo), tal como en los planos reales de referencia.
  lineas.push(lineaControl(reg, '9999'))

  return lineas.join('\r\n') + '\r\n'
}
