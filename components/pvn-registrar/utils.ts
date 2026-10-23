// Definición única en lib/fechas.ts; se reexporta para no cambiar los imports existentes
export { hoyBogota } from '@/lib/fechas'

export function limpiarNombre(n: string) {
  return n.replace(/ \(IVA\)$/, '').replace(/ IVA$/, '')
}

export function categoria(nombre: string): string {
  const n = nombre.toUpperCase()
  if (n.startsWith('HELADO')) return 'Helados'
  if (n.startsWith('GRANIZADO')) return 'Granizados'
  if (n.includes('SUNDAE')) return 'Sundaes'
  return 'Otros'
}
