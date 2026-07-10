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

export type TabKey = 'detalles' | 'mantenimientos' | 'incidencias' | 'cambios'

export type FiltrosEquipos = {
  buscar: string
  tipo: string
  estado: string
}

export type CamposNuevo = Record<string, string | boolean>
