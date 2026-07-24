import type { PuntoVenta } from '@/types/pvn-qr'

export type PagoAdmin = {
  id: number
  usuario_id: number
  usuario_nombre: string
  punto_venta_id: number | null
  punto_venta_nombre: string | null
  fecha: string
  valor: number
  foto_url: string
  created_at: string
}
export type Usuario = { id: number; nombre: string; rol: string }
export type SortKey = 'fecha' | 'punto' | 'usuario' | 'valor'
export type TurnoActivo = {
  id: number
  usuario_id: number
  usuario_nombre: string
  punto_venta_id: number
  punto_venta_nombre: string
  fecha: string
  abierto_at: string
}
export type CierreTurno = {
  id: number
  usuario_id: number
  usuario_nombre: string
  punto_venta_id: number | null
  punto_venta_nombre: string | null
  fecha: string
  fecha_cierre: string
  abierto_at: string
  cerrado_at: string | null
  foto_datafono_url: string | null
  numero_recogida: string | null
}
export type { PuntoVenta }
