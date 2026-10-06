// Motor de generación del plano de Saldos Iniciales NIIF (Siesa ERP):
//   1 registro de encabezado (F_TIPO_REG=0000)
//   N registros de Documento contable          (350/00, versión 02)
//   N registros de Movimiento contable libros  (351/00, versión 03, registro de 695 caracteres)
//   1 registro de cola (F_TIPO_REG=9999)
//
// El documento 350 v02 reutiliza la línea ya verificada byte a byte en el plano de
// saldos iniciales. El movimiento 351 v03 se tomó de la hoja "Movimiento contable V3"
// de "Imp-UnoEE-Docto contable Libros.xls"; no hay un plano real de referencia para
// validarlo byte a byte, así que debe confirmarse con la primera carga en Siesa.

import { num, alpha, valorMonetario, CERO_VALOR } from './formato'
import { lineaDocumentoContable } from './generarTxt'
import type { SaldosNiif, MovimientoContableNiifRow } from './tiposNiif'

function lineaControl(numeroReg: number, tipoReg: string): string {
  return num(numeroReg, 7) + tipoReg + '0001001'
}

function lineaMovimientoLibros(reg: number, cia: string, r: MovimientoContableNiifRow): string {
  return (
    num(reg, 7) + // F_NUMERO_REG
    num(351, 4) + // F_TIPO_REG - fijo
    num(0, 2) + // F_SUBTIPO_REG - movimiento contable
    num(3, 2) + // F_VERSION_REG - fijo (v03, con libros)
    num(cia, 3) + // F_CIA
    alpha(r.centroOperacion, 3) + // F350_ID_CO
    alpha(r.tipoDocumento, 3) + // F350_ID_TIPO_DOCTO
    num(r.numeroDocumento, 8) + // F350_CONSEC_DOCTO
    alpha(r.auxiliar, 20) + // F351_ID_AUXILIAR
    alpha(r.tercero, 15) + // F351_ID_TERCERO
    alpha(r.centroOperacionMov, 3) + // F351_ID_CO_MOV
    alpha(r.unidadNegocio, 20) + // F351_ID_UN
    alpha(r.centroCostos, 15) + // F351_ID_CCOSTO
    alpha(r.conceptoFlujoEfectivo, 10) + // F351_ID_FE
    valorMonetario(r.valorDebito) + // F351_VALOR_DB
    valorMonetario(r.valorCredito) + // F351_VALOR_CR
    CERO_VALOR + // F351_VALOR_DB_ALT - no se maneja moneda alterna
    CERO_VALOR + // F351_VALOR_CR_ALT
    valorMonetario(r.valorBaseGravable) + // F351_BASE_GRAVABLE
    valorMonetario(r.valorDebito2) + // F351_VALOR_DB2
    valorMonetario(r.valorCredito2) + // F351_VALOR_CR2
    CERO_VALOR + // F351_VALOR_DB_ALT2
    CERO_VALOR + // F351_VALOR_CR_ALT2
    valorMonetario(r.valorBaseGravable2) + // F351_BASE_GRAVABLE2
    CERO_VALOR + // F351_VALOR_DB3 - no se maneja libro 3
    CERO_VALOR + // F351_VALOR_CR3
    CERO_VALOR + // F351_VALOR_DB_ALT3
    CERO_VALOR + // F351_VALOR_CR_ALT3
    CERO_VALOR + // F351_BASE_GRAVABLE3
    alpha('', 2) + // F351_DOCTO_BANCO - no aplica en saldos iniciales NIIF
    num(0, 8) + // F351_NRO_DOCTO_BANCO
    alpha(r.observaciones, 255) // F351_NOTAS
  )
}

export function generarPlanoNiif(datos: SaldosNiif): string {
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
    lineas.push(lineaMovimientoLibros(reg, cia, r))
    reg++
  }

  lineas.push(lineaControl(reg, '9999'))

  return lineas.join('\r\n') + '\r\n'
}
