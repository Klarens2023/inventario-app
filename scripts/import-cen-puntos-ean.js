#!/usr/bin/env node
/**
 * Carga (o actualiza) cen_puntos_ean desde el Excel de Puntos de Envío que se
 * exporta en Contabilidad > Generación de Planos > Puntos de Envío. Solo toma
 * las filas que tienen Código EAN; usa NIT, sucursal, descripción (razón
 * social de la sucursal) y EAN.
 *
 * Se puede correr varias veces: si el NIT+sucursal ya existe, actualiza su
 * razón social y EAN.
 *
 * Uso: DATABASE_URL="..." node scripts/import-cen-puntos-ean.js "C:\ruta\PUNTOS_ENVIO.xlsx"
 */

const { neon } = require('@neondatabase/serverless')
const ExcelJS = require('exceljs')

const texto = (v) => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object' && 'result' in v) return String(v.result ?? '').trim()
  if (typeof v === 'object' && 'text' in v) return String(v.text ?? '').trim()
  return String(v).trim()
}

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL
  const archivo = process.argv[2]
  if (!DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  if (!archivo) { console.error('❌ Falta la ruta del Excel de Puntos de Envío'); process.exit(1) }

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(archivo)
  const ws = wb.worksheets[0]

  // Columnas de la plantilla de Puntos de Envío: B=cliente, C=sucursal, E=descripción, T=EAN
  const filas = []
  ws.eachRow((row, n) => {
    if (n === 1) return
    const ean = texto(row.getCell(20).value)
    if (!ean) return
    const sucursal = texto(row.getCell(3).value)
    filas.push({
      nit: texto(row.getCell(2).value),
      sucursal: /^\d+$/.test(sucursal) ? sucursal.padStart(3, '0') : sucursal,
      razonSocial: texto(row.getCell(5).value),
      ean,
    })
  })

  const repetidos = filas.filter((f, i) => filas.findIndex(o => o.ean === f.ean) !== i)
  if (repetidos.length) {
    console.error('❌ EAN repetidos en el Excel (cada EAN debe ser de una sola sucursal):', repetidos.map(r => r.ean).join(', '))
    process.exit(1)
  }

  const sql = neon(DATABASE_URL)
  for (const f of filas) {
    await sql`
      INSERT INTO cen_puntos_ean (nit, sucursal, razon_social, ean)
      VALUES (${f.nit}, ${f.sucursal}, ${f.razonSocial}, ${f.ean})
      ON CONFLICT (ean) DO UPDATE
        SET nit = EXCLUDED.nit, sucursal = EXCLUDED.sucursal, razon_social = EXCLUDED.razon_social, updated_at = NOW()
    `
  }

  console.log(`✅ ${filas.length} puntos con EAN cargados en cen_puntos_ean`)
}

main().catch(e => { console.error(e); process.exit(1) })
