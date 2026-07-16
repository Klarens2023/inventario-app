export type Detalle    = { producto_id: number; producto_nombre: string; cantidad: number }
export type PuntoVenta = { id: number; nombre: string; activo: boolean }
export type Registro   = {
  id: number; fecha: string; turno: string; usuario_nombre: string
  observaciones: string | null; total_unidades: number; total_productos: number
  punto_venta_id: number | null; punto_venta_nombre: string | null
  detalle: Detalle[]
}
