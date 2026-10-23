/**
 * Fecha de hoy en Colombia (America/Bogota) en formato AAAA-MM-DD.
 *
 * Por qué no `new Date().toISOString().slice(0, 10)`: eso da la fecha en UTC y,
 * desde las 7:00 p. m. de Colombia (UTC−5), ya es "mañana". Los turnos, pagos y
 * registros de ventas se fechan con el día local. Única definición para toda la
 * app (antes había siete copias de esta función).
 */
export function hoyBogota(): string {
  // 'en-CA' formatea como AAAA-MM-DD
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}
