// Código de relación de despacho RUTA-MMSS (mes + semana ISO de la entrega),
// como en el libro de logística (ej. DISTRYCAR-1043). Sin dependencias de servidor.
export function codigoRelacion(ruta: string | null, fechaEntrega: string | null): string | null {
  if (!ruta || !fechaEntrega) return null
  const d = new Date(fechaEntrega + 'T12:00:00Z')
  const jueves = new Date(d); jueves.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7))
  const semana = Math.ceil(((jueves.getTime() - Date.UTC(jueves.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7)
  return `${ruta}-${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(semana).padStart(2, '0')}`
}
