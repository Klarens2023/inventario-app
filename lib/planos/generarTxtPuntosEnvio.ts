// Motor de generación del plano de Puntos de Envío (Siesa, registro 215 v04).
// Layout tomado de la hoja "Punto de envio v4" de "Imp-UnoEE-Puntos de envio.xls"
// (registro de 522 caracteres), con el mismo sobre encabezado(0000)/cola(9999)
// que los demás planos y F_NUMERO_REG consecutivo por todo el archivo.
//
// No hay un plano real de referencia para validar byte a byte. Dos supuestos a
// confirmar con la primera carga en Siesa:
//   - F215_VLR_PEDIDO_MINIMO (numérico de 20) se escribe como los demás valores
//     de 20 caracteres de Siesa: 15 enteros + punto + 4 decimales, sin signo.
//   - Los códigos cortos (sucursal, punto de envío, país, depto, ciudad) son
//     alfanuméricos, pero si vienen solo con dígitos se rellenan con ceros a la
//     izquierda (ej. 1 → "001"), porque Excel suele quitar los ceros iniciales.

import { num, alpha, valorSinSigno } from './formato'
import type { PuntosEnvio, PuntoEnvioRow } from './tiposPuntosEnvio'

function lineaControl(numeroReg: number, tipoReg: string): string {
  return num(numeroReg, 7) + tipoReg + '0001001'
}

// Código alfanumérico corto: si es solo dígitos se completa con ceros a la izquierda.
export function codigo(valor: string, tam: number): string {
  const s = String(valor ?? '').trim()
  return /^\d+$/.test(s) && s.length < tam ? s.padStart(tam, '0') : s
}

function campo(fn: () => string, nombre: string, numeroFila: number): string {
  try {
    return fn()
  } catch (e) {
    throw new Error(`Fila ${numeroFila}, ${nombre}: ${e instanceof Error ? e.message : String(e)}`)
  }
}

function lineaPuntoEnvio(reg: number, cia: string, r: PuntoEnvioRow, numeroFila: number): string {
  if (!r.tercero.trim()) throw new Error(`Fila ${numeroFila}: el código del cliente es obligatorio`)
  if (!r.sucursal.trim()) throw new Error(`Fila ${numeroFila}: la sucursal es obligatoria`)
  if (!r.codigo.trim()) throw new Error(`Fila ${numeroFila}: el código del punto de envío es obligatorio`)
  if (codigo(r.codigo, 3) === '000') throw new Error(`Fila ${numeroFila}: el código del punto de envío debe ser diferente de 000`)
  if (!r.descripcion.trim()) throw new Error(`Fila ${numeroFila}: la descripción es obligatoria`)
  if (r.departamento.trim() && !r.pais.trim()) throw new Error(`Fila ${numeroFila}: el departamento solo se puede usar si hay país`)
  if (r.ciudad.trim() && !r.departamento.trim()) throw new Error(`Fila ${numeroFila}: la ciudad solo se puede usar si hay departamento`)

  const f = (fn: () => string, nombre: string) => campo(fn, nombre, numeroFila)

  return (
    num(reg, 7) + // F_NUMERO_REG
    num(215, 4) + // F_TIPO_REG - fijo
    num(0, 2) + // F_SUBTIPO_REG - fijo
    num(4, 2) + // F_VERSION_REG - fijo (v04)
    num(cia, 3) + // F_CIA
    num(r.reemplaza ? 1 : 0, 1) + // F_ACTUALIZA_REG
    f(() => alpha(r.tercero.trim(), 15), 'Cliente') + // F215_ID_TERCERO
    f(() => alpha(codigo(r.sucursal, 3), 3), 'Sucursal') + // F215_ID_SUCURSAL
    f(() => alpha(codigo(r.codigo, 3), 3), 'Código punto de envío') + // F215_ID
    f(() => alpha(r.descripcion, 40), 'Descripción') + // F215_DESCRIPCION
    f(() => alpha(r.vendedor.trim(), 4), 'Vendedor') + // F215_ID_VENDEDOR
    f(() => alpha(r.contacto, 50), 'Contacto') + // F015_CONTACTO
    f(() => alpha(r.direccion1, 40), 'Dirección 1') + // F015_DIRECCION1
    f(() => alpha(r.direccion2, 40), 'Dirección 2') + // F015_DIRECCION2
    f(() => alpha(r.direccion3, 40), 'Dirección 3') + // F015_DIRECCION3
    f(() => alpha(codigo(r.pais, 3), 3), 'País') + // F015_ID_PAIS
    f(() => alpha(codigo(r.departamento, 2), 2), 'Departamento') + // F015_ID_DEPTO
    f(() => alpha(codigo(r.ciudad, 3), 3), 'Ciudad') + // F015_ID_CIUDAD
    f(() => alpha(r.barrio, 40), 'Barrio') + // F015_ID_BARRIO
    f(() => alpha(r.telefono, 20), 'Teléfono') + // F015_TELEFONO
    f(() => alpha(r.fax, 20), 'Fax') + // F015_FAX
    f(() => alpha(r.codigoPostal, 10), 'Código postal') + // F015_COD_POSTAL
    f(() => alpha(r.email.trim(), 50), 'Email') + // F015_EMAIL
    f(() => alpha(r.parametroEdi.trim(), 4), 'Parámetro EDI') + // F015_ID_PARAMETRO_EDI
    f(() => alpha(r.codigoEan.trim(), 35), 'Código EAN') + // F015_CODIGO_EAN
    num(r.activo ? 1 : 0, 1) + // F215_IND_ESTADO
    f(() => alpha(r.criterioMayor.trim(), 10), 'Criterio mayor') + // F215_ID_CRITERIO_MAYOR_CLI
    f(() => valorSinSigno(r.pedidoMinimo), 'Pedido mínimo') + // F215_VLR_PEDIDO_MINIMO
    f(() => alpha(r.celular, 50), 'Celular') // F015_CELULAR
  )
}

export function generarPlanoPuntosEnvio(datos: PuntosEnvio): string {
  const cia = datos.compania?.trim() || '001'
  const lineas: string[] = []
  let reg = 1

  lineas.push(lineaControl(reg, '0000'))
  reg++

  datos.puntos.forEach((r, i) => {
    lineas.push(lineaPuntoEnvio(reg, cia, r, i + 2)) // +2: fila del Excel (la 1 es el encabezado)
    reg++
  })

  lineas.push(lineaControl(reg, '9999'))

  return lineas.join('\r\n') + '\r\n'
}
