// Tareas programadas: sincronización EDI registrada (cen_sincronizaciones) y
// disparador de workflows de GitHub (/api/tareas/disparar).
//
// Necesita la app corriendo con un CRON_SECRET de prueba y SIN credenciales de
// SFTP ni Siesa (para no conectarse a Carvajal/Subrik reales), y ese mismo
// valor en PRUEBAS_CRON_SECRET. Sin PRUEBAS_CRON_SECRET, estas pruebas se saltan.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { BASE, sql, crearUsuarios, borrarUsuarios, loginWeb, pedir } from './entorno.ts'

const SECRETO = process.env.PRUEBAS_CRON_SECRET
const omitir = !SECRETO && 'falta PRUEBAS_CRON_SECRET'
// Registros creados por esta prueba: los de id mayor al último que había al empezar
let ultimoId = 0

/** Llamada como tarea programada, con el agente que se indique. */
function programada(ruta: string, agente: string, conClave = true) {
  return fetch(`${BASE}${ruta}`, { headers: { 'User-Agent': agente, ...(conClave ? { Authorization: `Bearer ${SECRETO}` } : {}) } })
}

before(async () => {
  if (omitir) return
  await crearUsuarios()
  ;[{ ultimoId }] = await sql`SELECT COALESCE(MAX(id), 0)::int AS "ultimoId" FROM cen_sincronizaciones`
})
after(async () => {
  if (omitir) return
  await sql`DELETE FROM cen_sincronizaciones WHERE id > ${ultimoId}`
  await borrarUsuarios()
})

test('sin la clave del cron, las rutas programadas responden 401', { skip: omitir }, async () => {
  assert.equal((await programada('/api/logistica/ordenes-cen/sincronizar', 'vercel-cron/1.0', false)).status, 401)
  assert.equal((await programada('/api/tareas/disparar?workflow=respaldo', 'vercel-cron/1.0', false)).status, 401)
})

test('cada sincronización queda registrada con su origen (Vercel, GitHub o manual)', { skip: omitir }, async () => {
  assert.equal((await programada('/api/logistica/ordenes-cen/sincronizar', 'vercel-cron/1.0')).status, 200)
  assert.equal((await programada('/api/logistica/ordenes-cen/sincronizar', 'curl/8.5.0')).status, 200)
  const manual = await pedir(await loginWeb('inventario'), 'POST', '/api/logistica/ordenes-cen/sincronizar')
  assert.equal(manual.status, 200)

  const filas = await sql`SELECT origen, ok, usuario FROM cen_sincronizaciones WHERE id > ${ultimoId} ORDER BY id`
  assert.deepEqual(filas.map(f => f.origen), ['vercel-cron', 'github', 'manual'])
  assert.ok(filas.every(f => f.ok), 'sin fuentes configuradas, todas terminan bien')
  assert.equal(filas[2].usuario, 'Prueba inventario')
})

test('la pantalla lee las últimas sincronizaciones solo con el módulo de órdenes EDI', { skip: omitir }, async () => {
  const con = await pedir(await loginWeb('inventario'), 'GET', '/api/logistica/ordenes-cen/sincronizaciones')
  assert.equal(con.status, 200)
  assert.ok(Array.isArray(con.datos) && (con.datos as unknown[]).length >= 3)
  const sin = await pedir(await loginWeb('sinModulos'), 'GET', '/api/logistica/ordenes-cen/sincronizaciones')
  assert.equal(sin.status, 403)
})

test('disparador de workflows: solo los de la lista y sin token responde 503', { skip: omitir }, async () => {
  assert.equal((await programada('/api/tareas/disparar?workflow=borrar-todo', 'vercel-cron/1.0')).status, 400)
  // Localmente no hay GITHUB_DISPATCH_TOKEN: no se lanza nada en GitHub
  assert.equal((await programada('/api/tareas/disparar?workflow=respaldo', 'vercel-cron/1.0')).status, 503)
})
