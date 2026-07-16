export type Turno = { id: number; punto_venta_id: number; punto_venta_nombre: string; fecha: string; abierto_at: string }
export type TurnoResp = { turnoHoy: Turno | null; turnoPendiente: Turno | null }
export type TurnoHist = { id: number; punto_venta_nombre: string; abierto_at: string; cerrado_at: string | null; activo: boolean }
export type PuntoVenta = { id: number; nombre: string; activo: boolean; tipo: string }
export type Pago = { id: number; punto_venta_nombre: string | null; fecha: string; valor: number; foto_url: string; created_at: string }
export type ResumenCierre = { total_pagos: number; total_valor: number }
