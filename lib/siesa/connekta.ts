// Cliente de la API Connekta de Siesa (consultas y conectores de importación).
// Variables de entorno:
//   SIESA_CLIENT_ID, SIESA_CONNI_KEY, SIESA_CONNI_TOKEN   credenciales (obligatorias; van como
//   encabezados client_id, ConniKey y ConniToken en cada llamada)
//   SIESA_API_URL      base, por defecto https://apiqa.siesacloud.com/connekta/siesa/estandar (QA)
//   SIESA_ID_COMPANIA  id de la compañía en Siesa Cloud, por defecto 9116
// Las consultas devuelven { codigo: 0, mensaje, detalle: { Table: [...] } }.
//
// Conexión "real" (producción de Siesa), por ahora SOLO para buscar pedidos institucionales
// (lib/cen/pedidosInstitucionales.ts). Las órdenes EDI siguen con la de arriba (QA):
//   SIESA_REAL_CLIENT_ID, SIESA_REAL_CONNI_KEY, SIESA_REAL_CONNI_TOKEN   credenciales de producción
//   SIESA_REAL_API_URL       por defecto https://api.siesacloud.com/connekta/siesa/estandar
//   SIESA_REAL_ID_COMPANIA   por defecto el mismo SIESA_ID_COMPANIA (9116)

export type ConexionSiesa = 'qa' | 'real'

function config(c: ConexionSiesa) {
  if (c === 'real') {
    return {
      base: (process.env.SIESA_REAL_API_URL || 'https://api.siesacloud.com/connekta/siesa/estandar').replace(/\/$/, ''),
      compania: process.env.SIESA_REAL_ID_COMPANIA || process.env.SIESA_ID_COMPANIA || '9116',
      clientId: process.env.SIESA_REAL_CLIENT_ID, key: process.env.SIESA_REAL_CONNI_KEY, token: process.env.SIESA_REAL_CONNI_TOKEN,
      nombres: 'SIESA_REAL_CLIENT_ID, SIESA_REAL_CONNI_KEY y SIESA_REAL_CONNI_TOKEN',
    }
  }
  return {
    base: (process.env.SIESA_API_URL || 'https://apiqa.siesacloud.com/connekta/siesa/estandar').replace(/\/$/, ''),
    compania: process.env.SIESA_ID_COMPANIA || '9116',
    clientId: process.env.SIESA_CLIENT_ID, key: process.env.SIESA_CONNI_KEY, token: process.env.SIESA_CONNI_TOKEN,
    nombres: 'SIESA_CLIENT_ID, SIESA_CONNI_KEY y SIESA_CONNI_TOKEN',
  }
}
const BASE = () => config('qa').base
const COMPANIA = () => config('qa').compania

export function siesaConfigurado(conexion: ConexionSiesa = 'qa'): boolean {
  const c = config(conexion)
  return Boolean(c.clientId && c.key && c.token)
}

function encabezados(conexion: ConexionSiesa = 'qa'): Record<string, string> {
  const c = config(conexion)
  if (!c.clientId || !c.key || !c.token) throw new Error(`Faltan las credenciales de la API de Siesa (${c.nombres})`)
  return { 'Content-Type': 'application/json', client_id: c.clientId, ConniKey: c.key, ConniToken: c.token }
}

// Condición para el parámetro "parametros" de las consultas: los valores van entre comillas dobladas ('' '').
export function condicion(campo: string, valor: string): string {
  return `${campo}=''${String(valor).replace(/'/g, '')}''`
}

export async function consultar<T = Record<string, unknown>>(
  descripcion: string,
  opciones: { parametros?: string; pagina?: number; tamano?: number; conexion?: ConexionSiesa } = {},
): Promise<T[]> {
  const { parametros, pagina = 1, conexion = 'qa' } = opciones
  const cfg = config(conexion)
  // Siesa no acepta páginas de más de 100 filas (con más devuelve una sola fila).
  const tamano = Math.min(opciones.tamano ?? 100, 100)
  // La paginación usa "|" y "=" dentro del valor: se arma a mano para no romper el formato que espera Siesa.
  let url = `${cfg.base}/consulta/v3?idCompania=${cfg.compania}&descripcion=${encodeURIComponent(descripcion)}` +
    `&paginacion=numPag=${pagina}|tamPag=${tamano}`
  if (parametros) url += `&parametros=${encodeURIComponent(parametros)}`

  const res = await fetch(url, { headers: encabezados(conexion), cache: 'no-store' })
  const texto = await res.text()
  let data: { codigo?: number; mensaje?: string; detalle?: { Table?: T[] } | string }
  try { data = JSON.parse(texto) } catch { throw new Error(`Siesa respondió algo que no es JSON (HTTP ${res.status}): ${texto.slice(0, 200)}`) }
  if (!res.ok || (data.codigo !== undefined && data.codigo !== 0)) {
    // Sin resultados llega como HTTP 400, codigo 1 y detalle "No se encontraron registros, por favor verifique."
    const detalle = typeof data.detalle === 'string' ? data.detalle : ''
    if (/no se encontraron registros/i.test(detalle)) return []
    throw new Error(`Consulta ${descripcion}: ${[data.mensaje, detalle].filter(Boolean).join(' · ') || `HTTP ${res.status}`}`)
  }
  return typeof data.detalle === 'object' ? data.detalle?.Table ?? [] : []
}

// Recorre todas las páginas (de a 100) hasta que una venga incompleta.
export async function consultarTodo<T = Record<string, unknown>>(descripcion: string, parametros?: string, maxPaginas = 60, conexion: ConexionSiesa = 'qa'): Promise<T[]> {
  const filas: T[] = []
  for (let pagina = 1; pagina <= maxPaginas; pagina++) {
    const r = await consultar<T>(descripcion, { parametros, pagina, tamano: 100, conexion })
    filas.push(...r)
    if (r.length < 100) break
  }
  return filas
}

export interface RespuestaConector {
  ok: boolean
  status: number
  cuerpo: unknown // respuesta completa de Siesa, se guarda tal cual
  mensaje: string
}

// Envía un documento a un conector de importación (ej. pedido de venta).
export async function enviarConector(idDocumento: string, nombreDocumento: string, documento: unknown): Promise<RespuestaConector> {
  const url = `${BASE()}/conector/v3?idCompania=${COMPANIA()}&idDocumento=${encodeURIComponent(idDocumento)}` +
    `&nombreDocumento=${encodeURIComponent(nombreDocumento)}`
  const res = await fetch(url, { method: 'POST', headers: encabezados(), body: JSON.stringify(documento), cache: 'no-store' })
  const texto = await res.text()
  let cuerpo: unknown = texto
  try { cuerpo = JSON.parse(texto) } catch { /* se guarda como texto */ }
  const c = cuerpo as { codigo?: number; mensaje?: string }
  const ok = res.ok && (c?.codigo === undefined || c.codigo === 0)
  return { ok, status: res.status, cuerpo, mensaje: c?.mensaje ?? (typeof cuerpo === 'string' ? cuerpo.slice(0, 300) : `HTTP ${res.status}`) }
}
