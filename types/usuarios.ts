export type Usuario = {
  id: number
  username: string
  nombre: string
  rol: string
  area: string
  activo: boolean
  debe_cambiar_password: boolean
  created_at: string
  punto_venta_id?: number | null
  punto_venta_nombre?: string | null
  modulos?: string[]
}

export type PuntoVenta = { id: number; nombre: string; activo: boolean }
