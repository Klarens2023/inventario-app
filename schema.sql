-- ═══════════════════════════════════════════════════════════
--  SCHEMA - Sistema de Control de Inventario
--  Ejecutar en Neon → SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Usuarios del sistema
CREATE TABLE IF NOT EXISTS usuarios (
  id                    SERIAL PRIMARY KEY,
  username              VARCHAR(50)  UNIQUE NOT NULL,
  password_hash         VARCHAR(255) NOT NULL,
  nombre                VARCHAR(100) NOT NULL,
  rol                   VARCHAR(20)  DEFAULT 'usuario' NOT NULL,
  activo                BOOLEAN DEFAULT TRUE,
  debe_cambiar_password BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMP DEFAULT NOW()
);

-- Datos importados del TXT de inventario
CREATE TABLE IF NOT EXISTS inventario_datos (
  id            SERIAL PRIMARY KEY,
  fecha         DATE         NOT NULL,
  categoria     VARCHAR(100),
  referencia    VARCHAR(50)  NOT NULL,
  descripcion   VARCHAR(255),
  localizacion  VARCHAR(20),
  cantidad      NUMERIC(18,3),
  um            VARCHAR(20),
  costo_unitario NUMERIC(18,2),
  costo_total   NUMERIC(18,2),
  tipo          VARCHAR(50),
  fecha_carga   TIMESTAMP DEFAULT NOW(),
  cargado_por   INTEGER REFERENCES usuarios(id),
  acumulado     BOOLEAN DEFAULT FALSE
);

-- Conteos físicos por referencia/fecha
CREATE TABLE IF NOT EXISTS inventario_conteos (
  id              SERIAL PRIMARY KEY,
  id_inventario   INTEGER REFERENCES inventario_datos(id) ON DELETE CASCADE,
  conteo_fisico   NUMERIC(18,3),
  observaciones   VARCHAR(500),
  usuario_id      INTEGER REFERENCES usuarios(id),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- Registro de auditoría de acciones de usuarios
CREATE TABLE IF NOT EXISTS audit_logs (
  id              SERIAL PRIMARY KEY,
  usuario_id      INTEGER REFERENCES usuarios(id),
  usuario_nombre  VARCHAR(100) NOT NULL,
  accion          VARCHAR(50)  NOT NULL,
  descripcion     TEXT,
  datos           JSONB,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_inv_fecha      ON inventario_datos(fecha);
CREATE INDEX IF NOT EXISTS idx_inv_referencia ON inventario_datos(referencia);
CREATE INDEX IF NOT EXISTS idx_inv_categoria  ON inventario_datos(categoria);
CREATE INDEX IF NOT EXISTS idx_conteos_inv    ON inventario_conteos(id_inventario);
CREATE INDEX IF NOT EXISTS idx_audit_usuario  ON audit_logs(usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_accion   ON audit_logs(accion);
CREATE INDEX IF NOT EXISTS idx_audit_fecha    ON audit_logs(created_at);

-- ─── VISTA PRINCIPAL (equivalente a la hoja "consulta") ──────────────────
CREATE OR REPLACE VIEW vista_consulta AS
SELECT
  d.id,
  d.fecha,
  d.referencia,
  d.descripcion,
  d.localizacion,
  d.um,
  d.categoria,
  d.tipo,
  d.cantidad        AS cantidad_sistema,
  d.costo_unitario,
  d.costo_total     AS costo_bodega,
  COALESCE(c.conteo_fisico, 0)    AS conteo_fisico,
  COALESCE(c.conteo_fisico, 0) - d.cantidad AS diferencia,
  (COALESCE(c.conteo_fisico, 0) - d.cantidad) * d.costo_unitario AS costo_diferencia,
  c.observaciones,
  c.id AS conteo_id
FROM inventario_datos d
LEFT JOIN inventario_conteos c ON c.id_inventario = d.id
ORDER BY d.fecha DESC, d.referencia;

-- ─── VISTA ACUMULADOS (equivalente a hoja "INFORME ACUMULADOS") ──────────
CREATE OR REPLACE VIEW vista_acumulados AS
SELECT
  d.fecha,
  d.categoria,
  d.tipo,
  d.referencia,
  d.descripcion,
  d.localizacion,
  d.um,
  d.cantidad        AS cantidad_sistema,
  d.costo_unitario,
  d.costo_bodega,
  COALESCE(c.conteo_fisico, 0)    AS conteo_fisico,
  COALESCE(c.conteo_fisico, 0) - d.cantidad AS diferencia,
  (COALESCE(c.conteo_fisico, 0) - d.cantidad) * d.costo_unitario AS costo_diferencia,
  d.costo_total     AS costo_bodega_total,
  c.observaciones
FROM inventario_datos d
LEFT JOIN inventario_conteos c ON c.id_inventario = d.id
WHERE d.acumulado = true
ORDER BY d.fecha DESC, d.categoria, d.referencia;
