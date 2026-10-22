/**
 * Validaciones puras (sin dependencias de servidor) compartidas por las rutas
 * API. Se mantienen sin imports para poder probarlas con `node --test`
 * (ver tests/ y docs/TESTING.md).
 */

/** Máximo que cabe en NUMERIC(14,2) (columna pvn_pagos_qr.valor): 12 dígitos enteros. */
export const VALOR_MAXIMO = 999_999_999_999.99

/**
 * Convierte el valor de un pago (formulario web, JSON de la app móvil) a número.
 *
 * Mantiene la lectura tolerante de antes (`parseFloat`: "25000" y 25000 valen
 * igual) para no romper clientes existentes, pero rechaza lo que antes se
 * colaba: `Infinity` ("1e999"), NaN, cero, negativos y valores que no caben en
 * la columna (que hacían fallar el INSERT con un 500).
 *
 * @param v valor recibido (string o number)
 * @returns el valor redondeado a 2 decimales, o `null` si no es un monto válido
 */
export function valorMonetario(v: unknown): number | null {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  if (!Number.isFinite(n) || n <= 0 || n > VALOR_MAXIMO) return null
  const redondeado = Math.round(n * 100) / 100
  return redondeado > 0 ? redondeado : null
}
