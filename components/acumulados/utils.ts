export function fmt(n: number, prefix = '$') {
  if (n === null || n === undefined || isNaN(n)) return '—'
  const s = Math.abs(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })
  return (n < 0 ? `-${prefix}` : prefix) + s
}

export function fmtFechaCorta(f: string) {
  return String(f).substring(0, 10).replace(/-/g, '/')
}
