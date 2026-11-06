// Código de relación de despacho RUTA-MMSS (mes + semana ISO del DESPACHO), como en el libro de
// logística (ej. DISTRYCAR-1145): la misma secuencia para todas las rutas según la semana en que sale
// el camión. La fecha de despacho es la entrega menos los días de tránsito de la ruta (cen_rutas),
// salvo que se haya fijado a mano en la orden. Sin dependencias de servidor.
export function codigoRelacion(ruta: string | null, fechaDespacho: string | null): string | null {
  if (!ruta || !fechaDespacho) return null
  const d = new Date(fechaDespacho + 'T12:00:00Z')
  const jueves = new Date(d); jueves.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7))
  const semana = Math.ceil(((jueves.getTime() - Date.UTC(jueves.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7)
  return `${ruta}-${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(semana).padStart(2, '0')}`
}

/** Fecha de despacho calculada: la entrega menos los días de tránsito de la ruta (AAAA-MM-DD). */
export function fechaDespacho(fechaEntrega: string | null, diasTransito: number): string | null {
  if (!fechaEntrega) return null
  const d = new Date(fechaEntrega + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - Math.max(0, Math.trunc(diasTransito || 0)))
  return d.toISOString().slice(0, 10)
}
