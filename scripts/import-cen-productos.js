#!/usr/bin/env node
/**
 * Carga (o actualiza) cen_productos desde la hoja "BASE PRODUCTOS Y CEDES" del
 * libro de logística (BD 2026.xlsx): EAN del ítem, código Siesa, descripción,
 * peso unitario (kg), unidades por caja y peso del embalaje. Se usa para
 * calcular el peso de cada orden EDI.
 *
 * Se puede correr varias veces (actualiza por EAN).
 * Uso: node --env-file=.env.local scripts/import-cen-productos.js "C:\ruta\BD 2026.xlsx"
 */

const { neon } = require('@neondatabase/serverless')
const ExcelJS = require('exceljs')

const HOJA = 'BASE PRODUCTOS Y CEDES'
// Columnas de la hoja: Q=EAN del Ítem, R=ITEM, S=Descripción, T=PESO, U=UNIDADES POR CAJA, V=PESO EMBALAJE
const COL = { ean: 17, item: 18, descripcion: 19, peso: 20, undCaja: 21, pesoEmbalaje: 22 }

const texto = (v) => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object' && 'result' in v) return String(v.result ?? '').trim()
  if (typeof v === 'object' && 'text' in v) return String(v.text ?? '').trim()
  return String(v).trim()
}
const numero = (v) => { const n = Number(texto(v).replace(',', '.')); return Number.isFinite(n) ? n : null }

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL
  const archivo = process.argv[2]
  if (!DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  if (!archivo) { console.error('❌ Falta la ruta de BD 2026.xlsx'); process.exit(1) }

  // El libro pesa ~10 MB: se lee en modo streaming y solo la hoja de productos.
  const productos = new Map()
  const lector = new ExcelJS.stream.xlsx.WorkbookReader(archivo, { sharedStrings: 'cache', worksheets: 'emit' })
  for await (const hoja of lector) {
    if (hoja.name !== HOJA) continue
    for await (const fila of hoja) {
      if (fila.number === 1) continue
      const ean = texto(fila.getCell(COL.ean).value).replace(/\.0$/, '')
      if (!/^\d{8,14}$/.test(ean)) continue
      productos.set(ean, {
        ean,
        item: texto(fila.getCell(COL.item).value).replace(/\.0$/, ''),
        descripcion: texto(fila.getCell(COL.descripcion).value).replace(/\s+/g, ' ').slice(0, 200),
        peso: numero(fila.getCell(COL.peso).value) ?? 0,
        undCaja: Math.round(numero(fila.getCell(COL.undCaja).value) ?? 0) || null,
        pesoEmbalaje: numero(fila.getCell(COL.pesoEmbalaje).value),
      })
    }
  }
  if (productos.size === 0) { console.error(`❌ No se encontraron productos en la hoja "${HOJA}"`); process.exit(1) }

  const sql = neon(DATABASE_URL)
  for (const p of productos.values()) {
    await sql`
      INSERT INTO cen_productos (ean, item, descripcion, peso_kg, und_caja, peso_embalaje)
      VALUES (${p.ean}, ${p.item}, ${p.descripcion}, ${p.peso}, ${p.undCaja}, ${p.pesoEmbalaje})
      ON CONFLICT (ean) DO UPDATE
        SET item = EXCLUDED.item, descripcion = EXCLUDED.descripcion, peso_kg = EXCLUDED.peso_kg,
            und_caja = EXCLUDED.und_caja, peso_embalaje = EXCLUDED.peso_embalaje, updated_at = NOW()
    `
  }
  console.log(`✅ ${productos.size} productos cargados en cen_productos`)
}

main().catch(e => { console.error(e); process.exit(1) })
