// Motor de generación del plano de Adopción NIIF por primera vez (Siesa, registro 2631 v03).
// Layout verificado byte a byte contra "adop 239503H17M2bnieves@klarens.com.co.txt".

import { num, alpha, fecha, valorSinSigno, CERO_VALOR_SIN_SIGNO, porcentaje, valorSentinelCero } from './formato'
import type { AdopcionNiif, AdopcionNiifRow } from './tiposAdopcion'

function lineaControl(numeroReg: number, tipoReg: string): string {
  return num(numeroReg, 7) + tipoReg + '0001001'
}

function lineaAdopcion(reg: number, cia: string, r: AdopcionNiifRow): string {
  return (
    num(reg, 7) +
    num(2631, 4) + // F_TIPO_REG - fijo
    num(0, 2) + // F_SUBTIPO_REG - fijo
    num(3, 2) + // F_VERSION_REG - fijo (v03)
    num(cia, 3) +
    num(r.codigoActivo, 9) +
    num(r.codigoActivoAdicion, 3) +
    valorSentinelCero(r.costoAdquisicionAdicion) +
    num(1, 1) + // F2631_IND_METODO_DEPRE_NIIF - fijo (linea recta)
    num(r.vidaUtilPeriodosNiif, 4) +
    CERO_VALOR_SIN_SIGNO + // F2631_UNIDADES_DEPRECIAR_NIIF - solo aplica a método 3 (no soportado)
    valorSinSigno(r.valorSalvamentoNiif) +
    porcentaje(r.porcentajeSalvamentoNiif) +
    num(r.metodoCosto, 1) +
    valorSinSigno(r.costo) +
    valorSinSigno(r.depreciacionCosto) +
    valorSinSigno(r.costoRevalorizacion) +
    valorSinSigno(r.depreciacionRevalorizacion) +
    valorSinSigno(r.costoDeterioro) +
    CERO_VALOR_SIN_SIGNO + // F2631_UNID_DEPRE_APV - no soportado
    alpha('', 50) + // F2631_FIRMA_AVALUO - solo aplica a método de costo = avalúo
    fecha('') + // F2631_FECHA_AVALUO
    CERO_VALOR_SIN_SIGNO // F2631_VALOR_AVALUO
  )
}

export function generarPlanoAdopcionNiif(datos: AdopcionNiif): string {
  const cia = datos.compania?.trim() || '001'
  const lineas: string[] = []
  let reg = 1

  lineas.push(lineaControl(reg, '0000'))
  reg++

  for (const r of datos.registros) {
    lineas.push(lineaAdopcion(reg, cia, r))
    reg++
  }

  lineas.push(lineaControl(reg, '9999'))

  return lineas.join('\r\n') + '\r\n'
}
