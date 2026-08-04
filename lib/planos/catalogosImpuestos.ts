// Catálogos maestros para el plano de Impuestos y Retenciones (Siesa, registros
// 46/47/49/50). Códigos de clase tomados de las tablas reales "Clases de
// impuestos" y "Clases de retención" del sistema; llaves tomadas de los
// reportes "LLAVES DE IMPUESTOS" y "LLAVES DE RETENCION" exportados de Siesa
// para Lácteos del Cesar S.A.

export interface ClaseCatalogo {
  codigo: string // código numérico de la clase (F_ID_CLASE, sin padear)
  sigla: string // como se ve en Siesa (columna "Sigla")
  descripcion: string
}

export interface LlaveCatalogo {
  codigo: string // F_ID_LLAVE (sin padear)
  descripcion: string
}

export const CLASES_IMPUESTOS: ClaseCatalogo[] = [
  { codigo: '1', sigla: 'IVA', descripcion: 'IVA' },
  { codigo: '2', sigla: 'ICA', descripcion: 'ICA' },
  { codigo: '3', sigla: 'ICO', descripcion: 'IMPTO AL CONSUMO 8% DIAN' },
  { codigo: '4', sigla: 'ICD', descripcion: 'Imp Consumo Departamental Nominal Gober' },
  { codigo: '5', sigla: 'INC', descripcion: 'IMPTO AL CONSUMO 8%' },
  { codigo: '6', sigla: 'IC', descripcion: 'Impuesto al Consumo Departamental Nomina' },
  { codigo: '8', sigla: 'ICPorcen', descripcion: 'Impuesto al Consumo Departamental Porcen' },
  { codigo: '20', sigla: 'FtoHorCu', descripcion: 'Cuota de Fomento Hortifrutícula' },
  { codigo: '21', sigla: 'Timbre', descripcion: 'Impuesto de Timbre' },
  { codigo: '22', sigla: 'INCBolsa', descripcion: 'Impuesto Nacional al Consumo de Bolsa Pl' },
  { codigo: '23', sigla: 'INCarbon', descripcion: 'Impuesto Nacional del Carbono' },
  { codigo: '24', sigla: 'INCombus', descripcion: 'Impuesto Nacional a los Combustibles' },
  { codigo: '25', sigla: 'SobrComb', descripcion: 'Sobretasa a los combustibles' },
  { codigo: '26', sigla: 'Sordicom', descripcion: 'Contribución minoristas (Combustibles)' },
  { codigo: '30', sigla: 'ICDatos', descripcion: 'Impuesto al Consumo de Datos' },
  { codigo: '32', sigla: 'ICL', descripcion: 'Impuesto al Consumo de Licores' },
  { codigo: '33', sigla: 'INPP', descripcion: 'Impuesto Nacional Productos Plásticos' },
  { codigo: '34', sigla: 'IBUA', descripcion: 'Impto Bebidas Ultraprocesadas Azucaradas' },
  { codigo: '35', sigla: 'ICUI', descripcion: 'Impto Produc Comestibles Ultraprocesados' },
  { codigo: '36', sigla: 'ADV', descripcion: 'Impuesto AD-VALOREM' },
  { codigo: '38', sigla: 'OtrTribu', descripcion: 'Otros tributos, tasas, contribuciones, y' },
]

export const CLASES_RETENCIONES: ClaseCatalogo[] = [
  { codigo: '1', sigla: 'RENTA', descripcion: 'Retención de Renta' },
  { codigo: '2', sigla: 'IVA', descripcion: 'Retención de IVA' },
  { codigo: '3', sigla: 'ICA', descripcion: 'Retención de ICA' },
  { codigo: '8', sigla: 'OtrTribu', descripcion: 'Otros tributos, tasas, contribuciones, y' },
  { codigo: '10', sigla: 'RTBIENES', descripcion: 'Retención Bienes' },
  { codigo: '11', sigla: 'RTSERVIC', descripcion: 'Retención Servicios' },
  { codigo: '12', sigla: 'RTHONORA', descripcion: 'Retención Honorarios' },
  { codigo: '13', sigla: 'RTCOMISI', descripcion: 'Retención Comisiones' },
  { codigo: '14', sigla: 'RTFINANC', descripcion: 'Retención Financieros' },
  { codigo: '15', sigla: 'RTARREND', descripcion: 'Retención Arrendamiento' },
  { codigo: '16', sigla: 'RTSALARI', descripcion: 'Retencion Salarios' },
  { codigo: '17', sigla: 'RETNORES', descripcion: 'Retención de Renta No Residentes' },
  { codigo: '20', sigla: 'RTIVA1', descripcion: 'Retención de IVA' },
  { codigo: '21', sigla: 'RIVAGRAN', descripcion: 'Reteiva Gran Contribuyente' },
  { codigo: '22', sigla: 'RTIVA2', descripcion: 'Retencion de IVA NO DOMICILIADOS' },
  { codigo: '30', sigla: 'ICASER', descripcion: 'Retención de ICA Servicios' },
  { codigo: '31', sigla: 'ICACOMER', descripcion: 'Retención de ICA Comercial' },
  { codigo: '32', sigla: 'ICINDUST', descripcion: 'Retención de ICA Industrial' },
  { codigo: '40', sigla: 'AUTOR', descripcion: 'Auto Retención en Renta' },
  { codigo: '41', sigla: 'FEDEGAN', descripcion: 'Contribu Fedegan Fondo Fomento Ganadero' },
  { codigo: '42', sigla: 'ZOMAC', descripcion: 'Retención Zomac' },
]

// Llaves de impuestos (reporte "LLAVES DE IMPUESTOS" Siesa, Lácteos del Cesar S.A.)
export const LLAVES_IMPUESTOS: Record<string, LlaveCatalogo[]> = {
  IBUA: [{ codigo: '7', descripcion: 'IMPUESTO BEBIDAS AZUCARADAS IBUA' }],
  ICO: [{ codigo: '5', descripcion: 'IMPUESTO AL CONSUMO 8%' }],
  ICUI: [{ codigo: '8', descripcion: 'IMPUESTO COMESTIBLES ULTRAPROCESADO ICUI' }],
  INCBolsa: [{ codigo: '6', descripcion: 'IMPUESTO CONSUMO BOLSAS PLASTICA' }],
  IVA: [
    { codigo: '1', descripcion: 'IVA BIENES 19%' },
    { codigo: '2', descripcion: 'IVA SERVICIOS 19%' },
    { codigo: '3', descripcion: 'IVA BIENES 5%' },
    { codigo: '4', descripcion: 'IVA SERVICIOS 5%' },
    { codigo: '9', descripcion: 'IVA ARRENDAMIENTOS 19%' },
  ],
}

// Llaves de retención (reporte "LLAVES DE RETENCION" Siesa, Lácteos del Cesar S.A.)
export const LLAVES_RETENCIONES: Record<string, LlaveCatalogo[]> = {
  AUTOR: [{ codigo: '4001', descripcion: 'AUTORENTA 0.55%' }],
  FEDEGAN: [{ codigo: '4101', descripcion: 'RETENCION FEDEGAN 0.75%' }],
  ICACOMER: [
    { codigo: '3101', descripcion: 'ICA COMERCIAL 5X1000' },
    { codigo: '3102', descripcion: 'ICA COMERCIAL 6X1000' },
    { codigo: '3103', descripcion: 'ICA COMERCIAL 7X1000' },
    { codigo: '3104', descripcion: 'ICA COMERCIAL 10X1000' },
    { codigo: '3105', descripcion: 'ICA COMERCIAL 11.04X1000' },
  ],
  ICASER: [
    { codigo: '3001', descripcion: 'ICA SERVICIOS 3X1000' },
    { codigo: '3002', descripcion: 'ICA SERVICIOS 5X1000' },
    { codigo: '3003', descripcion: 'ICA SERVICIOS 6X1000' },
    { codigo: '3004', descripcion: 'ICA SERVICIOS 7X1000' },
    { codigo: '3005', descripcion: 'ICA SERVICIOS 8X1000' },
    { codigo: '3006', descripcion: 'ICA SERVICIOS 10X1000' },
    { codigo: '3007', descripcion: 'ICA SERVICIOS 5X1000 TRANSPORTE HATO' },
  ],
  ICINDUST: [
    { codigo: '3201', descripcion: 'ICA INDUSTRIAL 5X1000 VTA' },
    { codigo: '3202', descripcion: 'ICA INDUSTRIAL 5X1000 VTA SIN BASE' },
  ],
  RENTA: [{ codigo: '1203', descripcion: 'RENTAS TRABAJO INDEPENDIENTES ART 383 ET' }],
  RETNORES: [{ codigo: '1104', descripcion: 'SERV Y CONSUL NO RESIDENTE 20%' }],
  RIVAGRAN: [{ codigo: '2002', descripcion: 'RETEIVA GRAN CONTRIBUYENTE' }],
  RTARREND: [
    { codigo: '1501', descripcion: 'ARRENDAMIENTO BIEN INMUEBLE 3.5%' },
    { codigo: '1502', descripcion: 'ARRENDAMIENTO BIENES MUEBLES 4%' },
  ],
  RTBIENES: [
    { codigo: '1001', descripcion: 'BIENES 2.5%' },
    { codigo: '1002', descripcion: 'BIENES 3.5%' },
    { codigo: '1003', descripcion: 'BIENES O PRODUCTOS AGRICOLAS 1.5%' },
    { codigo: '1004', descripcion: 'COMPRA ACTIVOS FIJOS 2.5%' },
    { codigo: '1006', descripcion: 'BIENES COMBUSTIBLES 0.1%' },
    { codigo: '4201', descripcion: 'ZOMAC- LECHE 0.75%' },
    { codigo: '4202', descripcion: 'ZOMAC 1.25%' },
  ],
  RTCOMISI: [
    { codigo: '1301', descripcion: 'COMISIONES 10%' },
    { codigo: '1302', descripcion: 'COMISIONES 11%' },
  ],
  RTFINANC: [
    { codigo: '1401', descripcion: 'RENDIMIENTO FINANCIERO 4% CDT' },
    { codigo: '1402', descripcion: 'RENDIMIENTO FINANCIERO 7% CDT' },
  ],
  RTHONORA: [
    { codigo: '1201', descripcion: 'HONORARIOS 10%' },
    { codigo: '1202', descripcion: 'HONORARIOS 11%' },
  ],
  RTIVA1: [{ codigo: '2001', descripcion: 'RETEIVA 15% COMPRA BIENES REG. SIMPLE' }],
  RTIVA2: [{ codigo: '2003', descripcion: 'RETEIVA 100% A NO DOMICILIADOS' }],
  RTSERVIC: [
    { codigo: '1007', descripcion: 'SERVICIOS TEMPORALES 2% AIU NO<10%CONTRA' },
    { codigo: '1101', descripcion: 'SERVICIOS 4%' },
    { codigo: '1102', descripcion: 'SERVICIOS 6%' },
    { codigo: '1103', descripcion: 'SERVICIOS LICEN. SOFTWARE 3.5%' },
    { codigo: '1105', descripcion: 'SERVICIOS INTEGRALES IPS 2%' },
    { codigo: '1106', descripcion: 'SERVICIOS CONTRATOS CONSTRUCCION 2%' },
    { codigo: '1107', descripcion: 'SERVICIOS 1%' },
    { codigo: '1108', descripcion: 'SERVICIOS 3.5%' },
  ],
}

export type TipoTercero = 'cliente' | 'proveedor'
export type Concepto = 'impuesto' | 'retencion'

// F_TIPO_REG según la combinación cliente/proveedor + impuesto/retención.
export function tipoRegistro(tipo: TipoTercero, concepto: Concepto): number {
  if (tipo === 'cliente') return concepto === 'impuesto' ? 46 : 47
  return concepto === 'impuesto' ? 49 : 50
}

export function catalogoClases(concepto: Concepto): ClaseCatalogo[] {
  return concepto === 'impuesto' ? CLASES_IMPUESTOS : CLASES_RETENCIONES
}

export function catalogoLlaves(concepto: Concepto): Record<string, LlaveCatalogo[]> {
  return concepto === 'impuesto' ? LLAVES_IMPUESTOS : LLAVES_RETENCIONES
}

export function buscarClasePorSigla(concepto: Concepto, sigla: string): ClaseCatalogo | undefined {
  const s = sigla.trim().toLowerCase()
  return catalogoClases(concepto).find((c) => c.sigla.toLowerCase() === s)
}

export function buscarLlave(concepto: Concepto, sigla: string, codigoLlave: string): LlaveCatalogo | undefined {
  const llaves = catalogoLlaves(concepto)[sigla.trim()] ?? []
  const codigo = codigoLlave.trim().replace(/^0+(?=\d)/, '')
  return llaves.find((l) => l.codigo.replace(/^0+(?=\d)/, '') === codigo)
}
