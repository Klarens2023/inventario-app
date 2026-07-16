export type Modo = 'items' | 'lotes'

export type Row = {
  fecha: string; categoria: string; tipo: string; referencia: string
  descripcion: string; localizacion: string; um: string
  cantidad_sistema: number; costo_unitario: number
  conteo_fisico: number; diferencia: number
  costo_diferencia: number; costo_bodega_total: number
  observaciones: string; lote: string | null; modo: string
}

export type Totales = { costo_bodega: number; costo_diferencia: number }

export type PivotItem = {
  referencia: string; descripcion: string; categoria: string
  tipo: string; lote: string | null; datosPorFecha: Record<string, Row>
}
