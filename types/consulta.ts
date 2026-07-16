export type Modo = 'items' | 'lotes'

export type Row = {
  id: number; conteo_id: number | null
  fecha: string; referencia: string; descripcion: string
  localizacion: string; um: string; categoria: string; tipo: string
  cantidad_sistema: number; costo_unitario: number; costo_bodega: number
  conteo_fisico: number; diferencia: number; costo_diferencia: number
  observaciones: string; acumulado: boolean; cargado_por: number | null
  lote: string | null; modo: string
}

export type EditState = { conteo: string; obs: string; status: 'idle' | 'saving' | 'saved' | 'error' }
