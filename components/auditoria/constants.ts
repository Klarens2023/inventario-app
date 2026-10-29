import type { CSSProperties } from 'react'

// Todas las acciones que registra logAudit (lib/audit.ts), con su nombre y
// color en la tabla. El filtro de la página y el resumen salen de esta lista:
// una acción nueva solo hay que agregarla aquí.
const AZUL = { color: '#1d4ed8', bg: '#dbeafe' }
const VERDE = { color: '#065f46', bg: '#d1fae5' }
const MORADO = { color: '#6d28d9', bg: '#ede9fe' }
const ROJO = { color: '#991b1b', bg: '#fee2e2' }
const CELESTE = { color: '#0369a1', bg: '#e0f2fe' }
const AMBAR = { color: '#92400e', bg: '#fef3c7' }
const GRIS = { color: '#374151', bg: '#f3f4f6' }

export const ACCIONES: Record<string, { label: string; color: string; bg: string }> = {
  // Inicios de sesión (web y app móvil)
  LOGIN_EXITOSO:              { label: 'Inicio de sesión',          ...VERDE },
  LOGIN_FALLIDO:              { label: 'Inicio fallido',            ...AMBAR },
  LOGIN_BLOQUEADO:            { label: 'Cuenta bloqueada',          ...ROJO },
  DOS_PASOS_ACTIVADO:         { label: '2 pasos activada',          ...VERDE },
  DOS_PASOS_REINICIADO:       { label: '2 pasos reiniciada',        ...AMBAR },
  DOS_PASOS_CODIGOS_REGENERADOS: { label: 'Códigos de recuperación', ...GRIS },
  // Inventario
  CARGA_INVENTARIO:           { label: 'Carga Inventario',          ...AZUL },
  CONTEO_ACTUALIZADO:         { label: 'Conteo Actualizado',        ...VERDE },
  CONTEO_ACUMULADO:           { label: 'Conteo Acumulado',          ...MORADO },
  HISTORIAL_REINICIADO:       { label: 'Historial Reiniciado',      ...ROJO },
  // Usuarios y áreas
  USUARIO_CREADO:             { label: 'Usuario Creado',            ...CELESTE },
  USUARIO_MODIFICADO:         { label: 'Usuario Modificado',        ...AMBAR },
  AREA_CREADA:                { label: 'Área Creada',               ...CELESTE },
  AREA_MODIFICADA:            { label: 'Área Modificada',           ...AMBAR },
  AREA_ELIMINADA:             { label: 'Área Eliminada',            ...ROJO },
  // Puntos de venta
  PVN_REGISTRO_CREADO:        { label: 'Registro de Ventas',        ...AZUL },
  PVN_PAGO_QR_REGISTRADO:     { label: 'Pago QR Registrado',        ...VERDE },
  PVN_PAGO_QR_EDITADO:        { label: 'Pago QR Editado',           ...AMBAR },
  PVN_PAGO_QR_ELIMINADO:      { label: 'Pago QR Eliminado',         ...ROJO },
  PVN_QR_CIERRE_DIA:          { label: 'Cierre del Día QR',         ...MORADO },
  PVN_TURNO_ABIERTO:          { label: 'Turno Abierto',             ...CELESTE },
  PVN_TURNO_CERRADO:          { label: 'Turno Cerrado',             ...GRIS },
  // Sistemas
  EQUIPO_CREADO:              { label: 'Equipo Creado',             ...CELESTE },
  EQUIPO_ACTUALIZADO:         { label: 'Equipo Actualizado',        ...AMBAR },
  EQUIPO_ELIMINADO:           { label: 'Equipo Eliminado',          ...ROJO },
  MANTENIMIENTO_REALIZADO:    { label: 'Mantenimiento Realizado',   ...VERDE },
  MANTENIMIENTO_NO_REALIZADO: { label: 'Mantenimiento No Realizado', ...AMBAR },
  TIC_MOVIMIENTO_CREADO:      { label: 'Movimiento TIC',            ...AZUL },
  TIC_MOVIMIENTO_ESTADO:      { label: 'Estado de Movimiento TIC',  ...MORADO },
  TIC_MOVIMIENTO_FOTO_SUBIDA: { label: 'Foto de Movimiento TIC',    ...GRIS },
  TIC_ARTICULO_CREADO:        { label: 'Artículo TIC Creado',       ...CELESTE },
  TIC_ARTICULO_ACTUALIZADO:   { label: 'Artículo TIC Actualizado',  ...AMBAR },
  TIC_ARTICULO_MOVIMIENTO:    { label: 'Movimiento de Artículo TIC', ...AZUL },
}

export const labelStyle: CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6
}

export const inputStyle: CSSProperties = {
  padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
  fontSize: 14, color: '#1e293b', background: '#fff', outline: 'none', minWidth: 160
}

export const btnStyle: CSSProperties = {
  padding: '9px 24px', borderRadius: 8, border: 'none',
  background: '#0047BA', color: '#fff', fontWeight: 700,
  fontSize: 14, cursor: 'pointer'
}
