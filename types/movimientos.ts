export type MovimientoResumen = {
  id: string
  fecha: string
  movimiento: string
  tipo_movimiento: string
  motivo: string
  origen_nombre: string
  origen_area: string
  destino_nombre: string
  destino_area: string
  estado: string
  registrado_por: string
  total_activos: number
}

export type ActivoDetalle = {
  id: number
  equipo_id: string
  descripcion: string
  tipo_activo: string
  cantidad: number
  marca: string
  modelo: string
  numero_serie: string
}

export type MovimientoDetalle = MovimientoResumen & {
  origen_documento: string
  destino_documento: string
  observaciones: string | null
  activos: ActivoDetalle[]
}

export type EquipoBusqueda = {
  id: string
  tipo_equipo: string
  marca: string
  modelo: string
  numero_serie: string
  usuario_asignado: string
}

export type FilaActivo = {
  equipo_id: string
  descripcion: string
  tipo_activo: string
  cantidad: number
  _busqueda: string
  _resultados: EquipoBusqueda[]
  _buscando: boolean
}

export type FiltrosMovimientos = {
  buscar: string
  estado: string
  desde: string
  hasta: string
}
