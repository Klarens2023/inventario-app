#!/usr/bin/env node
/**
 * Carga la dirección y la ciudad de las sucursales de los clientes de Siesa en
 * cen_sucursales_siesa, desde un Excel con una fila por sucursal. Se puede correr
 * cada vez que se actualice la base: reemplaza los datos de las sucursales que trae.
 *
 * Columnas (la primera fila son los encabezados; se reconocen por el inicio del nombre,
 * sin importar mayúsculas ni tildes):
 *   NIT (o "Código")    obligatoria
 *   Sucursal            obligatoria (ej. 1, 01 o 001)
 *   Razón social        opcional (también "Descripción" o "Nombre")
 *   Dirección           opcional
 *   Ciudad              opcional
 *   Departamento        opcional (también "Depto")
 *
 * Uso: node --env-file=.env.local scripts/import-cen-sucursales-siesa.js "C:\ruta\sucursales.xlsx"
 *      Agregar --simular para ver qué cargaría sin escribir en la base.
 */
const { neon } = require('@neondatabase/serverless')
const ExcelJS = require('exceljs')

const texto = (v) => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') {
    if ('result' in v) return String(v.result ?? '').trim()                       // fórmula
    if ('richText' in v) return v.richText.map(t => t.text).join('').trim()         // texto con formato
    if ('text' in v) return String(v.text ?? '').trim()                             // hipervínculo
  }
  return String(v).trim()
}
const normal = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

async function main() {
  const archivo = process.argv[2]
  const simular = process.argv.includes('--simular')
  if (!process.env.DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  if (!archivo) { console.error('❌ Falta la ruta del Excel de sucursales'); process.exit(1) }

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(archivo)
  const ws = wb.worksheets[0]
  const encabezados = Array.from(ws.getRow(1).values, v => normal(texto(v)))
  const col = (...nombres) => encabezados.findIndex(h => h && nombres.some(n => h.startsWith(n)))
  const c = {
    nit: col('nit', 'codigo'), sucursal: col('sucursal', 'suc'), razon: col('razon', 'descripcion', 'nombre'),
    direccion: col('direccion'), ciudad: col('ciudad'), depto: col('departamento', 'depto'),
  }
  if (c.nit < 1 || c.sucursal < 1) { console.error('❌ El Excel debe tener las columnas NIT y Sucursal en la primera fila'); process.exit(1) }

  const filas = new Map()
  let descartadas = 0
  ws.eachRow((row, n) => {
    if (n === 1) return
    const val = (i) => (i > 0 ? texto(row.getCell(i).value) : '')
    const nit = val(c.nit).replace(/\D/g, '').slice(0, 15)
    const sucTxt = val(c.sucursal)
    const sucursal = /^\d+$/.test(sucTxt) ? sucTxt.padStart(3, '0') : sucTxt.toUpperCase()
    if (!nit || !sucursal || sucursal.length > 3) { descartadas++; return }
    filas.set(`${nit}|${sucursal}`, {
      nit, sucursal,
      razon: val(c.razon).slice(0, 120) || null,
      direccion: val(c.direccion).slice(0, 200) || null,
      ciudad: val(c.ciudad).slice(0, 80) || null,
      depto: val(c.depto).slice(0, 80) || null,
    })
  })
  const sql = neon(process.env.DATABASE_URL)
  const extra = (process.argv.find(a => a.startsWith('--nits=')) ?? '').slice(7).split(',').map(n => n.replace(/\D/g, '')).filter(Boolean)
  const clientesEdi = new Set([...extra, ...(await sql`
    SELECT nit FROM cen_ordenes WHERE nit IS NOT NULL
    UNION SELECT nit FROM cen_puntos_ean WHERE nit IS NOT NULL
    UNION SELECT nit FROM cen_config_clientes`).map(r => r.nit)])
  const todas = [...filas.values()]
  const lista = todas.filter(f => clientesEdi.has(f.nit))
  console.log(`Sucursales en el archivo: ${todas.length} (sin NIT o sucursal válidos: ${descartadas})`)
  console.log(`De clientes de órdenes EDI (${clientesEdi.size} NIT): ${lista.length}`)
  console.log(`Con dirección: ${lista.filter(f => f.direccion).length} · con ciudad: ${lista.filter(f => f.ciudad).length}`)
  const porNit = lista.reduce((m, f) => m.set(f.nit, (m.get(f.nit) ?? 0) + 1), new Map())
  console.log('Por NIT:', Object.fromEntries(porNit))
  if (simular) { console.log('Simulación: no se escribió nada. Ejemplo:', lista.slice(0, 2)); return }

  // De a 500 filas por sentencia
  for (let i = 0; i < lista.length; i += 500) {
    const lote = lista.slice(i, i + 500)
    await sql`
      INSERT INTO cen_sucursales_siesa (nit, sucursal, razon_social, direccion, ciudad, departamento)
      SELECT * FROM unnest(${lote.map(f => f.nit)}::text[], ${lote.map(f => f.sucursal)}::text[], ${lote.map(f => f.razon)}::text[],
                           ${lote.map(f => f.direccion)}::text[], ${lote.map(f => f.ciudad)}::text[], ${lote.map(f => f.depto)}::text[])
      ON CONFLICT (nit, sucursal) DO UPDATE SET razon_social = EXCLUDED.razon_social, direccion = EXCLUDED.direccion,
        ciudad = EXCLUDED.ciudad, departamento = EXCLUDED.departamento, actualizado_at = NOW()`
  }
  console.log(`✅ ${lista.length} sucursales cargadas en cen_sucursales_siesa`)
}
main().catch(e => { console.error(e); process.exit(1) })
