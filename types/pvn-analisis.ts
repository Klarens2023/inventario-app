export type Summary     = { total_registros: number; total_unidades: number; total_productos_distintos: number }
export type Producto    = { producto_id: number; producto_nombre: string; total_vendido: number }
export type Ingrediente = { componente_nombre: string; unidad: string; total_consumido: number }
export type Tendencia   = { fecha: string; total_unidades: number }
export type PuntoVenta  = { id: number; nombre: string; activo: boolean }

export type Data = { summary: Summary; productos: Producto[]; ingredientes: Ingrediente[]; tendencia: Tendencia[] }

export type DetalleProd = {
  producto_nombre: string
  total_vendido: number
  en_registros: number
  por_dia:    Array<{ fecha: string; unidades: number }>
  por_turno:  Array<{ turno: string; unidades: number }>
  componentes: Array<{ componente_nombre: string; unidad: string; por_unidad: number; total_consumido: number }>
}
