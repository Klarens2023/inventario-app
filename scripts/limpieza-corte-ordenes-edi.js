#!/usr/bin/env node
/**
 * Corte de órdenes EDI para empezar las pruebas: deja solo las órdenes con fecha de OC desde la fecha de corte
 * y borra las anteriores con sus líneas y su reparto por tienda (se borran en cascada).
 *
 *   - Por defecto SOLO SIMULA: muestra qué se borraría. Para borrar de verdad: --aplicar
 *   - Antes de borrar guarda un respaldo JSON (órdenes, líneas y reparto) en muestras-cen/ (no se sube a git).
 *   - No toca cen_archivos: así la sincronización sabe que esos archivos ya se leyeron y no vuelve a
 *     importar las órdenes viejas (Subrik guarda los archivos en el SFTP).
 *   - Se niega a borrar órdenes que ya tienen pedido en Siesa (estado enviado).
 *   - Todo en una sola transacción: o se borra todo o nada.
 *
 * Uso (la base es la de DATABASE_URL; el script la muestra antes de hacer nada):
 *   node --env-file=.env.local scripts/limpieza-corte-ordenes-edi.js                 simular con corte 2026-10-25
 *   node --env-file=.env.local scripts/limpieza-corte-ordenes-edi.js --aplicar       borrar
 *   ... --corte=2026-10-26                                                           otra fecha de corte
 */
const fs = require('fs')
const path = require('path')
const { neon } = require('@neondatabase/serverless')

async function main() {
  if (!process.env.DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  const args = process.argv.slice(2)
  const aplicar = args.includes('--aplicar')
  const corte = (args.find(a => a.startsWith('--corte=')) ?? '--corte=2026-10-25').split('=')[1]
  if (!/^\d{4}-\d{2}-\d{2}$/.test(corte)) { console.error('❌ Fecha de corte inválida (AAAA-MM-DD)'); process.exit(1) }
  const host = process.env.DATABASE_URL.match(/@([^.]+)/)[1]
  const base = host.startsWith('ep-small-wind') ? 'PRODUCCIÓN' : host.startsWith('ep-green-boat') ? 'QA' : 'desconocida'
  const sql = neon(process.env.DATABASE_URL)

  console.log(`Base: ${host} (${base})`)
  console.log(`Corte: se conservan las órdenes con fecha de OC desde el ${corte}; se borran las anteriores.`)
  console.log(aplicar ? '⚠ MODO APLICAR: se va a borrar.\n' : 'Modo simulación: no se borra nada (agrega --aplicar para borrar).\n')

  // Órdenes a borrar: fecha de OC anterior al corte (sin fecha de OC: se usa la fecha de entrega)
  const borrar = await sql`
    SELECT o.*, o.fecha_orden::text AS fecha_orden_txt FROM cen_ordenes o
    WHERE COALESCE(o.fecha_orden, o.fecha_entrega) < ${corte}::date
    ORDER BY o.fecha_orden, o.id`
  const [conservar] = await sql`SELECT COUNT(*)::int AS n FROM cen_ordenes WHERE COALESCE(fecha_orden, fecha_entrega) >= ${corte}::date`
  const porEstado = {}; for (const o of borrar) porEstado[o.estado] = (porEstado[o.estado] ?? 0) + 1
  const porCadena = {}; for (const o of borrar) porCadena[o.ean_comprador] = (porCadena[o.ean_comprador] ?? 0) + 1
  const ids = borrar.map(o => o.id)
  const lineas = ids.length ? await sql`SELECT * FROM cen_orden_lineas WHERE orden_id = ANY(${ids}) ORDER BY orden_id, nro_linea` : []
  const lineaIds = lineas.map(l => l.id)
  const reparto = lineaIds.length ? await sql`SELECT * FROM cen_orden_distribucion WHERE linea_id = ANY(${lineaIds})` : []

  console.log(`Se borran: ${borrar.length} órdenes, ${lineas.length} líneas y ${reparto.length} registros de reparto.`)
  console.log(`Se conservan: ${conservar.n} órdenes (fecha de OC desde el ${corte}).`)
  console.log('Órdenes a borrar por estado:', porEstado)
  console.log('Órdenes a borrar por cadena (EAN comprador):', porCadena)
  if (borrar.length) console.log(`Rango de fechas de OC a borrar: ${borrar[0].fecha_orden_txt} a ${borrar[borrar.length - 1].fecha_orden_txt}`)

  const enviadas = borrar.filter(o => o.estado === 'enviado')
  if (enviadas.length) {
    console.error(`\n❌ Hay ${enviadas.length} orden(es) anteriores al corte con pedido en Siesa (${enviadas.map(o => `${o.numero_orden} → ${o.siesa_consecutivo}`).join(', ')}). No se borra nada: revísalas primero.`)
    process.exit(1)
  }
  if (!aplicar || !borrar.length) { console.log(borrar.length ? '\nSimulación terminada. Para borrar, repite con --aplicar.' : '\nNo hay nada que borrar.'); return }

  // Respaldo antes de borrar
  const dir = path.join(__dirname, '..', 'muestras-cen')
  fs.mkdirSync(dir, { recursive: true })
  const archivo = path.join(dir, `respaldo-corte-ordenes-edi-${base.toLowerCase()}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(archivo, JSON.stringify({ base: host, corte, fecha: new Date().toISOString(), ordenes: borrar, lineas, reparto }, null, 1))
  console.log(`\n💾 Respaldo: ${archivo}`)

  // Borrado en una transacción (líneas y reparto se borran en cascada con la orden)
  const [r] = await sql.transaction([
    sql`DELETE FROM cen_ordenes WHERE id = ANY(${ids}) AND estado <> 'enviado' RETURNING id`,
  ])
  const [despues] = await sql`SELECT COUNT(*)::int AS n, MIN(fecha_orden)::text AS desde FROM cen_ordenes`
  console.log(`✅ Borradas ${r.length} órdenes. Quedan ${despues.n}, con fecha de OC desde ${despues.desde}.`)
}
main().catch(e => { console.error(e); process.exit(1) })
