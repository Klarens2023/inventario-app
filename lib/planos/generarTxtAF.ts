// Motor de generación del plano de creación de Activos Fijos (Siesa, registro 262 v05).
// Layout verificado byte a byte contra "af 235304H16M43bnieves@klarens.com.co.txt".
// Un solo tipo de registro por línea; mismo sobre encabezado(0000)/cola(9999) que los
// demás planos, con F_NUMERO_REG consecutivo por todo el archivo.

import { num, alpha, fecha, valorSinSigno, CERO_VALOR_SIN_SIGNO, porcentaje } from './formato'
import type { ActivosFijos, ActivoFijoRow } from './tiposAF'

function lineaControl(numeroReg: number, tipoReg: string): string {
  return num(numeroReg, 7) + tipoReg + '0001001'
}

function lineaActivoFijo(reg: number, cia: string, r: ActivoFijoRow): string {
  return (
    num(reg, 7) +
    num(262, 4) + // F_TIPO_REG - fijo
    num(0, 2) + // F_SUBTIPO_REG - fijo
    num(5, 2) + // F_VERSION_REG - fijo (v05)
    num(cia, 3) +
    num(r.reemplaza ? 1 : 0, 1) +
    num(r.codigoActivo, 9) +
    alpha(r.referencia, 20) +
    alpha(r.descripcion, 40) +
    alpha(r.descripcionCorta, 20) +
    alpha(r.tipoInventario, 10) +
    alpha(r.centroOperacion, 3) +
    alpha(r.unidadNegocio, 20) +
    alpha(r.centroCostos, 15) +
    alpha(r.tercero, 15) +
    num(r.depreciable ? 1 : 0, 1) +
    num(r.ajustable ? 1 : 0, 1) +
    num(0, 1) + // f262_ind_prenda_garantia - fijo (no usado)
    alpha('', 100) + // f262_nota_garantia
    alpha('', 50) + // f263_codigo_barras
    num(1, 8) + // f263_numero_piezas - fijo (siempre 1 unidad)
    fecha(r.fechaAdquisicion) +
    valorSinSigno(r.costoAdquisicion) +
    num(0, 1) + // f263_ind_genera_ajuste - fijo (0 porque ajustable siempre es 0)
    num(r.metodoDepreciacion, 1) +
    num(r.vidaUtilPeriodos, 4) +
    CERO_VALOR_SIN_SIGNO + // f263_unidades_depreciar - solo aplica a método 3 (no soportado)
    valorSinSigno(r.valorSalvamento) +
    porcentaje(0) + // f263_porcentaje_salvamento - solo aplica a método 2 (no soportado)
    alpha('', 15) + // f263_id_proveedor_os
    alpha('', 3) + // f263_id_sucursal_os
    alpha('', 15) + // f263_docto_referencia
    alpha('', 100) + // f263_notas
    valorSinSigno(r.costoAdquisicionNiif) +
    num(r.metodoDepreciacionNiif, 1) +
    num(r.vidaUtilPeriodosNiif, 4) +
    CERO_VALOR_SIN_SIGNO + // f2631_unidades_depreciar - solo aplica a método 3 (no soportado)
    valorSinSigno(r.valorSalvamentoNiif) +
    porcentaje(r.porcentajeSalvamentoNiif) +
    num(r.vidaUtilRemanente, 4) +
    valorSinSigno(r.unidadesRemanente) +
    num(r.calculaDepreRevalorizacion ? 1 : 0, 1)
  )
}

export function generarPlanoActivosFijos(datos: ActivosFijos): string {
  const cia = datos.compania?.trim() || '001'
  const lineas: string[] = []
  let reg = 1

  lineas.push(lineaControl(reg, '0000'))
  reg++

  for (const r of datos.activos) {
    lineas.push(lineaActivoFijo(reg, cia, r))
    reg++
  }

  lineas.push(lineaControl(reg, '9999'))

  return lineas.join('\r\n') + '\r\n'
}
