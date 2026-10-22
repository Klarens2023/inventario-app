-- ════════════════════════════════════════════════════════════════════════
-- Esquema real de la base, generado por scripts/exportar-esquema.js
-- Fecha: 2026-10-22 · No editar a mano: volver a exportar.
-- Recrea la estructura (sin datos) en una base vacía, en este orden:
-- secuencias → tablas → restricciones → llaves foráneas → índices → vistas.
-- ════════════════════════════════════════════════════════════════════════

CREATE SEQUENCE IF NOT EXISTS areas_id_seq;
CREATE SEQUENCE IF NOT EXISTS audit_logs_id_seq;
CREATE SEQUENCE IF NOT EXISTS cen_archivos_id_seq;
CREATE SEQUENCE IF NOT EXISTS cen_orden_distribucion_id_seq;
CREATE SEQUENCE IF NOT EXISTS cen_orden_lineas_id_seq;
CREATE SEQUENCE IF NOT EXISTS cen_ordenes_id_seq;
CREATE SEQUENCE IF NOT EXISTS cen_puntos_ean_id_seq;
CREATE SEQUENCE IF NOT EXISTS cen_reglas_ruta_id_seq;
CREATE SEQUENCE IF NOT EXISTS equipos_cambios_componentes_id_seq;
CREATE SEQUENCE IF NOT EXISTS equipos_incidencias_id_seq;
CREATE SEQUENCE IF NOT EXISTS equipos_mantenimientos_id_seq;
CREATE SEQUENCE IF NOT EXISTS inventario_conteos_id_seq;
CREATE SEQUENCE IF NOT EXISTS inventario_datos_id_seq;
CREATE SEQUENCE IF NOT EXISTS pvn_componentes_id_seq;
CREATE SEQUENCE IF NOT EXISTS pvn_pagos_qr_id_seq;
CREATE SEQUENCE IF NOT EXISTS pvn_puntos_venta_id_seq;
CREATE SEQUENCE IF NOT EXISTS pvn_registros_detalle_id_seq;
CREATE SEQUENCE IF NOT EXISTS pvn_registros_id_seq;
CREATE SEQUENCE IF NOT EXISTS pvn_transferencias_bancarias_id_seq;
CREATE SEQUENCE IF NOT EXISTS pvn_turnos_id_seq;
CREATE SEQUENCE IF NOT EXISTS tic_articulo_asignaciones_id_seq;
CREATE SEQUENCE IF NOT EXISTS tic_articulo_movimientos_id_seq;
CREATE SEQUENCE IF NOT EXISTS tic_movimiento_activos_id_seq;
CREATE SEQUENCE IF NOT EXISTS usuarios_id_seq;

CREATE TABLE IF NOT EXISTS areas (
  id integer DEFAULT nextval('areas_id_seq'::regclass) NOT NULL,
  key character varying(50) NOT NULL,
  label character varying(100) NOT NULL,
  color character varying(20) NOT NULL,
  bg character varying(20) NOT NULL,
  roles_permitidos text[] DEFAULT '{}'::text[] NOT NULL,
  modulos_usuario text[] DEFAULT '{}'::text[] NOT NULL,
  modulos_lider text[] DEFAULT '{}'::text[] NOT NULL,
  protegida boolean DEFAULT false NOT NULL,
  created_at timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id integer DEFAULT nextval('audit_logs_id_seq'::regclass) NOT NULL,
  usuario_id integer,
  usuario_nombre character varying(100) NOT NULL,
  accion character varying(50) NOT NULL,
  descripcion text,
  datos jsonb,
  created_at timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cen_archivos (
  id integer DEFAULT nextval('cen_archivos_id_seq'::regclass) NOT NULL,
  fuente character varying(20) NOT NULL,
  nombre character varying(255) NOT NULL,
  tamano integer,
  fecha_archivo timestamp without time zone,
  estado character varying(20) DEFAULT 'ok'::character varying NOT NULL,
  error text,
  contenido text,
  procesado_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS cen_config_clientes (
  nit character varying(15) NOT NULL,
  nombre character varying(80),
  id_co character varying(3) DEFAULT '001'::character varying NOT NULL,
  tipo_docto character varying(3) DEFAULT 'PVS'::character varying NOT NULL,
  bodega character varying(5) DEFAULT '00110'::character varying NOT NULL,
  ind_precio character varying(1) DEFAULT '2'::character varying NOT NULL,
  lista_precio character varying(3),
  cond_pago character varying(3),
  updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS cen_items_siesa (
  f120_id integer NOT NULL,
  referencia character varying(30),
  descripcion character varying(200),
  codigo_anterior character varying(30),
  unidad character varying(4),
  actualizado_at timestamp without time zone DEFAULT now() NOT NULL,
  extension1 character varying(10)
);

CREATE TABLE IF NOT EXISTS cen_orden_distribucion (
  id integer DEFAULT nextval('cen_orden_distribucion_id_seq'::regclass) NOT NULL,
  linea_id integer NOT NULL,
  ean_local character varying(20) NOT NULL,
  cantidad numeric(14,3) NOT NULL
);

CREATE TABLE IF NOT EXISTS cen_orden_lineas (
  id integer DEFAULT nextval('cen_orden_lineas_id_seq'::regclass) NOT NULL,
  orden_id integer NOT NULL,
  nro_linea integer NOT NULL,
  ean_item character varying(20) NOT NULL,
  cod_comprador character varying(35),
  descripcion character varying(200),
  cantidad numeric(14,3) NOT NULL,
  precio numeric(16,4) DEFAULT 0 NOT NULL,
  iva numeric(6,2)
);

CREATE TABLE IF NOT EXISTS cen_ordenes (
  id integer DEFAULT nextval('cen_ordenes_id_seq'::regclass) NOT NULL,
  fuente character varying(20) NOT NULL,
  archivo_id integer,
  numero_orden character varying(35) NOT NULL,
  fecha_orden date,
  fecha_entrega date,
  fecha_entrega_max date,
  ean_comprador character varying(20) NOT NULL,
  ean_entrega character varying(20) NOT NULL,
  nit character varying(15),
  sucursal character varying(3),
  razon_social character varying(100),
  total_unidades numeric(14,2) DEFAULT 0 NOT NULL,
  valor_total numeric(16,2) DEFAULT 0 NOT NULL,
  peso_kg numeric(12,3),
  ruta character varying(40),
  ruta_manual boolean DEFAULT false NOT NULL,
  estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
  siesa_consecutivo character varying(20),
  siesa_respuesta jsonb,
  enviado_at timestamp without time zone,
  created_at timestamp without time zone DEFAULT now() NOT NULL,
  updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS cen_productos (
  ean character varying(20) NOT NULL,
  item character varying(20),
  descripcion character varying(200),
  peso_kg numeric(10,4) DEFAULT 0 NOT NULL,
  und_caja integer,
  peso_embalaje numeric(10,4),
  updated_at timestamp without time zone DEFAULT now() NOT NULL,
  f120_id integer
);

CREATE TABLE IF NOT EXISTS cen_productos_comprador (
  ean_comprador character varying(14) NOT NULL,
  ean character varying(14) NOT NULL,
  f120_id integer,
  descripcion character varying(200),
  peso_kg numeric(10,3),
  und_caja integer,
  updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS cen_puntos_ean (
  id integer DEFAULT nextval('cen_puntos_ean_id_seq'::regclass) NOT NULL,
  nit character varying(15) NOT NULL,
  sucursal character varying(3) NOT NULL,
  razon_social character varying(100) NOT NULL,
  ean character varying(35) NOT NULL,
  activo boolean DEFAULT true NOT NULL,
  created_at timestamp without time zone DEFAULT now() NOT NULL,
  updated_at timestamp without time zone DEFAULT now() NOT NULL,
  ciudad character varying(60),
  departamento character varying(60),
  bodega character varying(5)
);

CREATE TABLE IF NOT EXISTS cen_reglas_ruta (
  id integer DEFAULT nextval('cen_reglas_ruta_id_seq'::regclass) NOT NULL,
  prioridad integer DEFAULT 100 NOT NULL,
  ruta character varying(40) NOT NULL,
  ean_comprador character varying(20),
  ciudades text[] DEFAULT '{}'::text[] NOT NULL,
  departamentos text[] DEFAULT '{}'::text[] NOT NULL,
  peso_min numeric(12,3),
  peso_max numeric(12,3),
  descripcion character varying(120),
  activo boolean DEFAULT true NOT NULL,
  updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS cen_rutas (
  ruta character varying(30) NOT NULL,
  totales character varying(10) DEFAULT 'item'::character varying NOT NULL,
  updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS equipos_cambios_componentes (
  id integer DEFAULT nextval('equipos_cambios_componentes_id_seq'::regclass) NOT NULL,
  equipo_id character varying(10) NOT NULL,
  fecha date NOT NULL,
  componente character varying(100),
  descripcion_anterior text,
  descripcion_nuevo text,
  motivo character varying(100),
  tecnico character varying(100),
  observaciones text,
  created_at timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS equipos_incidencias (
  id integer DEFAULT nextval('equipos_incidencias_id_seq'::regclass) NOT NULL,
  equipo_id character varying(10) NOT NULL,
  ticket_id character varying(50),
  fecha_apertura date NOT NULL,
  fecha_cierre date,
  tipo character varying(100),
  descripcion text,
  solucion text,
  tecnico character varying(100),
  prioridad character varying(20) DEFAULT 'Media'::character varying,
  estado_ticket character varying(50) DEFAULT 'Abierto'::character varying,
  created_at timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS equipos_mantenimientos (
  id integer DEFAULT nextval('equipos_mantenimientos_id_seq'::regclass) NOT NULL,
  equipo_id character varying(10) NOT NULL,
  fecha date NOT NULL,
  tipo character varying(100),
  descripcion text,
  tecnico character varying(100),
  empresa character varying(100),
  costo numeric(10,2),
  proxima_fecha date,
  observaciones text,
  created_at timestamp without time zone DEFAULT now(),
  realizado boolean DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS equipos_tecnologicos (
  id character varying(10) NOT NULL,
  placa_activo character varying(50),
  cod_barras character varying(100),
  tipo_equipo character varying(50) NOT NULL,
  marca character varying(100) NOT NULL,
  modelo character varying(100),
  numero_serie character varying(100),
  numero_interno character varying(50),
  procesador character varying(100),
  nucleos_procesador character varying(50),
  velocidad_procesador character varying(50),
  ram_capacidad character varying(50),
  ram_tipo character varying(50),
  disco_tipo character varying(50),
  disco_capacidad character varying(50),
  disco_secundario character varying(100),
  unidad_optica character varying(50),
  camara_integrada boolean DEFAULT false,
  tarjeta_video character varying(100),
  fuente_poder character varying(50),
  monitor_marca character varying(100),
  monitor_modelo character varying(100),
  monitor_serial character varying(100),
  monitor_pulgadas character varying(20),
  monitor_resolucion character varying(50),
  monitor_tipo_panel character varying(50),
  impresora_tipo character varying(50),
  toner_referencia character varying(100),
  toner_rendimiento character varying(50),
  toner_ultimo_cambio date,
  toner_proximo_cambio date,
  impresora_en_red boolean DEFAULT false,
  ip_asignada character varying(50),
  mascara_subred character varying(50),
  gateway character varying(50),
  dns_primario character varying(50),
  mac_address character varying(50),
  tipo_conexion character varying(50),
  hostname character varying(100),
  dominio character varying(100),
  sistema_operativo character varying(100),
  version_so character varying(50),
  licencia_so character varying(100),
  office_version character varying(50),
  licencia_office character varying(100),
  antivirus character varying(100),
  version_antivirus character varying(50),
  licencia_antivirus character varying(100),
  software_adicional text,
  sede character varying(100),
  area_ubicacion character varying(100),
  departamento_ubicacion character varying(100),
  responsable character varying(100),
  cargo_responsable character varying(100),
  usuario_asignado character varying(100),
  ext_telefonica character varying(20),
  piso_oficina character varying(50),
  puesto_trabajo character varying(50),
  estado character varying(50) DEFAULT 'Activo'::character varying,
  condicion_fisica character varying(50),
  forma_adquisicion character varying(50),
  fecha_adquisicion date,
  valor_adquisicion numeric(15,2),
  proveedor character varying(100),
  tipo_garantia character varying(50),
  fecha_inicio_garantia date,
  fecha_fin_garantia date,
  en_garantia boolean DEFAULT false,
  contrato_numero character varying(100),
  tipo_mantenimiento character varying(50),
  frecuencia_mantenimiento character varying(50),
  ultimo_mantenimiento date,
  proximo_mantenimiento date,
  tecnico_responsable character varying(100),
  contrato_mantenimiento character varying(100),
  observaciones text,
  fecha_registro timestamp without time zone DEFAULT now(),
  usuario_registro character varying(100),
  fecha_actualizacion timestamp without time zone,
  usuario_actualizacion character varying(100),
  ip_asignada_2 character varying(50),
  mascara_subred_2 character varying(50),
  gateway_2 character varying(50),
  dns_primario_2 character varying(50),
  mac_address_2 character varying(50),
  tipo_conexion_2 character varying(50)
);

CREATE TABLE IF NOT EXISTS inventario_conteos (
  id integer DEFAULT nextval('inventario_conteos_id_seq'::regclass) NOT NULL,
  id_inventario integer,
  conteo_fisico numeric(18,3),
  observaciones character varying(500),
  usuario_id integer,
  updated_at timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventario_datos (
  id integer DEFAULT nextval('inventario_datos_id_seq'::regclass) NOT NULL,
  fecha date NOT NULL,
  categoria character varying(100),
  referencia character varying(50) NOT NULL,
  descripcion character varying(255),
  localizacion character varying(20),
  cantidad numeric(18,3),
  um character varying(20),
  costo_unitario numeric(18,2),
  costo_total numeric(18,2),
  tipo character varying(50),
  fecha_carga timestamp without time zone DEFAULT now(),
  cargado_por integer,
  acumulado boolean DEFAULT false,
  lote character varying(50),
  modo character varying(10) DEFAULT 'items'::character varying NOT NULL
);

CREATE TABLE IF NOT EXISTS pvn_componentes (
  id integer DEFAULT nextval('pvn_componentes_id_seq'::regclass) NOT NULL,
  producto_id integer NOT NULL,
  componente_id integer NOT NULL,
  componente_nombre character varying(200) NOT NULL,
  cantidad numeric(10,4) NOT NULL,
  unidad character varying(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS pvn_pagos_qr (
  id integer DEFAULT nextval('pvn_pagos_qr_id_seq'::regclass) NOT NULL,
  usuario_id integer NOT NULL,
  usuario_nombre character varying(100) NOT NULL,
  punto_venta_id integer,
  punto_venta_nombre character varying(100),
  fecha date NOT NULL,
  valor numeric(14,2) NOT NULL,
  foto_url text NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  turno_id integer,
  transferencia_id integer
);

CREATE TABLE IF NOT EXISTS pvn_productos (
  id integer NOT NULL,
  nombre character varying(200) NOT NULL,
  activo boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS pvn_puntos_venta (
  id integer DEFAULT nextval('pvn_puntos_venta_id_seq'::regclass) NOT NULL,
  nombre character varying(200) NOT NULL,
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  tipo character varying(20) DEFAULT 'nacional'::character varying NOT NULL
);

CREATE TABLE IF NOT EXISTS pvn_registros (
  id integer DEFAULT nextval('pvn_registros_id_seq'::regclass) NOT NULL,
  usuario_id integer,
  usuario_nombre character varying(200) NOT NULL,
  fecha date DEFAULT CURRENT_DATE NOT NULL,
  turno character varying(50) DEFAULT 'Cierre'::character varying NOT NULL,
  observaciones text,
  created_at timestamp without time zone DEFAULT now(),
  punto_venta_id integer,
  punto_venta_nombre character varying(200)
);

CREATE TABLE IF NOT EXISTS pvn_registros_detalle (
  id integer DEFAULT nextval('pvn_registros_detalle_id_seq'::regclass) NOT NULL,
  registro_id integer NOT NULL,
  producto_id integer NOT NULL,
  producto_nombre character varying(200) NOT NULL,
  cantidad integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS pvn_transferencias_bancarias (
  id integer DEFAULT nextval('pvn_transferencias_bancarias_id_seq'::regclass) NOT NULL,
  email_message_id character varying(255) NOT NULL,
  banco_origen character varying(50) NOT NULL,
  valor numeric(14,2) NOT NULL,
  ordenante character varying(200) NOT NULL,
  referencia character varying(100),
  fecha_transferencia timestamp without time zone NOT NULL,
  es_prueba boolean DEFAULT false NOT NULL,
  estado character varying(20) DEFAULT 'disponible'::character varying NOT NULL,
  reclamada_por_usuario_id integer,
  reclamada_at timestamp without time zone,
  pago_qr_id integer,
  created_at timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pvn_turnos (
  id integer DEFAULT nextval('pvn_turnos_id_seq'::regclass) NOT NULL,
  usuario_id integer NOT NULL,
  usuario_nombre character varying(100) NOT NULL,
  punto_venta_id integer NOT NULL,
  punto_venta_nombre character varying(100) NOT NULL,
  fecha date NOT NULL,
  abierto_at timestamp without time zone DEFAULT now(),
  cerrado_at timestamp without time zone,
  activo boolean DEFAULT true,
  foto_datafono_url text,
  numero_recogida character varying(20),
  fecha_cierre date
);

CREATE TABLE IF NOT EXISTS tic_articulo_asignaciones (
  id integer DEFAULT nextval('tic_articulo_asignaciones_id_seq'::regclass) NOT NULL,
  articulo_codigo character varying(12) NOT NULL,
  cantidad integer NOT NULL,
  equipo_id character varying(20),
  persona_nombre character varying(120),
  persona_area character varying(60),
  es_prestamo boolean DEFAULT false NOT NULL,
  fecha_asignacion date NOT NULL,
  fecha_limite_prestamo date,
  observaciones text,
  estado character varying(12) DEFAULT 'vigente'::character varying NOT NULL,
  destino_retiro character varying(12),
  fecha_retiro date,
  motivo_retiro character varying(80),
  detalle_retiro text,
  reemplaza_a integer,
  reemplazada_por integer,
  movimiento_salida_id integer NOT NULL,
  movimiento_retorno_id integer,
  registrado_por character varying(120) NOT NULL,
  cerrado_por character varying(120),
  created_at timestamp without time zone DEFAULT now(),
  cerrado_en timestamp without time zone
);

CREATE TABLE IF NOT EXISTS tic_articulo_movimientos (
  id integer DEFAULT nextval('tic_articulo_movimientos_id_seq'::regclass) NOT NULL,
  articulo_codigo character varying(12) NOT NULL,
  fecha date NOT NULL,
  tipo character varying(10) NOT NULL,
  motivo character varying(80) NOT NULL,
  cantidad integer NOT NULL,
  stock_anterior integer NOT NULL,
  stock_resultante integer NOT NULL,
  equipo_id character varying(20),
  destino_nombre character varying(120),
  destino_area character varying(60),
  proveedor character varying(120),
  documento_ref character varying(60),
  costo_unitario numeric(14,2),
  contador_paginas integer,
  observaciones text,
  registrado_por character varying(120) NOT NULL,
  created_at timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tic_articulos (
  codigo character varying(12) NOT NULL,
  categoria character varying(20) NOT NULL,
  tipo character varying(60) NOT NULL,
  descripcion character varying(200) NOT NULL,
  marca character varying(60),
  referencia character varying(80),
  compatible_con character varying(200),
  unidad character varying(20) DEFAULT 'Unidad'::character varying NOT NULL,
  stock_actual integer DEFAULT 0 NOT NULL,
  stock_minimo integer DEFAULT 0 NOT NULL,
  ubicacion character varying(80),
  costo_unitario numeric(14,2),
  activo boolean DEFAULT true NOT NULL,
  observaciones text,
  registrado_por character varying(120) NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  actualizado_en timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tic_movimiento_activos (
  id integer DEFAULT nextval('tic_movimiento_activos_id_seq'::regclass) NOT NULL,
  movimiento_id character varying(12) NOT NULL,
  equipo_id character varying(20) NOT NULL,
  descripcion character varying(200) NOT NULL,
  tipo_activo character varying(60) NOT NULL,
  cantidad integer DEFAULT 1 NOT NULL
);

CREATE TABLE IF NOT EXISTS tic_movimientos (
  id character varying(12) NOT NULL,
  fecha date NOT NULL,
  movimiento character varying(20) NOT NULL,
  tipo_movimiento character varying(60) NOT NULL,
  motivo character varying(80) NOT NULL,
  origen_nombre character varying(120) NOT NULL,
  origen_documento character varying(30) NOT NULL,
  origen_area character varying(60) NOT NULL,
  destino_nombre character varying(120) NOT NULL,
  destino_documento character varying(30) NOT NULL,
  destino_area character varying(60) NOT NULL,
  observaciones text,
  estado character varying(20) DEFAULT 'autorizado'::character varying NOT NULL,
  registrado_por character varying(120) NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  foto_autorizacion_url text
);

CREATE TABLE IF NOT EXISTS usuario_modulos (
  usuario_id integer NOT NULL,
  modulo character varying(40) NOT NULL
);

CREATE TABLE IF NOT EXISTS usuarios (
  id integer DEFAULT nextval('usuarios_id_seq'::regclass) NOT NULL,
  username character varying(50) NOT NULL,
  password_hash character varying(255) NOT NULL,
  nombre character varying(100) NOT NULL,
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  rol character varying(20) DEFAULT 'usuario'::character varying NOT NULL,
  debe_cambiar_password boolean DEFAULT false,
  area character varying(50) DEFAULT 'logistica'::character varying,
  punto_venta_id integer,
  intentos_fallidos integer DEFAULT 0 NOT NULL,
  bloqueado_hasta timestamp without time zone,
  acceso_movil boolean DEFAULT true
);

-- Restricciones (llave primaria, únicas y CHECK)
ALTER TABLE areas ADD CONSTRAINT areas_pkey PRIMARY KEY (id);
ALTER TABLE areas ADD CONSTRAINT areas_key_key UNIQUE (key);
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);
ALTER TABLE cen_archivos ADD CONSTRAINT cen_archivos_estado_check CHECK (((estado)::text = ANY ((ARRAY['ok'::character varying, 'error'::character varying])::text[])));
ALTER TABLE cen_archivos ADD CONSTRAINT cen_archivos_pkey PRIMARY KEY (id);
ALTER TABLE cen_archivos ADD CONSTRAINT cen_archivos_fuente_nombre_key UNIQUE (fuente, nombre);
ALTER TABLE cen_config_clientes ADD CONSTRAINT cen_config_clientes_ind_precio_check CHECK (((ind_precio)::text = ANY ((ARRAY['0'::character varying, '1'::character varying, '2'::character varying])::text[])));
ALTER TABLE cen_config_clientes ADD CONSTRAINT cen_config_clientes_pkey PRIMARY KEY (nit);
ALTER TABLE cen_items_siesa ADD CONSTRAINT cen_items_siesa_pkey PRIMARY KEY (f120_id);
ALTER TABLE cen_orden_distribucion ADD CONSTRAINT cen_orden_distribucion_pkey PRIMARY KEY (id);
ALTER TABLE cen_orden_lineas ADD CONSTRAINT cen_orden_lineas_pkey PRIMARY KEY (id);
ALTER TABLE cen_ordenes ADD CONSTRAINT cen_ordenes_estado_check CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'sin_punto'::character varying, 'enviado'::character varying, 'error'::character varying, 'descartada'::character varying])::text[])));
ALTER TABLE cen_ordenes ADD CONSTRAINT cen_ordenes_pkey PRIMARY KEY (id);
ALTER TABLE cen_ordenes ADD CONSTRAINT cen_ordenes_ean_comprador_numero_orden_key UNIQUE (ean_comprador, numero_orden);
ALTER TABLE cen_productos ADD CONSTRAINT cen_productos_pkey PRIMARY KEY (ean);
ALTER TABLE cen_productos_comprador ADD CONSTRAINT cen_productos_comprador_pkey PRIMARY KEY (ean_comprador, ean);
ALTER TABLE cen_puntos_ean ADD CONSTRAINT cen_puntos_ean_pkey PRIMARY KEY (id);
ALTER TABLE cen_puntos_ean ADD CONSTRAINT cen_puntos_ean_ean_key UNIQUE (ean);
ALTER TABLE cen_reglas_ruta ADD CONSTRAINT cen_reglas_ruta_pkey PRIMARY KEY (id);
ALTER TABLE cen_rutas ADD CONSTRAINT cen_rutas_totales_check CHECK (((totales)::text = ANY ((ARRAY['item'::character varying, 'cliente'::character varying])::text[])));
ALTER TABLE cen_rutas ADD CONSTRAINT cen_rutas_pkey PRIMARY KEY (ruta);
ALTER TABLE equipos_cambios_componentes ADD CONSTRAINT equipos_cambios_componentes_pkey PRIMARY KEY (id);
ALTER TABLE equipos_incidencias ADD CONSTRAINT equipos_incidencias_pkey PRIMARY KEY (id);
ALTER TABLE equipos_mantenimientos ADD CONSTRAINT equipos_mantenimientos_pkey PRIMARY KEY (id);
ALTER TABLE equipos_tecnologicos ADD CONSTRAINT equipos_tecnologicos_pkey PRIMARY KEY (id);
ALTER TABLE inventario_conteos ADD CONSTRAINT inventario_conteos_pkey PRIMARY KEY (id);
ALTER TABLE inventario_datos ADD CONSTRAINT inventario_datos_pkey PRIMARY KEY (id);
ALTER TABLE pvn_componentes ADD CONSTRAINT pvn_componentes_pkey PRIMARY KEY (id);
ALTER TABLE pvn_pagos_qr ADD CONSTRAINT pvn_pagos_qr_pkey PRIMARY KEY (id);
ALTER TABLE pvn_productos ADD CONSTRAINT pvn_productos_pkey PRIMARY KEY (id);
ALTER TABLE pvn_puntos_venta ADD CONSTRAINT pvn_puntos_venta_pkey PRIMARY KEY (id);
ALTER TABLE pvn_puntos_venta ADD CONSTRAINT pvn_puntos_venta_nombre_key UNIQUE (nombre);
ALTER TABLE pvn_registros ADD CONSTRAINT pvn_registros_pkey PRIMARY KEY (id);
ALTER TABLE pvn_registros_detalle ADD CONSTRAINT pvn_registros_detalle_cantidad_check CHECK ((cantidad >= 0));
ALTER TABLE pvn_registros_detalle ADD CONSTRAINT pvn_registros_detalle_pkey PRIMARY KEY (id);
ALTER TABLE pvn_transferencias_bancarias ADD CONSTRAINT pvn_transferencias_bancarias_estado_check CHECK (((estado)::text = ANY ((ARRAY['disponible'::character varying, 'reclamada'::character varying, 'anonimizada'::character varying])::text[])));
ALTER TABLE pvn_transferencias_bancarias ADD CONSTRAINT pvn_transferencias_bancarias_pkey PRIMARY KEY (id);
ALTER TABLE pvn_transferencias_bancarias ADD CONSTRAINT pvn_transferencias_bancarias_email_message_id_key UNIQUE (email_message_id);
ALTER TABLE pvn_turnos ADD CONSTRAINT pvn_turnos_pkey PRIMARY KEY (id);
ALTER TABLE tic_articulo_asignaciones ADD CONSTRAINT tic_articulo_asignaciones_cantidad_check CHECK ((cantidad > 0));
ALTER TABLE tic_articulo_asignaciones ADD CONSTRAINT tic_articulo_asignaciones_check CHECK (((equipo_id IS NOT NULL) OR (persona_nombre IS NOT NULL)));
ALTER TABLE tic_articulo_asignaciones ADD CONSTRAINT tic_articulo_asignaciones_check1 CHECK (((NOT es_prestamo) OR (fecha_limite_prestamo IS NOT NULL)));
ALTER TABLE tic_articulo_asignaciones ADD CONSTRAINT tic_articulo_asignaciones_destino_retiro_check CHECK (((destino_retiro)::text = ANY ((ARRAY['inventario'::character varying, 'baja'::character varying, 'garantia'::character varying, 'perdido'::character varying])::text[])));
ALTER TABLE tic_articulo_asignaciones ADD CONSTRAINT tic_articulo_asignaciones_estado_check CHECK (((estado)::text = ANY ((ARRAY['vigente'::character varying, 'devuelto'::character varying, 'reemplazado'::character varying])::text[])));
ALTER TABLE tic_articulo_asignaciones ADD CONSTRAINT tic_articulo_asignaciones_pkey PRIMARY KEY (id);
ALTER TABLE tic_articulo_movimientos ADD CONSTRAINT tic_articulo_movimientos_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['entrada'::character varying, 'salida'::character varying, 'ajuste'::character varying])::text[])));
ALTER TABLE tic_articulo_movimientos ADD CONSTRAINT tic_articulo_movimientos_pkey PRIMARY KEY (id);
ALTER TABLE tic_articulos ADD CONSTRAINT tic_articulos_categoria_check CHECK (((categoria)::text = ANY ((ARRAY['Repuesto'::character varying, 'Insumo'::character varying, 'Periférico'::character varying])::text[])));
ALTER TABLE tic_articulos ADD CONSTRAINT tic_articulos_stock_actual_check CHECK ((stock_actual >= 0));
ALTER TABLE tic_articulos ADD CONSTRAINT tic_articulos_stock_minimo_check CHECK ((stock_minimo >= 0));
ALTER TABLE tic_articulos ADD CONSTRAINT tic_articulos_pkey PRIMARY KEY (codigo);
ALTER TABLE tic_movimiento_activos ADD CONSTRAINT tic_movimiento_activos_cantidad_check CHECK ((cantidad > 0));
ALTER TABLE tic_movimiento_activos ADD CONSTRAINT tic_movimiento_activos_pkey PRIMARY KEY (id);
ALTER TABLE tic_movimientos ADD CONSTRAINT tic_movimientos_estado_check CHECK (((estado)::text = ANY ((ARRAY['autorizado'::character varying, 'entregado'::character varying, 'recibido'::character varying, 'cerrado'::character varying])::text[])));
ALTER TABLE tic_movimientos ADD CONSTRAINT tic_movimientos_movimiento_check CHECK (((movimiento)::text = ANY ((ARRAY['definitivo'::character varying, 'temporal'::character varying])::text[])));
ALTER TABLE tic_movimientos ADD CONSTRAINT tic_movimientos_pkey PRIMARY KEY (id);
ALTER TABLE usuario_modulos ADD CONSTRAINT usuario_modulos_pkey PRIMARY KEY (usuario_id, modulo);
ALTER TABLE usuarios ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);
ALTER TABLE usuarios ADD CONSTRAINT usuarios_username_key UNIQUE (username);

-- Llaves foráneas
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE cen_orden_distribucion ADD CONSTRAINT cen_orden_distribucion_linea_id_fkey FOREIGN KEY (linea_id) REFERENCES cen_orden_lineas(id) ON DELETE CASCADE;
ALTER TABLE cen_orden_lineas ADD CONSTRAINT cen_orden_lineas_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES cen_ordenes(id) ON DELETE CASCADE;
ALTER TABLE cen_ordenes ADD CONSTRAINT cen_ordenes_archivo_id_fkey FOREIGN KEY (archivo_id) REFERENCES cen_archivos(id);
ALTER TABLE equipos_cambios_componentes ADD CONSTRAINT equipos_cambios_componentes_equipo_id_fkey FOREIGN KEY (equipo_id) REFERENCES equipos_tecnologicos(id) ON DELETE CASCADE;
ALTER TABLE equipos_incidencias ADD CONSTRAINT equipos_incidencias_equipo_id_fkey FOREIGN KEY (equipo_id) REFERENCES equipos_tecnologicos(id) ON DELETE CASCADE;
ALTER TABLE equipos_mantenimientos ADD CONSTRAINT equipos_mantenimientos_equipo_id_fkey FOREIGN KEY (equipo_id) REFERENCES equipos_tecnologicos(id) ON DELETE CASCADE;
ALTER TABLE inventario_conteos ADD CONSTRAINT inventario_conteos_id_inventario_fkey FOREIGN KEY (id_inventario) REFERENCES inventario_datos(id) ON DELETE CASCADE;
ALTER TABLE inventario_conteos ADD CONSTRAINT inventario_conteos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE inventario_datos ADD CONSTRAINT inventario_datos_cargado_por_fkey FOREIGN KEY (cargado_por) REFERENCES usuarios(id);
ALTER TABLE pvn_componentes ADD CONSTRAINT pvn_componentes_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES pvn_productos(id);
ALTER TABLE pvn_pagos_qr ADD CONSTRAINT pvn_pagos_qr_punto_venta_id_fkey FOREIGN KEY (punto_venta_id) REFERENCES pvn_puntos_venta(id);
ALTER TABLE pvn_pagos_qr ADD CONSTRAINT pvn_pagos_qr_transferencia_id_fkey FOREIGN KEY (transferencia_id) REFERENCES pvn_transferencias_bancarias(id);
ALTER TABLE pvn_pagos_qr ADD CONSTRAINT pvn_pagos_qr_turno_id_fkey FOREIGN KEY (turno_id) REFERENCES pvn_turnos(id);
ALTER TABLE pvn_pagos_qr ADD CONSTRAINT pvn_pagos_qr_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE pvn_registros ADD CONSTRAINT pvn_registros_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE pvn_registros_detalle ADD CONSTRAINT pvn_registros_detalle_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES pvn_productos(id);
ALTER TABLE pvn_registros_detalle ADD CONSTRAINT pvn_registros_detalle_registro_id_fkey FOREIGN KEY (registro_id) REFERENCES pvn_registros(id) ON DELETE CASCADE;
ALTER TABLE pvn_transferencias_bancarias ADD CONSTRAINT pvn_transferencias_bancarias_pago_qr_id_fkey FOREIGN KEY (pago_qr_id) REFERENCES pvn_pagos_qr(id);
ALTER TABLE pvn_transferencias_bancarias ADD CONSTRAINT pvn_transferencias_bancarias_reclamada_por_usuario_id_fkey FOREIGN KEY (reclamada_por_usuario_id) REFERENCES usuarios(id);
ALTER TABLE pvn_turnos ADD CONSTRAINT pvn_turnos_punto_venta_id_fkey FOREIGN KEY (punto_venta_id) REFERENCES pvn_puntos_venta(id);
ALTER TABLE pvn_turnos ADD CONSTRAINT pvn_turnos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE tic_articulo_asignaciones ADD CONSTRAINT tic_articulo_asignaciones_articulo_codigo_fkey FOREIGN KEY (articulo_codigo) REFERENCES tic_articulos(codigo);
ALTER TABLE tic_articulo_asignaciones ADD CONSTRAINT tic_articulo_asignaciones_movimiento_retorno_id_fkey FOREIGN KEY (movimiento_retorno_id) REFERENCES tic_articulo_movimientos(id);
ALTER TABLE tic_articulo_asignaciones ADD CONSTRAINT tic_articulo_asignaciones_movimiento_salida_id_fkey FOREIGN KEY (movimiento_salida_id) REFERENCES tic_articulo_movimientos(id);
ALTER TABLE tic_articulo_asignaciones ADD CONSTRAINT tic_articulo_asignaciones_reemplaza_a_fkey FOREIGN KEY (reemplaza_a) REFERENCES tic_articulo_asignaciones(id);
ALTER TABLE tic_articulo_asignaciones ADD CONSTRAINT tic_articulo_asignaciones_reemplazada_por_fkey FOREIGN KEY (reemplazada_por) REFERENCES tic_articulo_asignaciones(id);
ALTER TABLE tic_articulo_movimientos ADD CONSTRAINT tic_articulo_movimientos_articulo_codigo_fkey FOREIGN KEY (articulo_codigo) REFERENCES tic_articulos(codigo);
ALTER TABLE tic_movimiento_activos ADD CONSTRAINT tic_movimiento_activos_movimiento_id_fkey FOREIGN KEY (movimiento_id) REFERENCES tic_movimientos(id) ON DELETE CASCADE;
ALTER TABLE usuario_modulos ADD CONSTRAINT usuario_modulos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_punto_venta_id_fkey FOREIGN KEY (punto_venta_id) REFERENCES pvn_puntos_venta(id);

-- Índices
CREATE INDEX IF NOT EXISTS idx_audit_accion ON public.audit_logs USING btree (accion);
CREATE INDEX IF NOT EXISTS idx_audit_fecha ON public.audit_logs USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_usuario ON public.audit_logs USING btree (usuario_id);
CREATE INDEX IF NOT EXISTS idx_cen_items_codigo_anterior ON public.cen_items_siesa USING btree (codigo_anterior);
CREATE INDEX IF NOT EXISTS idx_cen_distribucion_linea ON public.cen_orden_distribucion USING btree (linea_id);
CREATE INDEX IF NOT EXISTS idx_cen_lineas_orden ON public.cen_orden_lineas USING btree (orden_id);
CREATE INDEX IF NOT EXISTS idx_cen_ordenes_ean_entrega ON public.cen_ordenes USING btree (ean_entrega);
CREATE INDEX IF NOT EXISTS idx_cen_ordenes_entrega ON public.cen_ordenes USING btree (fecha_entrega);
CREATE INDEX IF NOT EXISTS idx_cen_ordenes_estado ON public.cen_ordenes USING btree (estado);
CREATE INDEX IF NOT EXISTS idx_cen_puntos_ean_nit ON public.cen_puntos_ean USING btree (nit);
CREATE INDEX IF NOT EXISTS idx_cen_puntos_ean_nit_sucursal ON public.cen_puntos_ean USING btree (nit, sucursal);
CREATE INDEX IF NOT EXISTS idx_conteos_inv ON public.inventario_conteos USING btree (id_inventario);
CREATE INDEX IF NOT EXISTS idx_inv_categoria ON public.inventario_datos USING btree (categoria);
CREATE INDEX IF NOT EXISTS idx_inv_fecha ON public.inventario_datos USING btree (fecha);
CREATE INDEX IF NOT EXISTS idx_inv_referencia ON public.inventario_datos USING btree (referencia);
CREATE INDEX IF NOT EXISTS idx_pagos_qr_fecha ON public.pvn_pagos_qr USING btree (fecha);
CREATE INDEX IF NOT EXISTS idx_pagos_qr_punto ON public.pvn_pagos_qr USING btree (punto_venta_id);
CREATE INDEX IF NOT EXISTS idx_pagos_qr_transferencia ON public.pvn_pagos_qr USING btree (transferencia_id);
CREATE INDEX IF NOT EXISTS idx_pagos_qr_turno ON public.pvn_pagos_qr USING btree (turno_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pvn_registros_turno ON public.pvn_registros USING btree (usuario_id, fecha, turno);
CREATE INDEX IF NOT EXISTS idx_transferencias_estado_fecha ON public.pvn_transferencias_bancarias USING btree (estado, fecha_transferencia);
CREATE INDEX IF NOT EXISTS idx_turnos_fecha ON public.pvn_turnos USING btree (fecha);
CREATE INDEX IF NOT EXISTS idx_turnos_usuario ON public.pvn_turnos USING btree (usuario_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pvn_turnos_activo_dia ON public.pvn_turnos USING btree (usuario_id, fecha) WHERE activo;
CREATE INDEX IF NOT EXISTS idx_tic_asig_articulo ON public.tic_articulo_asignaciones USING btree (articulo_codigo);
CREATE INDEX IF NOT EXISTS idx_tic_asig_equipo ON public.tic_articulo_asignaciones USING btree (equipo_id);
CREATE INDEX IF NOT EXISTS idx_tic_asig_estado ON public.tic_articulo_asignaciones USING btree (estado);
CREATE INDEX IF NOT EXISTS idx_tic_artmov_art ON public.tic_articulo_movimientos USING btree (articulo_codigo);
CREATE INDEX IF NOT EXISTS idx_tic_artmov_equipo ON public.tic_articulo_movimientos USING btree (equipo_id);
CREATE INDEX IF NOT EXISTS idx_tic_artmov_fecha ON public.tic_articulo_movimientos USING btree (fecha);
CREATE INDEX IF NOT EXISTS idx_tic_art_categoria ON public.tic_articulos USING btree (categoria);
CREATE INDEX IF NOT EXISTS idx_tic_act_eq_id ON public.tic_movimiento_activos USING btree (equipo_id);
CREATE INDEX IF NOT EXISTS idx_tic_act_mov_id ON public.tic_movimiento_activos USING btree (movimiento_id);
CREATE INDEX IF NOT EXISTS idx_tic_mov_estado ON public.tic_movimientos USING btree (estado);
CREATE INDEX IF NOT EXISTS idx_tic_mov_fecha ON public.tic_movimientos USING btree (fecha);
CREATE INDEX IF NOT EXISTS idx_usuario_modulos_usuario ON public.usuario_modulos USING btree (usuario_id);

-- Vistas
CREATE OR REPLACE VIEW cen_lineas_producto AS
SELECT l.id AS linea_id,
    o.ean_comprador,
    COALESCE(p.ean, c.ean) AS ean,
    COALESCE(c.f120_id, p.f120_id) AS f120_id,
    COALESCE(c.peso_kg, p.peso_kg) AS peso_kg,
    COALESCE(c.descripcion, p.descripcion) AS descripcion,
    COALESCE(c.und_caja, p.und_caja) AS und_caja,
    c.ean IS NOT NULL AS por_cadena
   FROM cen_orden_lineas l
     JOIN cen_ordenes o ON o.id = l.orden_id
     LEFT JOIN cen_productos p ON p.ean::text = l.ean_item::text
     LEFT JOIN cen_productos_comprador c ON c.ean::text = l.ean_item::text AND c.ean_comprador::text = o.ean_comprador::text;

CREATE OR REPLACE VIEW vista_acumulados AS
SELECT d.fecha,
    d.categoria,
    d.referencia,
    d.descripcion,
    d.localizacion,
    d.um,
    d.tipo,
    d.lote,
    d.modo,
    COALESCE(c.conteo_fisico, d.cantidad) AS conteo_fisico,
    d.cantidad AS cantidad_sistema,
    COALESCE(c.conteo_fisico, d.cantidad) - d.cantidad AS diferencia,
    (COALESCE(c.conteo_fisico, d.cantidad) - d.cantidad) * d.costo_unitario AS costo_diferencia,
    d.costo_total AS costo_bodega_total,
    c.observaciones
   FROM inventario_datos d
     JOIN inventario_conteos c ON c.id_inventario = d.id
  WHERE d.acumulado = true;

CREATE OR REPLACE VIEW vista_consulta AS
SELECT d.id,
    d.fecha,
    d.categoria,
    d.referencia,
    d.descripcion,
    d.localizacion,
    d.cantidad AS cantidad_sistema,
    d.um,
    d.costo_unitario,
    d.costo_total,
    d.tipo,
    d.lote,
    d.modo,
    d.cargado_por,
    d.acumulado,
    COALESCE(c.conteo_fisico, d.cantidad) AS conteo_fisico,
    COALESCE(c.conteo_fisico, d.cantidad) - d.cantidad AS diferencia,
    (COALESCE(c.conteo_fisico, d.cantidad) - d.cantidad) * d.costo_unitario AS costo_diferencia,
    d.costo_total AS costo_bodega,
    c.observaciones
   FROM inventario_datos d
     LEFT JOIN inventario_conteos c ON c.id_inventario = d.id;

