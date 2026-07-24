// Motor de generación del plano de Adiciones de Activos Fijos (Siesa, registro 263 v04).
// Layout tomado de "Imp-UnoEE-AF-Adiciones.xlsx" hoja "Adiciones V.04" (445 caracteres).
// No hay un plano real de referencia para validar byte a byte (a diferencia de saldos
// iniciales, activos fijos y adopción NIIF); el layout se armó field por field contra el
// spec y se contrastó contra las columnas del Excel de ejemplo "Adiciones Activos Fijos".
//
// f263_ind_genera_ajuste es obligatorio ("Si") pero no viene en el Excel de origen; queda
// fijo en 0 porque la regla dice que debe ser 0 cuando el indicador "ajustable" del activo
// principal es 0 (que es el caso de todos los activos de Klarens, según el plano de
// Activos Fijos).

import { num, alpha, fecha, valorSinSigno, porcentaje } from './formato'
import type { AdicionesAF, AdicionAFRow } from './tiposAdiciones'

function lineaControl(numeroReg: number, tipoReg: string): string {
  return num(numeroReg, 7) + tipoReg + '0001001'
}

function lineaAdicion(reg: number, cia: string, r: AdicionAFRow): string {
  return (
    num(reg, 7) +
    num(263, 4) + // F_TIPO_REG - fijo
    num(0, 2) + // F_SUBTIPO_REG - fijo
    num(4, 2) + // F_VERSION_REG - fijo (v04)
    num(cia, 3) +
    num(r.reemplaza ? 1 : 0, 1) +
    num(r.codigoActivo, 9) +
    num(r.numeroAdicion, 3) +
    alpha(r.descripcion, 40) +
    alpha('', 50) + // f263_codigo_barras - no usado
    num(r.numeroPiezas, 8) +
    fecha(r.fechaAdquisicion) +
    valorSinSigno(r.costoAdquisicion) +
    num(0, 1) + // f263_ind_genera_ajuste - fijo (0 porque ajustable siempre es 0)
    num(r.metodoDepreciacion, 1) +
    num(r.vidaUtilPeriodos, 4) +
    valorSinSigno(r.unidadesDepreciar) +
    valorSinSigno(r.valorSalvamento) +
    porcentaje(r.porcentajeSalvamento) +
    alpha('', 15) + // f263_id_proveedor_os
    alpha('', 3) + // f263_id_sucursal_os
    alpha('', 15) + // f263_docto_referencia
    alpha('', 100) + // f263_notas
    valorSinSigno(r.costoAdquisicionNiif) +
    num(r.metodoDepreciacionNiif, 1) +
    num(r.vidaUtilPeriodosNiif, 4) +
    valorSinSigno(r.unidadesDepreciarNiif) +
    valorSinSigno(r.valorSalvamentoNiif) +
    porcentaje(r.porcentajeSalvamentoNiif) +
    num(r.vidaUtilRemanente, 4) +
    valorSinSigno(r.unidadesRemanente)
  )
}

export function generarPlanoAdicionesAF(datos: AdicionesAF): string {
  const cia = datos.compania?.trim() || '001'
  const lineas: string[] = []
  let reg = 1

  lineas.push(lineaControl(reg, '0000'))
  reg++

  for (const r of datos.adiciones) {
    lineas.push(lineaAdicion(reg, cia, r))
    reg++
  }

  lineas.push(lineaControl(reg, '9999'))

  return lineas.join('\r\n') + '\r\n'
}
