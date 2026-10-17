#!/usr/bin/env node
/**
 * Prueba de conexión a los SFTP del módulo de órdenes (Carvajal/CEN y Subrik):
 * lista las carpetas y descarga hasta 3 archivos de ejemplo a una carpeta
 * local, para conocer el formato antes de construir el módulo. SOLO LEE: no
 * mueve, no renombra ni borra nada en el servidor.
 *
 * Cada conexión usa sus propias variables en .env.local, con un prefijo:
 *   <PREFIJO>_SFTP_HOST, <PREFIJO>_SFTP_PORT (opcional, 22), <PREFIJO>_SFTP_USER,
 *   <PREFIJO>_SFTP_PASSWORD, <PREFIJO>_SFTP_DIR (opcional, carpeta; por defecto la raíz)
 * Ej.: CARVAJAL_SFTP_HOST=..., SUBRIK_SFTP_HOST=...
 *
 * Uso: node --env-file=.env.local scripts/probar-sftp.js CARVAJAL
 *      node --env-file=.env.local scripts/probar-sftp.js SUBRIK
 */

const path = require('path')
const fs = require('fs')
const SftpClient = require('ssh2-sftp-client')

async function main() {
  const prefijo = (process.argv[2] || '').toUpperCase()
  if (!prefijo) {
    console.error('❌ Indique cuál conexión probar, ej.: node --env-file=.env.local scripts/probar-sftp.js CARVAJAL')
    process.exit(1)
  }
  const v = (nombre) => process.env[`${prefijo}_SFTP_${nombre}`]
  const host = v('HOST'), user = v('USER'), password = v('PASSWORD')
  if (!host || !user || !password) {
    console.error(`❌ Faltan ${prefijo}_SFTP_HOST, ${prefijo}_SFTP_USER o ${prefijo}_SFTP_PASSWORD en .env.local`)
    process.exit(1)
  }
  const destino = path.join(process.cwd(), 'muestras-cen', prefijo.toLowerCase())
  const dir = v('DIR') || '.'

  const sftp = new SftpClient()
  await sftp.connect({
    host,
    port: Number(v('PORT') || 22),
    username: user,
    password,
    readyTimeout: 20000,
  })
  console.log(`✅ [${prefijo}] Conectado a ${host}. Directorio actual: ${await sftp.cwd()}`)

  try {
    const lista = await sftp.list(dir)
    console.log(`\nContenido de "${dir}" (${lista.length} elementos):`)
    for (const e of lista.sort((a, b) => b.modifyTime - a.modifyTime)) {
      const tipo = e.type === 'd' ? '[carpeta]' : `${e.size} bytes`
      console.log(`  ${e.type === 'd' ? 'd' : '-'} ${new Date(e.modifyTime).toISOString().slice(0, 16)}  ${e.name}  ${tipo}`)
    }

    // Subcarpetas: solo se listan los nombres de su contenido (primer nivel)
    for (const c of lista.filter(e => e.type === 'd' && !e.name.startsWith('.'))) {
      const sub = await sftp.list(`${dir}/${c.name}`).catch(() => [])
      console.log(`\n  ${c.name}/ (${sub.length} elementos): ${sub.slice(0, 10).map(s => s.name).join(', ')}${sub.length > 10 ? ', ...' : ''}`)
    }

    const archivos = lista.filter(e => e.type === '-').sort((a, b) => b.modifyTime - a.modifyTime).slice(0, 3)
    if (archivos.length) {
      fs.mkdirSync(destino, { recursive: true })
      for (const a of archivos) {
        await sftp.fastGet(`${dir}/${a.name}`, path.join(destino, a.name))
        console.log(`\n⬇ Descargado: ${a.name}`)
      }
      console.log(`\nMuestras guardadas en: ${destino}`)
    } else {
      console.log(`\n(No hay archivos en esa carpeta; si están en una subcarpeta, póngala en ${prefijo}_SFTP_DIR)`)
    }
  } finally {
    await sftp.end()
  }
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
