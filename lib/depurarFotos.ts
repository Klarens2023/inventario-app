// Depuración automática de las fotos de comprobantes de pagos QR.
//
// Regla (decidida el 30/10/2026, confirmada con contabilidad): las FOTOS de más
// de 60 días se borran; el REGISTRO del pago (valor, fecha, punto, usuario) se
// conserva para los reportes. Reemplaza el borrado manual en Drive.
//
// - La foto va a la papelera de Drive (no se elimina en el acto): en la unidad
//   compartida Google la borra sola a los 30 días; mientras, se puede restaurar.
// - El pago queda con foto_eliminada_en = fecha de depuración; las pantallas
//   muestran "Foto depurada" en vez de la imagen.
// - Si la foto ya no existía (borrada a mano), solo se marca.
// - Por ejecución se procesa un tope de fotos (para no pasar el tiempo máximo
//   de la función en Vercel); lo que falte sigue en la ejecución del día siguiente.
import { sql } from './db'
import { enviarAPapelera, idArchivoDrive } from './google-drive'

export const DIAS_CONSERVAR_FOTOS = 60

/**
 * Interruptor: solo borra de verdad si DEPURAR_FOTOS=activo (se pone únicamente
 * en Vercel Production). En local o en la rama de desarrollo, que es una copia
 * de producción cuyos pagos apuntan a las fotos REALES de Drive, solo simula.
 */
export function depuracionActiva(): boolean {
  return process.env.DEPURAR_FOTOS === 'activo'
}
const TOPE_POR_EJECUCION = 120

export type ResultadoDepuracion = {
  simulacion: boolean
  candidatas: number   // fotos de más de 60 días aún sin depurar (procesadas en esta ejecución)
  enPapelera: number   // enviadas a la papelera de Drive
  yaNoExistian: number // ya estaban borradas (a mano): solo se marcaron
  errores: number      // no se pudieron procesar: se reintentan mañana
  quedanPendientes: boolean // hay más por depurar: siguen en la ejecución de mañana (por el tope)
}

/**
 * @param simular true: solo cuenta lo que se depuraría, sin tocar Drive ni la base
 *        (para probar con datos reales sin borrar nada).
 */
export async function depurarFotosPagos(simularPedido = false): Promise<ResultadoDepuracion> {
  // Sin el interruptor activo, siempre es simulación (ver depuracionActiva)
  const simular = simularPedido || !depuracionActiva()
  // Pagos con foto, de más de 60 días y aún no depurados (los más viejos primero)
  const candidatos = await sql`
    SELECT id, foto_url FROM pvn_pagos_qr
    WHERE created_at < NOW() - make_interval(days => ${DIAS_CONSERVAR_FOTOS})
      AND foto_eliminada_en IS NULL
    ORDER BY created_at
    LIMIT ${TOPE_POR_EJECUCION + 1}`
  const lote = candidatos.slice(0, TOPE_POR_EJECUCION)
  const resultado: ResultadoDepuracion = {
    simulacion: simular, candidatas: lote.length, enPapelera: 0, yaNoExistian: 0, errores: 0,
    quedanPendientes: candidatos.length > TOPE_POR_EJECUCION,
  }
  if (simular) return resultado

  for (const pago of lote) {
    const fileId = idArchivoDrive(pago.foto_url as string)
    try {
      const estado = fileId ? await enviarAPapelera(fileId) : 'no-existe'
      if (estado === 'papelera') resultado.enPapelera++
      else resultado.yaNoExistian++
      await sql`UPDATE pvn_pagos_qr SET foto_eliminada_en = NOW() WHERE id = ${pago.id}`
    } catch (e) {
      // Un error de Drive no detiene el resto; ese pago se reintenta en la próxima ejecución
      resultado.errores++
      console.error(`[depurar-fotos] Pago ${pago.id}:`, (e as Error).message)
    }
  }
  return resultado
}
