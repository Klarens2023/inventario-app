// Modelo de fila para el plano de Adopción NIIF por primera vez (Siesa, registro 2631 v03).
// Los nombres de campo siguen la hoja "Adopción por primera vez" del Excel de referencia
// (versión con las columnas "Valor salvamento" y "Porcentaje salvamento"). Cuando el activo
// ya declaró salvamento NIIF al crearse en el plano de Activos Fijos, aquí se repite el
// mismo valor; si no aplica, queda en 0.

export interface AdopcionNiifRow {
  codigoActivo: string // F2631_ID_AF
  codigoActivoAdicion: string // F2631_ID_AF_ADICION
  costoAdquisicionAdicion: number // f2631_COSTO_ADQ_ORIG (0 = respeta el valor actual)
  vidaUtilPeriodosNiif: number // F2631_PERIODOS_DEPRECIAR_NIIF
  valorSalvamentoNiif: number // F2631_VALOR_SALVAMENTO_NIIF
  porcentajeSalvamentoNiif: number // F2631_PORC_SALVAMENTO_NIIF
  metodoCosto: string // F2631_ID_METODO_COSTO (0=Manual,1=Histórico,2=Avalúo,3=Revaluado)
  costo: number // F2631_COSTO
  depreciacionCosto: number // F2631_DEPRE_COSTO
  costoRevalorizacion: number // F2631_COSTO_REVALORIZACION
  depreciacionRevalorizacion: number // F2631_DEPRE_REVALORIZACION
  costoDeterioro: number // F2631_COSTO_DETERIORO
}

export interface AdopcionNiif {
  compania: string
  registros: AdopcionNiifRow[]
}

export function adopcionNiifVacio(): AdopcionNiif {
  return { compania: '001', registros: [] }
}

export function filaAdopcionNiifVacia(): AdopcionNiifRow {
  return {
    codigoActivo: '',
    codigoActivoAdicion: '0',
    costoAdquisicionAdicion: 0,
    vidaUtilPeriodosNiif: 0,
    valorSalvamentoNiif: 0,
    porcentajeSalvamentoNiif: 0,
    metodoCosto: '0',
    costo: 0,
    depreciacionCosto: 0,
    costoRevalorizacion: 0,
    depreciacionRevalorizacion: 0,
    costoDeterioro: 0,
  }
}
