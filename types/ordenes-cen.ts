export type EstadoOrdenCen = 'pendiente' | 'sin_punto' | 'enviado' | 'error' | 'descartada'

export type OrdenCen = {
  id: number
  fuente: 'carvajal' | 'subrik'
  numero_orden: string
  fecha_orden: string | null
  fecha_entrega: string | null
  fecha_entrega_max: string | null
  ean_comprador: string
  ean_entrega: string
  nit: string | null
  sucursal: string | null
  razon_social: string | null
  total_unidades: number
  valor_total: number
  peso_kg: number | null
  ruta: string | null
  ruta_manual: boolean
  ciudad?: string | null
  estado: EstadoOrdenCen
  lineas: number
  locales: number // tiendas del reparto (órdenes a CEDI); 0 si es entrega directa
  created_at: string
}

export type LineaOrdenCen = {
  id: number
  nro_linea: number
  ean_item: string
  cod_comprador: string | null
  descripcion: string | null
  cantidad: number
  precio: number
  iva: number | null
  item_siesa: string | null
  descripcion_maestro: string | null
  peso_kg: number | null
  und_caja: number | null
}

export type DistribucionCen = { ean_local: string; cantidad: number; ean_item: string; nit: string | null; sucursal: string | null; razon_social: string | null }

export type DetalleOrdenCen = {
  orden: OrdenCen & { siesa_consecutivo: string | null; siesa_respuesta: unknown; enviado_at: string | null }
  lineas: LineaOrdenCen[]
  distribucion: DistribucionCen[]
}

export type ResultadoSincronizacion = {
  fuente: 'carvajal' | 'subrik'
  configurada: boolean
  nuevas: number
  actualizadas: number
  omitidas: number
  errores: { archivo: string; error: string }[]
  pendientesPorTraer: number
  error?: string
}
