// Modelo de fila para el plano de Puntos de Envío (Siesa, registro 215 v04).
// Ver hoja "Punto de envio v4" de "Imp-UnoEE-Puntos de envio.xls".

export interface PuntoEnvioRow {
  reemplaza: boolean // F_ACTUALIZA_REG: 0=No, 1=Si (si el punto de envío ya existe)
  tercero: string // F215_ID_TERCERO - código del cliente
  sucursal: string // F215_ID_SUCURSAL
  codigo: string // F215_ID - código del punto de envío, debe ser diferente de 000
  descripcion: string // F215_DESCRIPCION
  vendedor: string // F215_ID_VENDEDOR
  contacto: string // F015_CONTACTO
  direccion1: string // F015_DIRECCION1
  direccion2: string // F015_DIRECCION2
  direccion3: string // F015_DIRECCION3
  pais: string // F015_ID_PAIS
  departamento: string // F015_ID_DEPTO
  ciudad: string // F015_ID_CIUDAD
  barrio: string // F015_ID_BARRIO
  telefono: string // F015_TELEFONO
  fax: string // F015_FAX
  codigoPostal: string // F015_COD_POSTAL
  email: string // F015_EMAIL
  parametroEdi: string // F015_ID_PARAMETRO_EDI
  codigoEan: string // F015_CODIGO_EAN
  activo: boolean // F215_IND_ESTADO: 1=Activo, 0=Inactivo
  criterioMayor: string // F215_ID_CRITERIO_MAYOR_CLI
  pedidoMinimo: number // F215_VLR_PEDIDO_MINIMO
  celular: string // F015_CELULAR
}

export interface PuntosEnvio {
  compania: string
  puntos: PuntoEnvioRow[]
}

export function puntosEnvioVacio(): PuntosEnvio {
  return { compania: '001', puntos: [] }
}

export function filaPuntoEnvioVacia(): PuntoEnvioRow {
  return {
    reemplaza: true,
    tercero: '',
    sucursal: '001',
    codigo: '',
    descripcion: '',
    vendedor: '',
    contacto: '',
    direccion1: '',
    direccion2: '',
    direccion3: '',
    pais: '169',
    departamento: '',
    ciudad: '',
    barrio: '',
    telefono: '',
    fax: '',
    codigoPostal: '',
    email: '',
    parametroEdi: '',
    codigoEan: '',
    activo: true,
    criterioMayor: '',
    pedidoMinimo: 0,
    celular: '',
  }
}
