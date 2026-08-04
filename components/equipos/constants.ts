export const TIPOS_EQUIPO = [
  'Computador Desktop','Laptop','Servidor','All-in-One','Switch','Router','Access Point','Firewall',
  'Monitor/Pantalla','Impresora Láser B/N','Impresora Láser Color','Impresora Multifuncional',
  'Impresora Inyección','Impresora Térmica','Impresora Etiquetas','Plotter','UPS/Regulador',
  'Tablet','Teléfono IP','Cámara IP/CCTV','NAS','Proyector','Escáner','Terminal POS',
  'Lector de Código de Barras','Otro',
]

export const ESTADOS_EQUIPO = ['Activo','Mantenimiento','Obsoleto','Baja']

export const ESTADOS_COLOR: Record<string, { color: string; bg: string }> = {
  'Activo':        { color: '#065f46', bg: '#d1fae5' },
  'Mantenimiento': { color: '#92400e', bg: '#fef3c7' },
  'Obsoleto':      { color: '#991b1b', bg: '#fee2e2' },
  'Baja':          { color: '#374151', bg: '#f3f4f6' },
}

export const TIPOS_PC        = ['Computador Desktop','Laptop','Servidor','All-in-One','Tablet']
export const TIPOS_MONITOR   = ['Monitor/Pantalla']
export const TIPOS_IMPRESORA = ['Impresora Láser B/N','Impresora Láser Color','Impresora Multifuncional','Impresora Inyección','Impresora Térmica','Impresora Etiquetas','Plotter']
export const TIPOS_SOFTWARE  = ['Computador Desktop','Laptop','Servidor','All-in-One','Tablet']

export const CAMPOS_INICIAL: Record<string, string | boolean> = {
  tipo_equipo:'', placa_activo:'', marca:'', modelo:'', numero_serie:'',
  procesador:'', nucleos_procesador:'', velocidad_procesador:'', ram_capacidad:'', ram_tipo:'',
  disco_tipo:'', disco_capacidad:'', disco_secundario:'', unidad_optica:'', camara_integrada: false, tarjeta_video:'', fuente_poder:'',
  monitor_marca:'', monitor_modelo:'', monitor_serial:'', monitor_pulgadas:'', monitor_resolucion:'', monitor_tipo_panel:'',
  impresora_tipo:'', toner_referencia:'', toner_rendimiento:'', toner_ultimo_cambio:'', toner_proximo_cambio:'', impresora_en_red: false,
  ip_asignada:'', mascara_subred:'', gateway:'', dns_primario:'', mac_address:'', tipo_conexion:'', hostname:'', dominio:'',
  ip_asignada_2:'', mascara_subred_2:'', gateway_2:'', dns_primario_2:'', mac_address_2:'', tipo_conexion_2:'',
  sistema_operativo:'', version_so:'', licencia_so:'', office_version:'', licencia_office:'',
  antivirus:'', version_antivirus:'', licencia_antivirus:'', software_adicional:'',
  sede:'', area_ubicacion:'', responsable:'', cargo_responsable:'', ext_telefonica:'',
  estado:'Activo', condicion_fisica:'', forma_adquisicion:'', fecha_adquisicion:'', valor_adquisicion:'',
  proveedor:'', tipo_garantia:'', fecha_inicio_garantia:'', fecha_fin_garantia:'', en_garantia: false, contrato_numero:'',
  tipo_mantenimiento:'', frecuencia_mantenimiento:'', ultimo_mantenimiento:'', proximo_mantenimiento:'',
  tecnico_responsable:'', observaciones:'',
}
