// Registro de cada sincronización de órdenes EDI (tabla cen_sincronizaciones).
//
// Sirve para saber si las tareas programadas de verdad corren (Vercel Hobby
// guarda los logs solo 1 hora y GitHub descarta ejecuciones) y para mostrar en
// la pantalla de Órdenes EDI "Última sincronización: hace X minutos".
//
// Nunca rompe la sincronización: si la tabla aún no existe (migración sin
// correr) o la BD falla al registrar, solo deja un aviso en el log.
import { sql } from '@/lib/db'
import type { ResultadoFuente } from './sincronizar'

export type OrigenSincronizacion = 'vercel-cron' | 'github' | 'manual'

/** Se conservan 30 días de registros; lo viejo se borra al registrar. */
const DIAS_CONSERVADOS = 30

export async function registrarSincronizacion(params: {
  origen: OrigenSincronizacion
  inicio: Date
  resultados?: ResultadoFuente[]
  error?: string
  usuario?: string | null
}) {
  const { origen, inicio, resultados, error, usuario } = params
  // Resumen por fuente: solo cantidades, sin datos de las órdenes
  const resumen = resultados?.map(r => ({
    fuente: r.fuente, configurada: r.configurada, nuevas: r.nuevas, actualizadas: r.actualizadas,
    errores: r.errores.length, pendientes: r.pendientesPorTraer, error: r.error ?? null,
  })) ?? null
  // Exitosa si no hubo excepción y ninguna fuente configurada falló al conectar
  const ok = !error && !(resultados ?? []).some(r => r.configurada && r.error)
  try {
    await sql`
      INSERT INTO cen_sincronizaciones (inicio, fin, origen, ok, resumen, error, usuario)
      VALUES (${inicio.toISOString()}, NOW(), ${origen}, ${ok}, ${resumen ? JSON.stringify(resumen) : null}, ${error ?? null}, ${usuario ?? null})`
    await sql`DELETE FROM cen_sincronizaciones WHERE inicio < NOW() - make_interval(days => ${DIAS_CONSERVADOS})`
  } catch (e) {
    console.warn('[cen] No se pudo registrar la sincronización (¿falta scripts/migrate-add-cen-sincronizaciones.js?):', (e as Error).message)
  }
}

/** Últimas sincronizaciones (más reciente primero) para la pantalla de Órdenes EDI. */
export async function ultimasSincronizaciones(limite = 10) {
  try {
    return await sql`
      SELECT id, inicio, fin, origen, ok, resumen, error, usuario
      FROM cen_sincronizaciones ORDER BY inicio DESC LIMIT ${limite}`
  } catch {
    return [] // tabla sin crear: la pantalla simplemente no muestra el dato
  }
}
