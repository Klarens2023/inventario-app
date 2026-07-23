// Modelo de fila para el plano de creación de Activos Fijos (Siesa, registro 262 v05).
// Los nombres de campo siguen la hoja "AF" del Excel "Creación de activos fijos Klarens".

export interface ActivoFijoRow {
  reemplaza: boolean // F_ACTUALIZA_REG
  codigoActivo: string // f262_id
  referencia: string // f262_referencia
  descripcion: string // f262_descripcion
  descripcionCorta: string // f262_descripcion_corta
  tipoInventario: string // f262_id_tipo_inv_serv
  centroOperacion: string // f262_id_co
  unidadNegocio: string // f262_id_un
  centroCostos: string // f262_ccosto
  tercero: string // f262_tercero
  depreciable: boolean // f262_ind_depreciable
  ajustable: boolean // f262_ind_ajustable
  fechaAdquisicion: string // f263_fecha_adq (AAAAMMDD)
  costoAdquisicion: number // f263_costo_adq_orig
  metodoDepreciacion: string // f263_ind_metodo_depre (0..3)
  vidaUtilPeriodos: number // f263_periodos_depreciar
  valorSalvamento: number // f263_valor_salvamento
  costoAdquisicionNiif: number // f2631_costo_adq_orig
  metodoDepreciacionNiif: string // f2631_ind_metodo_depre
  vidaUtilPeriodosNiif: number // f2631_periodos_depreciar
  valorSalvamentoNiif: number // f2631_valor_salvamento
  porcentajeSalvamentoNiif: number // f2631_porcentaje_salvamento
  vidaUtilRemanente: number // f2631_periodos_remanentes
  unidadesRemanente: number // f2631_unidades_remanentes
  calculaDepreRevalorizacion: boolean // f2631_ind_calcula_depre_apv
}

export interface ActivosFijos {
  compania: string
  activos: ActivoFijoRow[]
}

export function activosFijosVacio(): ActivosFijos {
  return { compania: '001', activos: [] }
}

export function filaActivoFijoVacia(): ActivoFijoRow {
  return {
    reemplaza: false,
    codigoActivo: '',
    referencia: '',
    descripcion: '',
    descripcionCorta: '',
    tipoInventario: '',
    centroOperacion: '001',
    unidadNegocio: '999',
    centroCostos: '',
    tercero: '',
    depreciable: true,
    ajustable: false,
    fechaAdquisicion: '',
    costoAdquisicion: 0,
    metodoDepreciacion: '1',
    vidaUtilPeriodos: 0,
    valorSalvamento: 0,
    costoAdquisicionNiif: 0,
    metodoDepreciacionNiif: '1',
    vidaUtilPeriodosNiif: 0,
    valorSalvamentoNiif: 0,
    porcentajeSalvamentoNiif: 0,
    vidaUtilRemanente: 0,
    unidadesRemanente: 0,
    calculaDepreRevalorizacion: true,
  }
}
