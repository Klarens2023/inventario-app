export type Equipo = {
  id: string
  tipo_equipo: string
  marca: string
  modelo: string
  numero_serie: string
  sede: string
  area_ubicacion: string
  usuario_asignado: string
  responsable: string
  estado: string
  proximo_mantenimiento: string | null
  fecha_registro: string
}

export type EquipoDetalle = Record<string, string | boolean | null>

export type HistReg = Record<string, string | number | null>

export type TabKey = 'detalles' | 'mantenimientos' | 'incidencias' | 'cambios' | 'movimientos'

export type FiltrosEquipos = {
  buscar: string
  tipo: string
  estado: string
}

export type CamposNuevo = Record<string, string | boolean>

export type EquipoMantenimiento = {
  id: string
  tipo_equipo: string
  marca: string
  modelo: string
  sede: string
  area_ubicacion: string
  responsable: string
  estado: string
  tipo_mantenimiento: string | null
  frecuencia_mantenimiento: string | null
  tecnico_responsable: string | null
  ultimo_mantenimiento: string | null
  proximo_mantenimiento: string | null
}

export type RegistroMantenimiento = {
  equipo_id: string
  fecha: string
  realizado: boolean
  tecnico?: string
  proxima_fecha?: string
  descripcion?: string
  observaciones?: string
}
