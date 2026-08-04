// Motor de generación del plano de Impuestos y Retenciones (Siesa, registros
// 46/47/49/50). Layout tomado de "Imp-UnoEE-Impuestos y retenciones.xls"
// (registro de 46 caracteres).
//
// No hay un plano real de referencia para validar byte a byte (a diferencia de
// saldos iniciales, activos fijos y adopción NIIF). F_ID_CLASE, F_ID_VALOR_TERCERO
// y F_ID_LLAVE están declarados "Alfanumérico" en la hoja de reglas, pero todos
// sus valores válidos (según los catálogos de clases y llaves reales de Siesa)
// son puramente numéricos, así que aquí se formatean con relleno de ceros a la
// izquierda (num) en vez de espacios a la derecha (alpha) — es la convención
// más común para campos de código de ancho fijo en interfaces Siesa, pero debe
// confirmarse contra un plano real la primera vez que se use en producción.

import { num, alpha } from './formato'
import { buscarClasePorSigla, buscarLlave, tipoRegistro } from './catalogosImpuestos'
import type { ImpuestosRetenciones, ImpuestoRetencionRow } from './tiposImpuestos'

function lineaControl(numeroReg: number, tipoReg: string): string {
  return num(numeroReg, 7) + tipoReg + '0001001'
}

function lineaRegistro(reg: number, cia: string, r: ImpuestoRetencionRow, numeroFila: number): string {
  const clase = buscarClasePorSigla(r.concepto, r.clase)
  if (!clase) {
    throw new Error(`Fila ${numeroFila}: clase "${r.clase}" no encontrada en el catálogo de ${r.concepto === 'impuesto' ? 'impuestos' : 'retenciones'}`)
  }

  let codigoLlave = ''
  if (r.llave.trim()) {
    const llave = buscarLlave(r.concepto, clase.sigla, r.llave)
    if (!llave) {
      throw new Error(`Fila ${numeroFila}: llave "${r.llave}" no es válida para la clase "${clase.sigla}"`)
    }
    codigoLlave = llave.codigo
  }

  return (
    num(reg, 7) + // F_NUMERO_REG
    num(tipoRegistro(r.tipo, r.concepto), 4) + // F_TIPO_REG
    num(0, 2) + // F_SUBTIPO_REG - fijo
    num(1, 2) + // F_VERSION_REG - fijo
    num(cia, 3) + // F_CIA
    num(r.reemplaza ? 1 : 0, 1) + // F_ACTUALIZA_REG
    alpha(r.tercero, 15) + // F_ID_TERCERO
    alpha(r.sucursal, 3) + // F_ID_SUCURSAL
    num(clase.codigo, 3) + // F_ID_CLASE
    num(r.valor, 2) + // F_ID_VALOR_TERCERO
    (codigoLlave ? num(codigoLlave, 4) : alpha('', 4)) // F_ID_LLAVE
  )
}

export function generarPlanoImpuestos(datos: ImpuestosRetenciones): string {
  const cia = datos.compania?.trim() || '001'
  const lineas: string[] = []
  let reg = 1

  lineas.push(lineaControl(reg, '0000'))
  reg++

  datos.registros.forEach((r, i) => {
    lineas.push(lineaRegistro(reg, cia, r, i + 2))
    reg++
  })

  lineas.push(lineaControl(reg, '9999'))

  return lineas.join('\r\n') + '\r\n'
}
