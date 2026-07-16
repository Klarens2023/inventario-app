export function limpiar(n: string) { return n.replace(/ \(IVA\)$/, '').replace(/ IVA$/, '') }

export function fmtNum(v: number, unidad: string) {
  if (unidad === 'KG')  return Number(v).toFixed(3)
  if (unidad === 'GRM') return Number(v).toFixed(1)
  return Math.round(Number(v)).toString()
}

export function fmtFechaCort(s: string) {
  return new Date(s.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

export const TURNO_COLOR: Record<string, { color: string; bg: string }> = {
  'Mañana': { color: '#92400e', bg: '#fef3c7' },
  'Tarde':  { color: '#1e3a5f', bg: '#dbeafe' },
  'Noche':  { color: '#4c1d95', bg: '#ede9fe' },
  'Cierre': { color: '#065f46', bg: '#d1fae5' },
}
