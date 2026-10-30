// Depuración de fotos de pagos QR de más de 60 días (lib/depurarFotos.ts).
//
// La base de desarrollo es una copia de producción: sus pagos apuntan a fotos
// REALES de Drive. Por eso aquí la depuración solo SIMULA (sin DEPURAR_FOTOS=activo
// el servidor nunca borra) y la marca de "foto depurada" se pone a mano en pagos
// de prueba. Necesita PRUEBAS_CRON_SECRET, igual que tareas-programadas.test.ts.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { BASE, sql, ids, crearUsuarios, borrarUsuarios, loginWeb, pedir } from './entorno.ts'

const SECRETO = process.env.PRUEBAS_CRON_SECRET
const omitir = !SECRETO && 'falta PRUEBAS_CRON_SECRET'
// Id de Drive inexistente: aunque algo fallara, no corresponde a ninguna foto real
const FOTO_FALSA = 'https://drive.google.com/uc?export=view&id=PRUEBA_DEPURAR_NO_EXISTE_0000'
let viejo = 0, reciente = 0

function tarea(ruta: string, conClave = true) {
  return fetch(`${BASE}${ruta}`, { headers: { 'User-Agent': 'vercel-cron/1.0', ...(conClave ? { Authorization: `Bearer ${SECRETO}` } : {}) } })
}

before(async () => {
  if (omitir) return
  await crearUsuarios()
  const crear = (dias: number) => sql`
    INSERT INTO pvn_pagos_qr (usuario_id, usuario_nombre, fecha, valor, foto_url, created_at)
    VALUES (${ids.pvn}, 'Prueba pvn', (NOW() - make_interval(days => ${dias}))::date, 1000, ${FOTO_FALSA}, NOW() - make_interval(days => ${dias}))
    RETURNING id`
  ;[{ id: viejo }] = await crear(70)
  ;[{ id: reciente }] = await crear(5)
})
after(async () => {
  if (omitir) return
  await borrarUsuarios() // borra también los pagos de los usuarios it_*
})

test('sin la clave del cron responde 401', { skip: omitir }, async () => {
  assert.equal((await tarea('/api/tareas/depurar-fotos', false)).status, 401)
})

test('sin DEPURAR_FOTOS=activo solo simula: cuenta las fotos viejas y no marca nada', { skip: omitir }, async () => {
  const r = await tarea('/api/tareas/depurar-fotos')
  assert.equal(r.status, 200)
  const d = await r.json() as { simulacion: boolean; candidatas: number; enPapelera: number }
  assert.equal(d.simulacion, true, 'en desarrollo nunca debe borrar')
  assert.ok(d.candidatas >= 1, 'el pago de 70 días es candidato')
  assert.equal(d.enPapelera, 0)
  const [p] = await sql`SELECT foto_eliminada_en FROM pvn_pagos_qr WHERE id = ${viejo}`
  assert.equal(p.foto_eliminada_en, null)
})

test('un pago con la foto depurada se sigue listando, pero sin foto', { skip: omitir }, async () => {
  await sql`UPDATE pvn_pagos_qr SET foto_eliminada_en = NOW() WHERE id = ${viejo}`
  const desde = new Date(Date.now() - 80 * 86400_000).toISOString().slice(0, 10)
  const hasta = new Date().toISOString().slice(0, 10)
  const r = await pedir(await loginWeb('pagos'), 'GET', `/api/qr/pagos?desde=${desde}&hasta=${hasta}&usuario_id=${ids.pvn}`)
  assert.equal(r.status, 200)
  const lista = r.datos as { id: number; foto_url: string | null }[]
  const v = lista.find(p => p.id === viejo)
  const n = lista.find(p => p.id === reciente)
  assert.ok(v, 'el pago depurado sigue apareciendo')
  assert.equal(v!.foto_url, null)
  assert.match(String(n?.foto_url), /\/api\/qr\/foto\?id=/, 'el reciente conserva su foto')
})
