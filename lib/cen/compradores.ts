// Nombre corto de cada cadena según el EAN del comprador (NAD BY) de la orden EDI.
export const COMPRADORES: Record<string, string> = {
  '7701001000008': 'Éxito',
  '7701008009080': 'Olímpica',
  '7706371000009': 'Makro',
  '7707185370005': 'Cencosud',
  '7700304892105': 'D1',
  '7704269000018': 'Ara',
}

export function nombreComprador(ean: string): string {
  return COMPRADORES[ean] ?? ean
}
