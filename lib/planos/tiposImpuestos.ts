// Modelo de fila para el plano de Impuestos y Retenciones (Siesa, registros
// 46=Impuesto cliente, 47=Retención cliente, 49=Impuesto proveedor,
// 50=Retención proveedor). Ver "Imp-UnoEE-Impuestos y retenciones.xls".

import type { TipoTercero, Concepto } from './catalogosImpuestos'

export interface ImpuestoRetencionRow {
  reemplaza: boolean // F_ACTUALIZA_REG: 0=No, 1=Si (si ya existe la clase para el tercero)
  tercero: string // F_ID_TERCERO
  sucursal: string // F_ID_SUCURSAL
  tipo: TipoTercero // define si F_TIPO_REG es 46/47 (cliente) o 49/50 (proveedor)
  concepto: Concepto // define si F_TIPO_REG es de impuesto o de retención
  clase: string // sigla de la clase (IVA, ICO, RENTA, RTBIENES, ...) → se traduce a F_ID_CLASE
  valor: string // F_ID_VALOR_TERCERO: 0=No aplica/No retiene, 1=Aplica/Retiene/Sujeto, 2=Régimen especial/Autoretenedor (según catálogo Anexo 2)
  llave: string // F_ID_LLAVE: código de la llave (opcional, según catálogo de llaves de la clase)
}

export interface ImpuestosRetenciones {
  compania: string
  registros: ImpuestoRetencionRow[]
}

export function impuestosRetencionesVacio(): ImpuestosRetenciones {
  return { compania: '001', registros: [] }
}

export function filaImpuestoRetencionVacia(): ImpuestoRetencionRow {
  return {
    reemplaza: true,
    tercero: '',
    sucursal: '',
    tipo: 'cliente',
    concepto: 'impuesto',
    clase: '',
    valor: '1',
    llave: '',
  }
}
