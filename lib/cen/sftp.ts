// Conexión de solo lectura a los SFTP de órdenes EDI. Nunca se borra, mueve ni
// renombra nada en el servidor: solo se lista la carpeta y se descargan los
// archivos que aún no se han procesado (el control vive en cen_archivos).
//
// Cada fuente se configura con variables de entorno con prefijo:
//   <PREFIJO>_SFTP_HOST, _PORT (opcional, 22), _USER, _PASSWORD, _DIR
import SftpClient from 'ssh2-sftp-client'
import type { FuenteEdi } from './parser'

const CONFIG: Record<FuenteEdi, { prefijo: string; dirPorDefecto: string }> = {
  carvajal: { prefijo: 'CARVAJAL', dirPorDefecto: '/ORDERS/PRINCIPAL/PROD/NIT_892301290/892301290_ORDERS_0/OUT' },
  subrik: { prefijo: 'SUBRIK', dirPorDefecto: 'ORDERS' },
}

export const FUENTES: FuenteEdi[] = ['carvajal', 'subrik']

export interface ArchivoRemoto { nombre: string; tamano: number; fecha: Date }

function config(fuente: FuenteEdi) {
  const { prefijo, dirPorDefecto } = CONFIG[fuente]
  const v = (n: string) => process.env[`${prefijo}_SFTP_${n}`]
  const host = v('HOST'), username = v('USER'), password = v('PASSWORD')
  if (!host || !username || !password) return null
  return { host, port: Number(v('PORT') || 22), username, password, dir: v('DIR') || dirPorDefecto }
}

export function fuenteConfigurada(fuente: FuenteEdi): boolean {
  return config(fuente) !== null
}

// Abre la conexión, ejecuta `fn` y la cierra siempre.
export async function conSftp<T>(
  fuente: FuenteEdi,
  fn: (h: { listar: () => Promise<ArchivoRemoto[]>; leer: (nombre: string) => Promise<string> }) => Promise<T>,
): Promise<T> {
  const cfg = config(fuente)
  if (!cfg) throw new Error(`Faltan las credenciales del SFTP de ${fuente}`)
  const sftp = new SftpClient()
  await sftp.connect({ host: cfg.host, port: cfg.port, username: cfg.username, password: cfg.password, readyTimeout: 20000 })
  try {
    return await fn({
      listar: async () => (await sftp.list(cfg.dir))
        .filter(a => a.type === '-')
        .map(a => ({ nombre: a.name, tamano: a.size, fecha: new Date(a.modifyTime) })),
      // Los archivos EDI vienen en ASCII/Latin-1, no en UTF-8.
      leer: async (nombre: string) => {
        const buf = await sftp.get(`${cfg.dir}/${nombre}`) as Buffer
        return buf.toString('latin1')
      },
    })
  } finally {
    await sftp.end().catch(() => {})
  }
}
