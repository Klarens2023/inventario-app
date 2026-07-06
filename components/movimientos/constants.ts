import type { FilaActivo } from '@/types/movimientos'

export const TIPOS_MOV = [
  'Asignación / Reasignación', 'Traslado Interno', 'Cambio de responsable',
  'Salida por mantenimiento o servicio', 'Préstamo', 'Devolución',
  'Baja / disposición final', 'Movimiento excepcional',
  'Control / movimiento de estibas', 'Herramientas y equipos menores',
]

export const MOTIVOS = [
  'Inicio de Labores', 'Cambio de cargo / dependencia', 'Necesidad Operativa',
  'Mantenimiento / Reparación', 'Calibración / Verificación',
  'Evento, bienestar o actividad institucional',
  'Cumplimiento normativo / auditoría', 'Daño, obsolescencia o pérdida',
  'Control logístico de estibas', 'Control de herramientas de terceros / técnicos',
]

export const AREAS = [
  'Talento Humano', 'Compras', 'Logística', 'Proyectos',
  'Contabilidad / Financiera', 'Sistemas', 'Mantenimiento', 'Producción',
  'HSE', 'Calidad', 'Auditoría', 'Comercial', 'TAT', 'Otros / Externos',
]

export const TIPOS_ACTIVO = [
  'Equipo', 'Herramienta', 'Mobiliario', 'Maquinaria', 'Repuesto',
  'Elemento HSE', 'Equipo de cómputo', 'Equipo de comunicación',
  'Equipo industrial', 'Equipo de medición', 'Equipo de refrigeración',
]

export const ESTADOS_COLOR: Record<string, { color: string; bg: string }> = {
  autorizado: { color: '#1e40af', bg: '#dbeafe' },
  entregado:  { color: '#92400e', bg: '#fef3c7' },
  recibido:   { color: '#065f46', bg: '#d1fae5' },
  cerrado:    { color: '#374151', bg: '#f3f4f6' },
}

export const FILA_VACIA = (): FilaActivo => ({
  equipo_id: '', descripcion: '', tipo_activo: '', cantidad: 1,
  _busqueda: '', _resultados: [], _buscando: false,
})
