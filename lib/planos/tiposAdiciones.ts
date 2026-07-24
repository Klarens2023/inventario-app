// Modelo de fila para el plano de Adiciones de Activos Fijos (Siesa, registro 263 v04).
// Los nombres de campo siguen la hoja "Adiciones" del Excel "Adiciones Activos Fijos".

export interface AdicionAFRow {
  reemplaza: boolean // F_ACTUALIZA_REG
  codigoActivo: string // f262_id
  numeroAdicion: string // f263_id (1-999)
  descripcion: string // f263_descripcion
  numeroPiezas: number // f263_numero_piezas
  fechaAdquisicion: string // f263_fecha_adq (AAAAMMDD)
  costoAdquisicion: number // f263_costo_adq_orig
  metodoDepreciacion: string // f263_ind_metodo_depre (0-3)
  vidaUtilPeriodos: number // f263_periodos_depreciar
  unidadesDepreciar: number // f263_unidades_depreciar
  valorSalvamento: number // f263_valor_salvamento
  porcentajeSalvamento: number // f263_porcentaje_salvamento
  costoAdquisicionNiif: number // f2631_costo_adq_orig
  metodoDepreciacionNiif: string // f2631_ind_metodo_depre (0-3)
  vidaUtilPeriodosNiif: number // f2631_periodos_depreciar
  unidadesDepreciarNiif: number // f2631_unidades_depreciar
  valorSalvamentoNiif: number // f2631_valor_salvamento
  porcentajeSalvamentoNiif: number // f2631_porcentaje_salvamento
  vidaUtilRemanente: number // f2631_periodos_remanentes
  unidadesRemanente: number // f2631_unidades_remanentes
}

export interface AdicionesAF {
  compania: string
  adiciones: AdicionAFRow[]
}

export function adicionesAFVacio(): AdicionesAF {
  return { compania: '001', adiciones: [] }
}

export function filaAdicionAFVacia(): AdicionAFRow {
  return {
    reemplaza: false,
    codigoActivo: '',
    numeroAdicion: '',
    descripcion: '',
    numeroPiezas: 1,
    fechaAdquisicion: '',
    costoAdquisicion: 0,
    metodoDepreciacion: '1',
    vidaUtilPeriodos: 0,
    unidadesDepreciar: 0,
    valorSalvamento: 0,
    porcentajeSalvamento: 0,
    costoAdquisicionNiif: 0,
    metodoDepreciacionNiif: '1',
    vidaUtilPeriodosNiif: 0,
    unidadesDepreciarNiif: 0,
    valorSalvamentoNiif: 0,
    porcentajeSalvamentoNiif: 0,
    vidaUtilRemanente: 0,
    unidadesRemanente: 0,
  }
}
