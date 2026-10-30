#!/usr/bin/env node
/**
 * Puntos de entrega desde el maestro de localizaciones de CEN (archivos "Localizaciones_<cadena>_CO_2026-10-30"):
 * GLN de CEN asociado a la sucursal de Siesa solo cuando la dirección de CEN coincide con la de la base de
 * clientes de Siesa, hay un único candidato y, en Olímpica, además el número de tienda (STO nnn) es el mismo.
 *   - Olímpica: 89 sucursales de Siesa que no tenían EAN.
 *   - Éxito: CEDI Bucaramanga (014), CEDI Eje Cafetero (016) y CEDI Calima (015), con órdenes por revisar.
 * Solo agrega EAN (no cambia los que ya existen); asocia las órdenes abiertas de esos EAN.
 * Uso: node --env-file=.env.local scripts/migrate-cen-puntos-maestro-cen.js
 */
const { neon } = require('@neondatabase/serverless')

const PUNTOS = [
  { ean: '7701001001104', nit: '890900608', sucursal: '014', razon: "ALMACENES EXITO S A CEDI BUCARAMANGA", ciudad: "Bucaramanga", cen: "149 CEDI BUCARAMANGA | Cra 17 No 59-51 via palenque - Chimita" },
  { ean: '7701001013800', nit: '890900608', sucursal: '016', razon: "ALMACENES EXITO S A CEDI EJE CAFETERO", ciudad: "Pereira", cen: "138 - CEDI EJE CAFETERO | Predio la Gitana Km 0 costado derecho vía Cerritos La Virginia" },
  { ean: '7701001113500', nit: '890900608', sucursal: '015', razon: "ALMACENES EXITO S A CEDI CALIMA", ciudad: "Cali", cen: "35-055 - CEDI CALIMA | Cra. 5N # 55N - 24" },
  { ean: '7701008105140', nit: '890107487', sucursal: '002', razon: "STO 514 - BARRANQUILLA", ciudad: "Barranquilla", cen: "SDO 514 Cl 73 24 HORAS | Kra 41 D # 73 - 17" },
  { ean: '7701008105157', nit: '890107487', sucursal: '004', razon: "STO 515 - BARRANQUILLA", ciudad: "Barranquilla", cen: "SDO 515 TORCOROMA | Calle 84 # 51 B 22" },
  { ean: '7701008005280', nit: '890107487', sucursal: '005', razon: "STO 528 - BARRANQUILLA", ciudad: "Barranquilla", cen: "SDO 528 FRENTE SAO 93 | Calle 93 Kra 46  Esq." },
  { ean: '7701008105164', nit: '890107487', sucursal: '006', razon: "STO 516 - BARRANQUILLA", ciudad: "Barranquilla", cen: "STO 516 CORDIALIDAD Cr 16 | Calle 47 # 14 - 189" },
  { ean: '7701008105034', nit: '890107487', sucursal: '009', razon: "STO 503 - BARRANQUILLA", ciudad: "Barranquilla", cen: "STO 503 S BOLIVAR | Calle 19 # 4 -132" },
  { ean: '7701008104136', nit: '890107487', sucursal: '044', razon: "STO 413 - BOGOTÁ, D.C.", ciudad: "Bogotá", cen: "STO 413 PLAZA MAYOR CHIA | AV PRADILLA 5 31 ESTE" },
  { ean: '7701008100244', nit: '890107487', sucursal: '069', razon: "STO 024 - BARRANQUILLA", ciudad: "Barranquilla", cen: "STO 024 LAS NIEVES | Calle 24 Kra 12 Esq" },
  { ean: '7701008100206', nit: '890107487', sucursal: '070', razon: "STO 020 - BARRANQUILLA", ciudad: "Barranquilla", cen: "STO 020 MERCADO 20 DE JULIO | KRA 43 # 32-56" },
  { ean: '7701008001398', nit: '890107487', sucursal: '078', razon: "STO 139 - CALI", ciudad: "Cali", cen: "STO 139 LA BASE | Carrera 8 No  58 - 100" },
  { ean: '7701008105683', nit: '890107487', sucursal: '084', razon: "STO 568 - CALI", ciudad: "Cali", cen: "STO 568 GUAYAQUIL | Calle 15  Kra 18 y 19" },
  { ean: '7701008105768', nit: '890107487', sucursal: '087', razon: "STO 576 - CALI", ciudad: "Cali", cen: "STO 576 PASO ANCHO | Calle 13 # 75 A - 85" },
  { ean: '7701008005884', nit: '890107487', sucursal: '090', razon: "STO 588 - CALI", ciudad: "Cali", cen: "STO 588 LAS GRANJAS | Cll 16 No 43 - 45" },
  { ean: '7701008005891', nit: '890107487', sucursal: '091', razon: "STO 589 - CALI", ciudad: "Cali", cen: "STO 589 LOS LAGOS | Cll 72U No 26I - 03" },
  { ean: '7701008005914', nit: '890107487', sucursal: '092', razon: "STO 591 - CALI", ciudad: "Cali", cen: "STO 591 ALAMEDA 2 | CL 8 # 26 - 39" },
  { ean: '7701008005938', nit: '890107487', sucursal: '093', razon: "STO 593 - CALI", ciudad: "Cali", cen: "STO 593 EL POBLADO | Calle 28 D # 72T - 72" },
  { ean: '7701008005945', nit: '890107487', sucursal: '094', razon: "STO 594 - CALI", ciudad: "Cali", cen: "STO 594 LAS GRANJAS 2 | Calle 16 # 49-08" },
  { ean: '7701008005952', nit: '890107487', sucursal: '101', razon: "STO 595 - CALI", ciudad: "Cali", cen: "STO 595 PRIMAVERA | CRA 32 # 34-08 SUR" },
  { ean: '7701008001381', nit: '890107487', sucursal: '108', razon: "STO 138 - CARTAGO", ciudad: "Cartago", cen: "SAO 138 SANTIAGO PLAZA | Calle 14 No. 11 ? 19" },
  { ean: '7701008103610', nit: '890107487', sucursal: '115', razon: "STO 361 - MANIZALES", ciudad: "Manizales", cen: "STO 361 MANIZALES CENTRO | Kra 21 # 17 - 35" },
  { ean: '7701008100183', nit: '890107487', sucursal: '122', razon: "STO 018 - SOLEDAD", ciudad: "Soledad", cen: "STO 018 SOLEDAD | Cra. 22 #18-15" },
  { ean: '7701008004467', nit: '890107487', sucursal: '127', razon: "STO 446 - BOGOTÁ, D.C.", ciudad: "Bogotá", cen: "SDO 446 CALLE 67 | Calle 67 No. 10-22" },
  { ean: '7701008000261', nit: '890107487', sucursal: '128', razon: "STO 026 - SOLEDAD", ciudad: "Soledad", cen: "STO 026 SOLEDAD C.C. | CL 26 18 26 LOCAL 1" },
  { ean: '7701008003989', nit: '890107487', sucursal: '132', razon: "STO 398 - CAMPOALEGRE", ciudad: "Campoalegre", cen: "STO 398 CAMPOALEGRE | Cr 8 17-31" },
  { ean: '7701008000698', nit: '890107487', sucursal: '134', razon: "STO 069 - BARRANQUILLA", ciudad: "Barranquilla", cen: "STO 069 REBOLO | Cl 17 No 25-39" },
  { ean: '7701008000872', nit: '890107487', sucursal: '136', razon: "STO 087 - BARRANQUILLA", ciudad: "Barranquilla", cen: "STO 087 EVARISTO SOURDIS | Cl 87 No 9G-15" },
  { ean: '7701008000759', nit: '890107487', sucursal: '137', razon: "STO 075 - BARRANQUILLA", ciudad: "Barranquilla", cen: "STO 075 AMERICANO | Cr 38 NO 76-41-51" },
  { ean: '7701008000889', nit: '890107487', sucursal: '138', razon: "STO 088 - BARRANQUILLA", ciudad: "Barranquilla", cen: "STO 088 LA REDONDA | Cr 2 No 88-91" },
  { ean: '7701008004566', nit: '890107487', sucursal: '147', razon: "STO 456 - BOGOTÁ, D.C.", ciudad: "Bogotá", cen: "STO 456 AV. CHILE | CL 72 N 13-85" },
  { ean: '7701008000704', nit: '890107487', sucursal: '162', razon: "STO 070 - BARRANQUILLA", ciudad: "Barranquilla", cen: "STO 070 CUC | Cl 59 No 54-187" },
  { ean: '7701008000551', nit: '890107487', sucursal: '163', razon: "STO 055 - BARRANQUILLA", ciudad: "Barranquilla", cen: "STO 055 LA PRADERA | Cl 110 12F-29" },
  { ean: '7701008000643', nit: '890107487', sucursal: '164', razon: "STO 064 - SOLEDAD", ciudad: "Soledad", cen: "STO 064 LA CENTRAL | Cl 65??4-151" },
  { ean: '7701008000575', nit: '890107487', sucursal: '167', razon: "STO 057 - SOLEDAD", ciudad: "Soledad", cen: "STO 057 VILLA ADELA | CL 47 6D-21" },
  { ean: '7701008000452', nit: '890107487', sucursal: '171', razon: "STO 045 - BARRANQUILLA", ciudad: "Barranquilla", cen: "STO 045 CIUDADELA | Calle 45 Cra 2 - 09" },
  { ean: '7701008100305', nit: '890107487', sucursal: '173', razon: "STO 030 - BARRANQUILLA", ciudad: "Barranquilla", cen: "STO 030 MERCADO Cl 30 | KRA 43 # 30-24" },
  { ean: '7701008006911', nit: '890107487', sucursal: '177', razon: "STO 691 - CALI", ciudad: "Cali", cen: "STO 691 PRADOS DEL NORTE | URB P DEL PARQUE AV 2G 36N-15" },
  { ean: '7701008006874', nit: '890107487', sucursal: '179', razon: "STO 687 - POPAYÁN", ciudad: "Popayán", cen: "STO 687 MONSERRAT | TV 9 LC8y9 No 56N 30" },
  { ean: '7701008003705', nit: '890107487', sucursal: '184', razon: "STO 370 - LA UNIÓN", ciudad: "La Unión", cen: "STO 370 LA UNION | Calle 15 No. 13-35" },
  { ean: '7701008000278', nit: '890107487', sucursal: '186', razon: "STO 027 - BARRANQUILLA", ciudad: "Barranquilla", cen: "STO 027 LOS OLIVOS Cr 27 | Cra. 27 Calle 101" },
  { ean: '7701008000070', nit: '890107487', sucursal: '187', razon: "STO 007 - MALAMBO", ciudad: "Malambo", cen: "STO 007 MALAMBO | Calle 12 Cra.1B" },
  { ean: '7701008000896', nit: '890107487', sucursal: '195', razon: "STO 089 - SOLEDAD", ciudad: "Soledad", cen: "STO 089 CIUDAD DEL PUERTO | CIUDAD DEL PUERTO Cr 19 No41-20" },
  { ean: '7701008105751', nit: '890107487', sucursal: '201', razon: "STO 575 - CAICEDONIA", ciudad: "Caicedonia", cen: "STO 575 CAICEDONIA II | Calle 12 No. 15-17" },
  { ean: '7701008003743', nit: '890107487', sucursal: '203', razon: "STO 374 - CARTAGO", ciudad: "Cartago", cen: "STO 374 CARTAGO 3 | TRANSVERSAL 7 14-135 CAFETERO" },
  { ean: '7701008005563', nit: '890107487', sucursal: '204', razon: "STO 556 - CARTAGO", ciudad: "Cartago", cen: "STO 556 CARTAGO 2 | CALLE 16 CRA. 4" },
  { ean: '7701008003545', nit: '890107487', sucursal: '213', razon: "STO 354 - LA VIRGINIA", ciudad: "La Virginia", cen: "STO 354 VIRGINIA | Cra 7A # 6-26 La Virginia" },
  { ean: '7701008001282', nit: '890107487', sucursal: '218', razon: "STO 128 - TURBACO", ciudad: "Turbaco", cen: "STO 128 TURBACO PLAZA 90 | CC PLAZA 90 CL 27 Cr 30 LC-01" },
  { ean: '7701008103917', nit: '890107487', sucursal: '223', razon: "STO 391 - SOGAMOSO", ciudad: "Sogamoso", cen: "STO 391 SOGAMOSO | Cra 13#14-30 y 26 L101-2" },
  { ean: '7701008003651', nit: '890107487', sucursal: '226', razon: "STO 365 - MANIZALES", ciudad: "Manizales", cen: "STO 365 VILLA MARIA | Calle 5 # 8 -20" },
  { ean: '7701008005556', nit: '890107487', sucursal: '227', razon: "STO 555 - CARTAGO", ciudad: "Cartago", cen: "STO 555 CARTAGO 1 | CALLE 10 NO. 6 - 85" },
  { ean: '7701008003590', nit: '890107487', sucursal: '231', razon: "STO 359 - ARMENIA", ciudad: "Armenia", cen: "STO 359 EL BOSQUE | Cra 22 # 22-14" },
  { ean: '7701008008922', nit: '890107487', sucursal: '238', razon: "STO 892 - MONTERÍA", ciudad: "Montería", cen: "SDO 892 MONTERIA | KR 2 # 36-65" },
  { ean: '7701008008960', nit: '890107487', sucursal: '240', razon: "STO 896 - NECOCLÍ", ciudad: "Necoclí", cen: "STO896 NECOCLI | CALLE 50 No 43-12" },
  { ean: '7701008108950', nit: '890107487', sucursal: '241', razon: "STO 895 - MONTERÍA", ciudad: "Montería", cen: "SDO 895 Cl 16 MONTERIA | CL 16 # 7A - 14 LA CHARME" },
  { ean: '7701008105263', nit: '890107487', sucursal: '242', razon: "STO 526 - BARRANQUILLA", ciudad: "Barranquilla", cen: "SDO 526 GRAN CENTRO | Calle 70 # 53-11" },
  { ean: '7701008000148', nit: '890107487', sucursal: '259', razon: "STO 014 - BARRANQUILLA", ciudad: "Barranquilla", cen: "STO 014 7 DE ABRIL | Calle 51b # 2ASUR-05" },
  { ean: '7701008003569', nit: '890107487', sucursal: '261', razon: "STO 356 - PEREIRA", ciudad: "Pereira", cen: "STO 356 PLAZA DE LA LIBERTAD | CL 14 # 8-34" },
  { ean: '7701008006966', nit: '890107487', sucursal: '268', razon: "STO 696 - MOSQUERA", ciudad: "Mosquera", cen: "STO 696 MOSQUERA | CRA 3 # 17 Sur 96" },
  { ean: '7701008004825', nit: '890107487', sucursal: '269', razon: "STO 482 - CHÍA", ciudad: "Chía", cen: "SDO 482 CHIA | Cra 11 No. 11-69" },
  { ean: '7701008001367', nit: '890107487', sucursal: '280', razon: "STO 136 - CALI", ciudad: "Cali", cen: "STO 136 SALOMIA | Carrera 3° No. 52 ? 28" },
  { ean: '7701008001374', nit: '890107487', sucursal: '281', razon: "STO 137 - CALI", ciudad: "Cali", cen: "STO 137 VILLACOLOMBIA | Calle 51 No. 14 ? 12" },
  { ean: '7701008005488', nit: '890107487', sucursal: '282', razon: "STO 548 - BUENAVENTURA", ciudad: "Buenaventura", cen: "SAO 548 BUENAVENTURA 2 Cr 46 | Cra. 46 Calle 1" },
  { ean: '7701008000254', nit: '890107487', sucursal: '286', razon: "STO 025 - SOLEDAD", ciudad: "Soledad", cen: "STO 025 LOS MANGOS | Calle 25 No. 37b-10" },
  { ean: '7701008000421', nit: '890107487', sucursal: '287', razon: "STO 042 - BARRANQUILLA", ciudad: "Barranquilla", cen: "STO 042 UNIVERSAL Cr 4 | Calle 41B Cra. 4 Esquina" },
  { ean: '7701008004559', nit: '890107487', sucursal: '289', razon: "STO 455 - BOGOTÁ, D.C.", ciudad: "Bogotá", cen: "STO 455 VENECIA | DIAGONAL 46 SUR N 51-52" },
  { ean: '7701008103627', nit: '890107487', sucursal: '293', razon: "STO 362 - MANIZALES", ciudad: "Manizales", cen: "SDO 362 MANIZALES | cra 23 # 59 - 70 Local 13" },
  { ean: '7701008000711', nit: '890107487', sucursal: '307', razon: "STO 071 - SOLEDAD", ciudad: "Soledad", cen: "STO 071 LOS CUSULES | Cl 61C No 10C-07" },
  { ean: '7701008005693', nit: '890107487', sucursal: '310', razon: "STO 569 - CALI", ciudad: "Cali", cen: "STO 569 ACACIAS | Autop Suroriental -Clle23" },
  { ean: '7701008000520', nit: '890107487', sucursal: '311', razon: "STO 052 - BARRANQUILLA", ciudad: "Barranquilla", cen: "SDO 052 TORRES DEL METRO | Calle 53 # 52-68 L1" },
  { ean: '7701008001213', nit: '890107487', sucursal: '317', razon: "STO 121 - CARTAGENA DE INDIAS", ciudad: "Cartagena De Indias", cen: "STO 121 OLAYA PLAZA | Cl 32B 32-150" },
  { ean: '7701008006430', nit: '890107487', sucursal: '339', razon: "STO 643 - CÚCUTA", ciudad: "Cúcuta", cen: "STO 643 PRADOS | Av 5B  42526" },
  { ean: '7701008000155', nit: '890107487', sucursal: '346', razon: "STO 015 - BARRANQUILLA", ciudad: "Barranquilla", cen: "STO 015 LA PAZ | CL 108? 12F-18" },
  { ean: '7701008000353', nit: '890107487', sucursal: '347', razon: "STO 035 - MALAMBO", ciudad: "Malambo", cen: "STO 035 EL CONCORD | Cr 27  15A-31" },
  { ean: '7701008000346', nit: '890107487', sucursal: '349', razon: "STO 034 - PALMAR DE VARELA", ciudad: "Palmar De Varela", cen: "STO 034 PALMAR DE VARELA | Cl 11  6-35" },
  { ean: '7701008003859', nit: '890107487', sucursal: '351', razon: "STO 385 - PITALITO", ciudad: "Pitalito", cen: "STO 385 POPULAR JARDIN | Av 3 # 13-22" },
  { ean: '7701008003354', nit: '890107487', sucursal: '358', razon: "STO 335 - LA CEJA", ciudad: "La Ceja", cen: "STO 335 LA CEJA | Calle 20 # 21-46" },
  { ean: '7701008003361', nit: '890107487', sucursal: '359', razon: "STO 336 - COPACABANA", ciudad: "Copacabana", cen: "STO 336 COPACABANA | Cra. 52 # 50-88" },
  { ean: '7701008003392', nit: '890107487', sucursal: '361', razon: "STO 339 - MEDELLÍN", ciudad: "Medellín", cen: "STO 339 LA FLORESTA | Calle 87 # 47DD-75" },
  { ean: '7701008003477', nit: '890107487', sucursal: '368', razon: "STO 347 - RIONEGRO", ciudad: "Rionegro", cen: "STO 347 RIONEGRO | CRA 47 # 52-20" },
  { ean: '7701008003866', nit: '890107487', sucursal: '375', razon: "STO 386 - PITALITO", ciudad: "Pitalito", cen: "STO 386 POPULAR CENTRO | Cra. 2 # 1-70" },
  { ean: '7701008000582', nit: '890107487', sucursal: '385', razon: "STO 058 - BARRANQUILLA", ciudad: "Barranquilla", cen: "SDO 058 CATALUNYA | Cl 84 CC PLAZA CATALUNYA??57-62 L11" },
  { ean: '7701008002203', nit: '890107487', sucursal: '386', razon: "STO 220 - SANTA MARTA", ciudad: "Santa Marta", cen: "STO 220 GRAN BAZAR | Cl 22 CC GRAN BAZAR??4L LA-01" },
  { ean: '7701008000506', nit: '890107487', sucursal: '398', razon: "STO 050 - SOLEDAD", ciudad: "Soledad", cen: "STO 050 MANUELA BELTRAN Cr 15A | Cr 15A 30-150" },
  { ean: '7701008000803', nit: '890107487', sucursal: '402', razon: "STO 080 - BARRANQUILLA", ciudad: "Barranquilla", cen: "STO 080 GRANADILLO | Cr 43 80-123" },
  { ean: '7701008001251', nit: '890107487', sucursal: '408', razon: "STO 125 - CARTAGENA DE INDIAS", ciudad: "Cartagena De Indias", cen: "STO 125 ZARAGOCILLA | Dg 30 55B-30" },
  { ean: '7701008007994', nit: '890107487', sucursal: '410', razon: "STO 799 - MAGANGUÉ", ciudad: "Magangué", cen: "STO 799 MAGANGUE | Cl 15 6-135" },
  { ean: '7701008000568', nit: '890107487', sucursal: '415', razon: "STO 056 - BARRANQUILLA", ciudad: "Barranquilla", cen: "STO 056 BUENA ESPERANZA | Cl 63  15-25" },
  { ean: '7701008003170', nit: '890107487', sucursal: '423', razon: "STO 317 - TURBO", ciudad: "Turbo", cen: "STO 317 TURBO | CRA 13 101-170" },
  { ean: '7701008001329', nit: '890107487', sucursal: '425', razon: "STO 132 - CALI", ciudad: "Cali", cen: "STO 132 PORVENIR | Carrera 5 No. 31A ? 31" },
  { ean: '7701008001336', nit: '890107487', sucursal: '426', razon: "STO 133 - CALI", ciudad: "Cali", cen: "STO 133 LA QUINTA | Carrera 5A No. 59 ? 141" },
  { ean: '7701008001343', nit: '890107487', sucursal: '427', razon: "STO 134 - CALI", ciudad: "Cali", cen: "STO 134 LA 26 | Calle 44 No. 26 ? 05" },
]

async function main() {
  if (!process.env.DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  const sql = neon(process.env.DATABASE_URL)
  let nuevos = 0, ordenes = 0
  for (const p of PUNTOS) {
    const [actual] = await sql`SELECT nit, sucursal FROM cen_puntos_ean WHERE ean = ${p.ean}`
    if (actual) { if (actual.nit !== p.nit || actual.sucursal !== p.sucursal) console.log(`  ⚠ ${p.ean} ya está en ${actual.nit}/${actual.sucursal}: no se cambia`); continue }
    await sql`
      INSERT INTO cen_puntos_ean (nit, sucursal, razon_social, ean, ciudad, bodega)
      VALUES (${p.nit}, ${p.sucursal}, ${p.razon}, ${p.ean}, ${p.ciudad}, '00110')
    `
    nuevos++
    const o = await sql`
      UPDATE cen_ordenes SET nit = ${p.nit}, sucursal = ${p.sucursal}, razon_social = ${p.razon},
             estado = CASE WHEN estado = 'sin_punto' THEN 'pendiente' ELSE estado END, updated_at = NOW()
      WHERE ean_entrega = ${p.ean} AND nit IS NULL AND estado IN ('sin_punto', 'pendiente', 'error')
      RETURNING numero_orden
    `
    ordenes += o.length
    if (o.length) console.log(`  ✓ ${p.ean} → ${p.nit}/${p.sucursal} ${p.razon} (${o.length} orden(es): ${o.map(x => x.numero_orden).join(', ')})`)
  }
  console.log(`✅ Maestro CEN: ${nuevos} EAN nuevos, ${ordenes} orden(es) asociada(s)`)
}
main().catch(e => { console.error(e); process.exit(1) })
