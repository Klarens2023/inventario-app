-- ════════════════════════════════════════════════════════════════════════════
-- Rol de SOLO LECTURA para el respaldo diario (.github/workflows/respaldo-bd.yml).
--
-- pg_dump solo necesita leer: con este rol, aunque se filtrara la cadena de
-- conexión guardada en los secretos de GitHub, no se podría modificar ni
-- borrar nada en producción.
--
-- Antes de correrlo en el SQL Editor de Neon:
--   1. Rama de PRODUCCIÓN, base `neondb`, rol `neondb_owner`.
--   2. Reemplaza PEGAR_AQUI_LA_CONTRASEÑA por una contraseña nueva (solo
--      letras y números, 40 caracteres). No la guardes en este archivo.
-- ════════════════════════════════════════════════════════════════════════════

-- Login propio, sin ningún privilegio de administración
CREATE ROLE app_respaldo WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT
  PASSWORD 'PEGAR_AQUI_LA_CONTRASEÑA';

-- Conectarse y ver el esquema public, sin crear nada en él
GRANT CONNECT ON DATABASE neondb TO app_respaldo;
GRANT USAGE ON SCHEMA public TO app_respaldo;
REVOKE CREATE ON SCHEMA public FROM app_respaldo;

-- Solo lectura de tablas, vistas y secuencias (pg_dump guarda el valor actual de cada secuencia)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_respaldo;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO app_respaldo;

-- Lo mismo para lo que creen futuras migraciones
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public GRANT SELECT ON TABLES TO app_respaldo;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public GRANT SELECT ON SEQUENCES TO app_respaldo;

-- ─── Comprobación (solo lectura) ───────────────────────────────────────────
-- Debe dar 0: tablas que el rol no puede leer
SELECT count(*) AS tablas_sin_lectura FROM pg_tables
WHERE schemaname = 'public' AND NOT has_table_privilege('app_respaldo', schemaname || '.' || tablename, 'SELECT');

-- Debe dar 0: tablas en las que el rol podría escribir
SELECT count(*) AS tablas_con_escritura FROM pg_tables
WHERE schemaname = 'public'
  AND (has_table_privilege('app_respaldo', schemaname || '.' || tablename, 'INSERT')
    OR has_table_privilege('app_respaldo', schemaname || '.' || tablename, 'UPDATE')
    OR has_table_privilege('app_respaldo', schemaname || '.' || tablename, 'DELETE'));
