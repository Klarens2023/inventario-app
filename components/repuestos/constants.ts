import type { Categoria, CamposArticulo, TipoMovArticulo, DestinoSalida, DestinoRetiro } from '@/types/repuestos'

export const CATEGORIAS: Categoria[] = ['Repuesto', 'Insumo', 'Periférico']

export const TIPOS_POR_CATEGORIA: Record<Categoria, string[]> = {
  'Repuesto': [
    'Memoria RAM', 'Disco SSD', 'Disco HDD', 'Fuente de poder', 'Batería de portátil',
    'Cargador / Adaptador de corriente', 'Pantalla de portátil', 'Teclado de portátil',
    'Tarjeta de red / WiFi', 'Ventilador / Disipador', 'Tarjeta madre', 'Pasta térmica', 'Otro',
  ],
  'Insumo': [
    'Tóner', 'Cartucho de tinta', 'Botella de tinta', 'Unidad de imagen / Drum',
    'Rollo térmico', 'Rollo de etiquetas', 'Cinta / Ribbon', 'Kit de mantenimiento',
    'Pilas / Baterías', 'Elementos de limpieza', 'Otro',
  ],
  'Periférico': [
    'Mouse', 'Teclado', 'Combo teclado y mouse', 'Diadema / Audífonos', 'Cámara web',
    'Parlantes', 'Cable HDMI / VGA / DisplayPort', 'Cable de red / Patch cord', 'Cable de poder',
    'Adaptador / Convertidor', 'Memoria USB', 'Disco externo', 'Hub USB',
    'Lector de código de barras', 'Base refrigerante', 'Regulador / Multitoma', 'Otro',
  ],
}

export const UNIDADES = ['Unidad', 'Caja', 'Paquete', 'Rollo', 'Kit', 'Metro']

export function unidadTexto(unidad: string, cantidad: number): string {
  const u = unidad.toLowerCase()
  if (Math.abs(cantidad) === 1) return u
  return /[aeiout]$/.test(u) ? `${u}s` : `${u}es`
}

export const MOTIVOS_POR_TIPO: Record<TipoMovArticulo, string[]> = {
  entrada: ['Compra', 'Devolución de usuario', 'Reposición por garantía', 'Recuperado de equipo dado de baja', 'Inventario inicial'],
  salida:  [],   // depende del destino: ver MOTIVOS_SALIDA
  ajuste:  ['Conteo físico', 'Corrección de error'],
}

export const TIPO_MOV_LABEL: Record<TipoMovArticulo, string> = {
  entrada: 'Entrada', salida: 'Salida', ajuste: 'Ajuste',
}

export const TIPO_MOV_COLOR: Record<TipoMovArticulo, { color: string; bg: string }> = {
  entrada: { color: '#065f46', bg: '#d1fae5' },
  salida:  { color: '#9a3412', bg: '#ffedd5' },
  ajuste:  { color: '#1e40af', bg: '#dbeafe' },
}

export const CATEGORIA_COLOR: Record<Categoria, { color: string; bg: string }> = {
  'Repuesto':   { color: '#5b21b6', bg: '#ede9fe' },
  'Insumo':     { color: '#0e7490', bg: '#cffafe' },
  'Periférico': { color: '#9d174d', bg: '#fce7f3' },
}

export const ARTICULO_VACIO = (): CamposArticulo => ({
  categoria: '', tipo: '', descripcion: '', marca: '', referencia: '', compatible_con: '',
  unidad: 'Unidad', stock_inicial: '0', stock_minimo: '0', ubicacion: '', costo_unitario: '', observaciones: '',
})

// 'agotado' | 'bajo' | 'ok' — bajo = en o por debajo del mínimo (cuando hay mínimo definido)
export function nivelStock(actual: number, minimo: number): 'agotado' | 'bajo' | 'ok' {
  if (actual <= 0) return 'agotado'
  if (minimo > 0 && actual <= minimo) return 'bajo'
  return 'ok'
}

export const DESTINO_SALIDA_LABEL: Record<DestinoSalida, string> = {
  equipo:  'A un equipo',
  persona: 'A una persona (sin equipo)',
  consumo: 'Consumo / gasto',
}

export const MOTIVOS_SALIDA: Record<DestinoSalida, string[]> = {
  equipo:  ['Asignación / instalación en equipo', 'Mejora / actualización', 'Equipo nuevo'],
  persona: ['Préstamo temporal', 'Entrega a usuario', 'Uso en evento / capacitación', 'Trabajo en campo / remoto'],
  consumo: ['Consumo en impresora', 'Uso en mantenimiento', 'Baja por daño / vencimiento'],
}

// Destino sugerido según la categoría del artículo
export const DESTINO_POR_CATEGORIA: Record<Categoria, DestinoSalida> = {
  'Repuesto': 'equipo', 'Periférico': 'equipo', 'Insumo': 'consumo',
}

export const MOTIVOS_REEMPLAZO = [
  'Daño / falla', 'Desgaste', 'Mejora / actualización', 'Pérdida o robo',
  'Garantía', 'Solicitud del usuario', 'Otro',
]

export const MOTIVOS_RETIRO = [
  'Fin del préstamo', 'Devolución del usuario', 'Retiro / traslado de personal', 'Cambio o baja del equipo',
  'Daño / falla', 'Pérdida o robo', 'Otro',
]

export const DESTINO_RETIRO_LABEL: Record<DestinoRetiro, string> = {
  inventario: 'Regresa al inventario (funcional)',
  baja:       'Se da de baja (dañado / inservible)',
  garantia:   'Se envía a garantía',
  perdido:    'Perdido / no se recupera',
}

export const DESTINO_RETIRO_CORTO: Record<DestinoRetiro, string> = {
  inventario: 'Volvió al inventario', baja: 'Dado de baja', garantia: 'En garantía', perdido: 'Perdido',
}

export const ESTADO_ASIG_COLOR: Record<string, { color: string; bg: string }> = {
  vigente:     { color: '#065f46', bg: '#d1fae5' },
  devuelto:    { color: '#374151', bg: '#f3f4f6' },
  reemplazado: { color: '#5b21b6', bg: '#ede9fe' },
  vencido:     { color: '#991b1b', bg: '#fee2e2' },
}

export function fmtFechaCorta(s: string | null | undefined): string {
  if (!s) return '—'
  const [y, m, d] = s.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
