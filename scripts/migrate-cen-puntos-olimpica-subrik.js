#!/usr/bin/env node
/**
 * Puntos de entrega de Olímpica (NIT 890107487) desde el listado de ubicaciones de Subrik
 * ("ubicaciones_olimpica.csv": GLN + dirección de entrega con el número de tienda, ej. "STO 066").
 * Cada GLN se asoció a la sucursal de Siesa con el mismo número de tienda, y solo cuando la dirección de
 * Subrik coincide con la de la base de clientes de Siesa. 48 puntos: nuevos + 1 corrección
 * (SAO 53 Portal del Prado estaba en la 378, dirección de oficinas; es la 364 "STO 053").
 * Las órdenes abiertas de esos EAN quedan asociadas; las ya enviadas a Siesa no se tocan.
 * Uso: node --env-file=.env.local scripts/migrate-cen-puntos-olimpica-subrik.js
 */
const { neon } = require('@neondatabase/serverless')

const NIT = '890107487'
const PUNTOS = [
  { ean: '7701008000018', sucursal: '364', razon: "STO 053 - BARRANQUILLA", ciudad: "Barranquilla", dirSubrik: "Cl 53 46-38-SAO 53 PORTAL DEL PRADO", antes: '378' },
  { ean: '7701008000667', sucursal: '131', razon: "STO 066 - BARRANQUILLA", ciudad: "Barranquilla", dirSubrik: "CC JARDIN DEL RIO CL 114 42C-3-STO 066 JARDIN DEL RIO" },
  { ean: '7701008001305', sucursal: '279', razon: "STO 130 - CALI", ciudad: "Cali", dirSubrik: "Cl 18 A 56-65-STO 130 GUADALUPE" },
  { ean: '7701008001350', sucursal: '278', razon: "STO 135 - CALI", ciudad: "Cali", dirSubrik: "Cra 46 48-40-STO 135 CAÑAVERAL" },
  { ean: '7701008001404', sucursal: '079', razon: "STO 140 - CALI", ciudad: "Cali", dirSubrik: "Av 3 NORTE 57-100-STO 140 AV. TERCERA NORTE" },
  { ean: '7701008001800', sucursal: '260', razon: "STO 180 - CALI", ciudad: "Cali", dirSubrik: "CC CERRITOS MALL L 101 VI KM 6-STO 180 CERRITOS MALL" },
  { ean: '7701008002180', sucursal: '397', razon: "STO 218 - PIVIJAY", ciudad: "Pivijay", dirSubrik: "Cl 11 12-02-STO 218 PIVIJAY" },
  { ean: '7701008002807', sucursal: '176', razon: "STO 280 - DOSQUEBRADAS", ciudad: "Dosquebradas", dirSubrik: "Via Frailes Urb Montebonito-STO 280 MONTEBONITO" },
  { ean: '7701008003125', sucursal: '412', razon: "STO 312 - APARTADÓ", ciudad: "Apartadó", dirSubrik: "CC Nuestro Urabá-SAO 312 APARTADÓ" },
  { ean: '7701008003347', sucursal: '357', razon: "STO 334 - RIONEGRO", ciudad: "Rionegro", dirSubrik: "Cr 45 52-27-STO 334 RIONEGRO 2" },
  { ean: '7701008003378', sucursal: '267', razon: "STO 337 - MEDELLÍN", ciudad: "Medellín", dirSubrik: "Cl 63 128-53-STO 337 SAN CRISTOBAL" },
  { ean: '7701008003415', sucursal: '363', razon: "STO 341 - MEDELLÍN", ciudad: "Medellín", dirSubrik: "Cl 57 47-40-STO 341 VILLANUEVA" },
  { ean: '7701008003484', sucursal: '369', razon: "STO 348 - ENVIGADO", ciudad: "Envigado", dirSubrik: "Cr 40 37SUR-30-STO 348 ENVIGADO" },
  { ean: '7701008003507', sucursal: '109', razon: "STO 350 - PEREIRA", ciudad: "Pereira", dirSubrik: "Cl 83 19-24-STO 350 GAMA" },
  { ean: '7701008003538', sucursal: '212', razon: "STO 353 - SANTA ROSA DE CABAL", ciudad: "Santa Rosa De Cabal", dirSubrik: "Cl 15 11-40-STO 353 SANTA ROSA" },
  { ean: '7701008003583', sucursal: '114', razon: "STO 358 - ARMENIA", ciudad: "Armenia", dirSubrik: "Cl 19 NORTE 13-9 13-9-SAO 358 PORTAL QUINDIO" },
  { ean: '7701008003644', sucursal: '116', razon: "STO 364 - MANIZALES", ciudad: "Manizales", dirSubrik: "Cl 50 23-1 23-1-STO 364 AV SANTANDER" },
  { ean: '7701008003668', sucursal: '117', razon: "STO 366 - ARMENIA", ciudad: "Armenia", dirSubrik: "Cl 30 40-80-SAO 366 ARMENIA SUR" },
  { ean: '7701008003682', sucursal: '199', razon: "STO 368 - CHINCHINÁ", ciudad: "Chinchiná", dirSubrik: "Cl 10 7-41 7-41-STO 368 CHINCHINÁ" },
  { ean: '7701008003699', sucursal: '185', razon: "STO 369 - PEREIRA", ciudad: "Pereira", dirSubrik: "Ciudadela Altavista-STO 369 ALTAVISTA" },
  { ean: '7701008003750', sucursal: '198', razon: "STO 375 - ROLDANILLO", ciudad: "Roldanillo", dirSubrik: "Cl 9 6-35-STO 375 ROLDANILLO" },
  { ean: '7701008003767', sucursal: '118', razon: "STO 376 - MANIZALES", ciudad: "Manizales", dirSubrik: "Av Kevin Angel CC Mall Plaza C-SAO 376 MANIZALES MALL PLAZA" },
  { ean: '7701008003880', sucursal: '258', razon: "STO 388 - BOGOTÁ, D.C.", ciudad: "Bogotá", dirSubrik: "Cl 24 04-05-STO 388 PUERTO BOYACÁ" },
  { ean: '7701008003996', sucursal: '296', razon: "STO 399 - LA DORADA", ciudad: "La Dorada", dirSubrik: "Cl 17 3-04-STO 399 LA DORADA CALDAS" },
  { ean: '7701008004290', sucursal: '057', razon: "STO 429 - BOGOTÁ, D.C.", ciudad: "Bogotá", dirSubrik: "Cl 16 SUR 16-43-STO 429 RESTREPO" },
  { ean: '7701008005532', sucursal: '276', razon: "STO 553 - GUADALAJARA DE BUGA", ciudad: "Guadalajara De Buga", dirSubrik: "Cl 7 11-93-STO 553 BUGA" },
  { ean: '7701008005549', sucursal: '083', razon: "STO 554 - TULUÁ", ciudad: "Tuluá", dirSubrik: "Cr 20 Cls 26y27-STO 554 TULUA" },
  { ean: '7701008005570', sucursal: '277', razon: "STO 557 - BUENAVENTURA", ciudad: "Buenaventura", dirSubrik: "Cl 2 A 1 A-08-STO 557 BUENAVENTURA" },
  { ean: '7701008005587', sucursal: '219', razon: "STO 558 - SEVILLA", ciudad: "Sevilla", dirSubrik: "Cr 50 49-47-STO 558 SEVILLA" },
  { ean: '7701008005600', sucursal: '228', razon: "STO 560 - ZARZAL", ciudad: "Zarzal", dirSubrik: "Cr 11 9-30-STO 560 ZARZAL" },
  { ean: '7701008005617', sucursal: '200', razon: "STO 561 - QUIMBAYA", ciudad: "Quimbaya", dirSubrik: "Cr 6 15-26-STO 561 QUIMBAYA" },
  { ean: '7701008005624', sucursal: '235', razon: "STO 562 - MONTENEGRO", ciudad: "Montenegro", dirSubrik: "Cr 6 17-30-STO 562 MONTENEGRO" },
  { ean: '7701008005631', sucursal: '301', razon: "STO 563 - CALARCÁ", ciudad: "Calarcá", dirSubrik: "Cr 27 37-20-STO 563 CALARCA" },
  { ean: '7701008005709', sucursal: '085', razon: "STO 570 - CALI", ciudad: "Cali", dirSubrik: "Cra 1D 62-04-STO 570 BARRANQUILLA" },
  { ean: '7701008005778', sucursal: '088', razon: "STO 577 - TULUÁ", ciudad: "Tuluá", dirSubrik: "Cr 22 14A-15-STO 577 LA CAMPIÑA" },
  { ean: '7701008005792', sucursal: '089', razon: "STO 579 - PALMIRA", ciudad: "Palmira", dirSubrik: "Cl 42 27-24-STO 579 PALMIRA" },
  { ean: '7701008005808', sucursal: '106', razon: "STO 580 - POPAYÁN", ciudad: "Popayán", dirSubrik: "Av PANAMERICANA 24 A Norte-STO 580 POPAYAN NORTE" },
  { ean: '7701008005815', sucursal: '105', razon: "STO 581 - POPAYÁN", ciudad: "Popayán", dirSubrik: "Cl 2N 7-74-SAO 581 POPAYAN CENTRAL" },
  { ean: '7701008005853', sucursal: '178', razon: "STO 585 - PALMIRA", ciudad: "Palmira", dirSubrik: "Cl 47 33-01-SAO 585 MARDEN 47" },
  { ean: '7701008005860', sucursal: '175', razon: "STO 586 - PALMIRA", ciudad: "Palmira", dirSubrik: "Cr 1 Tv 32 Este-SAO 586 MARDEN BOSQUE" },
  { ean: '7701008006799', sucursal: '107', razon: "STO 679 - QUIBDÓ", ciudad: "Quibdó", dirSubrik: "CC EL CARAÑO CL 30 Av Aeropuer-SAO 679 QUIBDÓ" },
  { ean: '7701008006812', sucursal: '413', razon: "STO 681 - BOGOTÁ, D.C.", ciudad: "Bogotá", dirSubrik: "Cl 19 24-04-STO 681 ESTADIO" },
  { ean: '7701008007857', sucursal: '304', razon: "SUPERTIENDAS Y DROGUERIAS OLIMPICA SA", ciudad: "Santa Ana", dirSubrik: "Cl 11 8-78-STO 785 SANTA ANA" },
  { ean: '7701008103511', sucursal: '110', razon: "STO 351 - PEREIRA", ciudad: "Pereira", dirSubrik: "Av 30 DE AGOSTO 36-10-STO 351 PEREIRA" },
  { ean: '7701008103528', sucursal: '111', razon: "STO 352 - DOSQUEBRADAS", ciudad: "Dosquebradas", dirSubrik: "Cr 16 36-98-STO 352 DOS QUEBRADAS" },
  { ean: '7701008103818', sucursal: '319', razon: "STO 381 - ESPINAL", ciudad: "Espinal", dirSubrik: "Cr 7A 10-69-STO 381 ESPINAL" },
  { ean: '7701008104211', sucursal: '222', razon: "STO 421 - GIRARDOT", ciudad: "Girardot", dirSubrik: "Cl 14 9 Esq-SAO 421 GIRARDOT" },
  { ean: '7701008105737', sucursal: '086', razon: "STO 573 - CALI", ciudad: "Cali", dirSubrik: "Cr 25 6-120-STO 573 LOS CRISTALES" },
]

async function main() {
  if (!process.env.DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  const sql = neon(process.env.DATABASE_URL)
  let nuevos = 0, corregidos = 0, ordenes = 0
  for (const p of PUNTOS) {
    const [actual] = await sql`SELECT nit, sucursal FROM cen_puntos_ean WHERE ean = ${p.ean}`
    if (actual && actual.nit === NIT && actual.sucursal === p.sucursal) continue
    if (actual && !p.antes) { console.log(`  ⚠ ${p.ean} ya está en ${actual.nit}/${actual.sucursal}: no se cambia`); continue }
    await sql`
      INSERT INTO cen_puntos_ean (nit, sucursal, razon_social, ean, ciudad, bodega)
      VALUES (${NIT}, ${p.sucursal}, ${p.razon}, ${p.ean}, ${p.ciudad}, '00110')
      ON CONFLICT (ean) DO UPDATE SET nit = EXCLUDED.nit, sucursal = EXCLUDED.sucursal, razon_social = EXCLUDED.razon_social,
        ciudad = EXCLUDED.ciudad, activo = TRUE, updated_at = NOW()
    `
    const o = await sql`
      UPDATE cen_ordenes SET nit = ${NIT}, sucursal = ${p.sucursal}, razon_social = ${p.razon},
             estado = CASE WHEN estado = 'sin_punto' THEN 'pendiente' ELSE estado END, updated_at = NOW()
      WHERE ean_entrega = ${p.ean} AND estado IN ('sin_punto', 'pendiente', 'error')
      RETURNING numero_orden
    `
    ordenes += o.length
    if (p.antes) { corregidos++; console.log(`  ✎ ${p.ean} ${p.antes} → ${p.sucursal} ${p.razon} (${o.length} orden(es))`) }
    else { nuevos++; if (o.length) console.log(`  ✓ ${p.ean} → ${p.sucursal} ${p.razon} (${o.length} orden(es): ${o.map(x => x.numero_orden).join(', ')})`) }
  }
  console.log(`✅ Olímpica: ${nuevos} EAN nuevos, ${corregidos} corregido(s), ${ordenes} orden(es) actualizada(s)`)
}
main().catch(e => { console.error(e); process.exit(1) })
