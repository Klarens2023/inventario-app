-- ════════════════════════════════════════════════════════════════════════════
-- Rol de base de datos con permisos MÍNIMOS para la app (misma lógica que
-- scripts/crear-rol-app.js, para correrlo en el SQL Editor de Neon).
--
-- Antes de correrlo:
--   1. En el SQL Editor elige la rama de PRODUCCIÓN, la base `neondb` y el
--      rol `neondb_owner` (el dueño de las tablas).
--   2. Reemplaza PEGAR_AQUI_LA_CONTRASEÑA por la contraseña generada (solo
--      letras y números, 40 caracteres). No guardes este archivo con la
--      contraseña puesta ni la subas a Git.
--
-- Resultado: el rol `app_operaciones`
--   - lee y escribe datos en todas las tablas (lo único que hace la app);
--   - NO puede crear, alterar ni borrar tablas, ni crear roles;
--   - en audit_logs solo puede leer e insertar (la bitácora no se altera).
-- Las migraciones (scripts/migrate-*.js) se siguen corriendo con neondb_owner.
-- ════════════════════════════════════════════════════════════════════════════

-- Login propio, sin privilegios de administración
CREATE ROLE app_operaciones WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT
  PASSWORD 'PEGAR_AQUI_LA_CONTRASEÑA';

-- Conectarse a la base y usar el esquema public, sin poder crear objetos en él
GRANT CONNECT ON DATABASE neondb TO app_operaciones;
GRANT USAGE ON SCHEMA public TO app_operaciones;
REVOKE CREATE ON SCHEMA public FROM app_operaciones;

-- Datos: lectura y escritura en las tablas y vistas actuales
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_operaciones;
-- Secuencias: necesarias para los id SERIAL y los consecutivos (nextval)
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO app_operaciones;

-- Bitácora de auditoría: solo agregar y consultar
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM app_operaciones;

-- Tablas y secuencias que neondb_owner cree en el futuro (migraciones): mismos permisos
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_operaciones;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO app_operaciones;

-- ─── Comprobación (solo lectura) ───────────────────────────────────────────
-- Debe mostrar: puede_login = true, superusuario = false, crear_bd = false, crear_roles = false
SELECT rolname, rolcanlogin AS puede_login, rolsuper AS superusuario,
       rolcreatedb AS crear_bd, rolcreaterole AS crear_roles
FROM pg_roles WHERE rolname = 'app_operaciones';

-- Debe mostrar solo INSERT y SELECT
SELECT privilege_type FROM information_schema.role_table_grants
WHERE grantee = 'app_operaciones' AND table_name = 'audit_logs' ORDER BY 1;

-- Debe dar 0: tablas a las que el rol no tiene acceso de lectura
SELECT count(*) AS tablas_sin_acceso FROM pg_tables
WHERE schemaname = 'public' AND NOT has_table_privilege('app_operaciones', schemaname || '.' || tablename, 'SELECT');
