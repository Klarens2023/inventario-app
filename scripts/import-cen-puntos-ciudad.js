#!/usr/bin/env node
/**
 * Completa ciudad y departamento de cen_puntos_ean desde la base de clientes de
 * Siesa (columnas Código, Sucursal, Ciudad, Depto/Estado), cruzando por NIT + sucursal.
 * Se puede correr varias veces.
 *
 * Uso: node --env-file=.env.local scripts/import-cen-puntos-ciudad.js "C:\ruta\base de datos clientes siesa.xlsx"
 */

const { neon } = require('@neondatabase/serverless')
const ExcelJS = require('exceljs')

const texto = (v) => (v === null || v === undefined ? '' : String(typeof v === 'object' && 'result' in v ? v.result ?? '' : v).trim())

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL
  const archivo = process.argv[2]
  if (!DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  if (!archivo) { console.error('❌ Falta la ruta de la base de clientes de Siesa'); process.exit(1) }

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(archivo)
  const ws = wb.worksheets[0]
  // values es un arreglo disperso (índice 0 vacío): Array.from rellena los huecos
  const encabezados = Array.from(ws.getRow(1).values, v => texto(v).toLowerCase())
  const col = (nombre) => encabezados.findIndex(h => h.startsWith(nombre))
  const cNit = col('código'), cSuc = col('sucursal'), cCiudad = col('ciudad'), cDepto = col('depto')
  if ([cNit, cSuc, cCiudad, cDepto].some(c => c < 1)) { console.error('❌ No se encontraron las columnas Código, Sucursal, Ciudad y Depto/Estado'); process.exit(1) }

  const filas = []
  ws.eachRow((row, n) => {
    if (n === 1) return
    const ciudad = texto(row.getCell(cCiudad).value)
    if (!ciudad) return
    filas.push({ nit: texto(row.getCell(cNit).value), sucursal: texto(row.getCell(cSuc).value), ciudad, depto: texto(row.getCell(cDepto).value) })
  })

  const sql = neon(DATABASE_URL)
  const puntos = await sql`SELECT nit, sucursal FROM cen_puntos_ean`
  const claves = new Set(puntos.map(p => `${p.nit}|${p.sucursal}`))
  let actualizados = 0
  for (const f of filas) {
    if (!claves.has(`${f.nit}|${f.sucursal}`)) continue
    await sql`UPDATE cen_puntos_ean SET ciudad = ${f.ciudad.slice(0, 60)}, departamento = ${f.depto.slice(0, 60)}, updated_at = NOW()
              WHERE nit = ${f.nit} AND sucursal = ${f.sucursal}`
    actualizados++
  }
  const [{ sin }] = await sql`SELECT COUNT(*)::int AS sin FROM cen_puntos_ean WHERE ciudad IS NULL`
  console.log(`✅ ${actualizados} puntos con ciudad · ${sin} sin ciudad (no están en la base de clientes)`)
}

main().catch(e => { console.error(e); process.exit(1) })
