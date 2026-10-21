export type Categoria = 'Repuesto' | 'Insumo' | 'Periférico'

export type TipoMovArticulo = 'entrada' | 'salida' | 'ajuste'

export type DestinoSalida = 'equipo' | 'persona' | 'consumo'

export type DestinoRetiro = 'inventario' | 'baja' | 'garantia' | 'perdido'

export type Articulo = {
  codigo: string
  categoria: Categoria
  tipo: string
  descripcion: string
  marca: string | null
  referencia: string | null
  compatible_con: string | null
  unidad: string
  stock_actual: number
  stock_minimo: number
  ubicacion: string | null
  costo_unitario: string | null
  activo: boolean
  observaciones: string | null
  actualizado_en: string
}

export type CamposArticulo = {
  categoria: Categoria | ''
  tipo: string
  descripcion: string
  marca: string
  referencia: string
  compatible_con: string
  unidad: string
  stock_inicial: string
  stock_minimo: string
  ubicacion: string
  costo_unitario: string
  observaciones: string
}

export type MovimientoArticulo = {
  id: number
  articulo_codigo: string
  descripcion: string
  categoria: Categoria
  unidad: string
  fecha: string
  tipo: TipoMovArticulo
  motivo: string
  cantidad: number
  stock_anterior: number
  stock_resultante: number
  equipo_id: string | null
  destino_nombre: string | null
  destino_area: string | null
  proveedor: string | null
  documento_ref: string | null
  costo_unitario: string | null
  observaciones: string | null
  registrado_por: string
}

export type CamposMovimiento = {
  tipo: TipoMovArticulo
  fecha: string
  motivo: string
  cantidad: string
  destino: DestinoSalida
  es_prestamo: boolean
  fecha_limite_prestamo: string
  equipo_id: string
  destino_nombre: string
  destino_area: string
  proveedor: string
  documento_ref: string
  costo_unitario: string
  contador_paginas: string
  observaciones: string
}

export type FiltrosArticulos = {
  buscar: string
  categoria: string
  stock: '' | 'bajo' | 'agotado'
  inactivos: boolean
}

export type FiltrosKardex = {
  buscar: string
  tipo: string
  desde: string
  hasta: string
}

export type EquipoOpcion = {
  id: string
  tipo_equipo: string
  marca: string
  modelo: string
  usuario_asignado: string | null
  area_ubicacion: string | null
}

export type Asignacion = {
  id: number
  articulo_codigo: string
  descripcion: string
  tipo: string
  categoria: Categoria
  unidad: string
  cantidad: number
  equipo_id: string | null
  tipo_equipo: string | null
  equipo_marca: string | null
  equipo_modelo: string | null
  persona_nombre: string | null
  persona_area: string | null
  es_prestamo: boolean
  fecha_asignacion: string
  fecha_limite_prestamo: string | null
  observaciones: string | null
  estado: 'vigente' | 'devuelto' | 'reemplazado'
  destino_retiro: DestinoRetiro | null
  fecha_retiro: string | null
  motivo_retiro: string | null
  detalle_retiro: string | null
  reemplaza_a: number | null
  reemplazada_por: number | null
  reemplazada_por_codigo: string | null
  reemplazada_por_descripcion: string | null
  registrado_por: string
  cerrado_por: string | null
  vencido: boolean
}

export type FiltrosAsignaciones = {
  buscar: string
  estado: '' | 'vigente' | 'cerrada'
  vencidos: boolean
}

// Lo que el servidor devuelve (409) cuando el equipo ya tiene un artículo del mismo tipo
export type AsignadoPrevio = {
  id: number
  articulo_codigo: string
  descripcion: string
  cantidad: number
  fecha_asignacion: string
  persona_nombre: string | null
  es_prestamo: boolean
}

export type DecisionReemplazo = {
  decision: 'reemplazo' | 'adicional'
  asignacion_id?: number
  motivo?: string
  detalle?: string
  destino_retiro?: DestinoRetiro
}

// ---------- Análisis de consumo y gasto ----------
export type FiltrosConsumo = {
  desde: string
  hasta: string
  categoria: string
  equipo_id: string
  area: string
}

export type ConsumoResumen = { gasto: number; unidades: number; salidas: number; equipos: number; sin_costo: number }
export type ConsumoEquipo = {
  equipo_id: string | null; tipo_equipo: string | null; marca: string | null; modelo: string | null
  usuario_asignado: string | null; area: string; unidades: number; gasto: number; salidas: number
  ultimo: string; tipos: string
}
export type ConsumoArea = { area: string; unidades: number; gasto: number; equipos: number }
export type ConsumoArticulo = {
  articulo_codigo: string; descripcion: string; tipo_articulo: string; categoria: Categoria; unidad: string
  unidades: number; gasto: number; equipos: number
}
export type ConsumoMes = { mes: string; insumos: number | null; repuestos: number | null; perifericos: number | null; gasto: number }
export type Rendimiento = {
  equipo_id: string; marca: string | null; modelo: string | null; articulo_codigo: string; descripcion: string
  cambios: number; paginas_promedio: number; dias_promedio: number; costo_pagina: number | null; ultimo_contador: number
}
export type ReporteConsumo = {
  resumen: ConsumoResumen
  por_equipo: ConsumoEquipo[]
  por_area: ConsumoArea[]
  por_articulo: ConsumoArticulo[]
  por_mes: ConsumoMes[]
  rendimiento: Rendimiento[]
  detalle?: ConsumoDetalle[]
}

export type ConsumoDetalle = {
  fecha: string; tipo: string; motivo: string; articulo_codigo: string; descripcion: string; tipo_articulo: string
  categoria: string; equipo_id: string | null; area: string; destino_nombre: string | null; unidades: number
  costo_unitario: number | null; gasto: number; contador_paginas: number | null; registrado_por: string
}

// ---------- Datos para formatos impresos ----------
export type AsignacionImpresion = {
  id: number; articulo_codigo: string; cantidad: number; equipo_id: string | null
  persona_nombre: string | null; persona_area: string | null; es_prestamo: boolean
  fecha_asignacion: string; fecha_limite_prestamo: string | null; observaciones: string | null
  estado: 'vigente' | 'devuelto' | 'reemplazado'; destino_retiro: DestinoRetiro | null; fecha_retiro: string | null
  motivo_retiro: string | null; detalle_retiro: string | null; reemplaza_a: number | null; reemplazada_por: number | null
  registrado_por: string; cerrado_por: string | null
  descripcion: string; tipo: string; categoria: Categoria; marca: string | null; referencia: string | null; unidad: string
  costo_unitario: number | null; motivo_entrega: string
  tipo_equipo: string | null; equipo_marca: string | null; equipo_modelo: string | null; equipo_serie: string | null
  equipo_hostname: string | null; equipo_placa: string | null; equipo_area: string | null; equipo_usuario: string | null
  ant_codigo: string | null; ant_descripcion: string | null; ant_cantidad: number | null; ant_fecha: string | null
  ant_destino: DestinoRetiro | null; ant_motivo: string | null; ant_detalle: string | null
  nue_codigo: string | null; nue_descripcion: string | null; nue_fecha: string | null
}

export type MovimientoImpresion = {
  id: number; articulo_codigo: string; fecha: string; tipo: TipoMovArticulo; motivo: string; cantidad: number
  stock_anterior: number; stock_resultante: number; equipo_id: string | null; destino_nombre: string | null
  destino_area: string | null; proveedor: string | null; documento_ref: string | null; costo_unitario: number | null
  contador_paginas: number | null; observaciones: string | null; registrado_por: string
  descripcion: string; tipo_articulo: string; categoria: Categoria; marca: string | null; referencia: string | null; unidad: string
  tipo_equipo: string | null; equipo_marca: string | null; equipo_modelo: string | null; equipo_serie: string | null
  equipo_area: string | null; equipo_usuario: string | null
  asignacion_entrega: number | null; asignacion_retorno: number | null
}
