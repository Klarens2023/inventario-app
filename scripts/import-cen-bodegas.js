#!/usr/bin/env node
/**
 * Carga la bodega de cada sucursal (cen_puntos_ean.bodega) desde un Excel con columnas
 * NIT, Sucursal y Bodega (en la primera hoja; los encabezados se buscan por nombre).
 * Solo actualiza sucursales que ya existen en cen_puntos_ean. Se puede correr varias veces.
 * Uso: node --env-file=.env.local scripts/import-cen-bodegas.js "C:\ruta\bodegas.xlsx"
 */
const { neon } = require('@neondatabase/serverless')
const ExcelJS = require('exceljs')

const texto = (v) => (v === null || v === undefined ? '' : String(typeof v === 'object' && 'result' in v ? v.result ?? '' : v).trim())

async function main() {
  const archivo = process.argv[2]
  if (!process.env.DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  if (!archivo) { console.error('❌ Falta la ruta del Excel (columnas NIT, Sucursal, Bodega)'); process.exit(1) }
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(archivo)
  const ws = wb.worksheets[0]
  const enc = Array.from(ws.getRow(1).values, v => texto(v).toLowerCase())
  const col = (re) => enc.findIndex(h => re.test(h))
  const cNit = col(/^(nit|c[oó]digo|cliente)/), cSuc = col(/^sucursal/), cBod = col(/^bodega/)
  if ([cNit, cSuc, cBod].some(c => c < 1)) { console.error('❌ No se encontraron las columnas NIT, Sucursal y Bodega'); process.exit(1) }

  const sql = neon(process.env.DATABASE_URL)
  let ok = 0, noExiste = 0
  const filas = []
  ws.eachRow((row, n) => { if (n > 1) filas.push(row) })
  for (const row of filas) {
    const nit = texto(row.getCell(cNit).value).replace(/\D/g, '')
    let suc = texto(row.getCell(cSuc).value); if (/^\d+$/.test(suc)) suc = suc.padStart(3, '0')
    let bod = texto(row.getCell(cBod).value); if (/^\d+$/.test(bod)) bod = bod.padStart(5, '0')
    if (!nit || !suc || !bod) continue
    const r = await sql`UPDATE cen_puntos_ean SET bodega = ${bod.slice(0, 5)}, updated_at = NOW() WHERE nit = ${nit} AND sucursal = ${suc} RETURNING ean`
    if (r.length) ok++; else noExiste++
  }
  console.log(`✅ ${ok} sucursales con bodega · ${noExiste} filas sin sucursal en cen_puntos_ean`)
}
main().catch(e => { console.error(e); process.exit(1) })
