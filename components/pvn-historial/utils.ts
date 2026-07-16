export function fmtFecha(dateStr: string) {
  return new Date(dateStr.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function limpiar(n: string) { return n.replace(/ \(IVA\)$/, '').replace(/ IVA$/, '') }
