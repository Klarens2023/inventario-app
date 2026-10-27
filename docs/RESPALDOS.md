# Respaldos de la base de datos

## Qué protege a los datos

| Capa | Cubre | Dónde |
|---|---|---|
| Historial de Neon | Cualquier momento de las **últimas 6 horas** (límite del plan actual) | Neon → Backup & Restore |
| Snapshots manuales de Neon | El momento en que alguien los crea | Neon → Backup & Restore → Create snapshot |
| **Respaldo diario** | Una copia completa por día, **30 días** | Google Drive, carpeta de respaldos |

## Respaldo diario

[`.github/workflows/respaldo-bd.yml`](../.github/workflows/respaldo-bd.yml) corre todos los días a las 3:17 a. m. (Bogotá) en `Klarens2023/inventario-app`:

1. `pg_dump` de producción con el rol de solo lectura `app_respaldo` ([`scripts/crear-rol-respaldo.sql`](../scripts/crear-rol-respaldo.sql)). Revisa que la copia traiga las tablas principales.
2. La cifra con AES-256 (`gpg`) usando la clave `RESPALDO_CLAVE`. **Sin esa clave la copia no sirve**: debe estar también en el gestor de contraseñas.
3. La sube a Drive como `respaldo-neondb-AAAA-MM-DD_HHMM.dump.gpg` ([`scripts/respaldo-drive.mjs`](../scripts/respaldo-drive.mjs)) y borra las de más de 30 días (nunca la más reciente).
4. Los domingos, o a mano con **Run workflow**, baja de Drive la última copia, la descifra, la restaura en una base temporal de la rama de desarrollo, comprueba que tenga usuarios y la borra.

Si el workflow falla, GitHub envía un correo a la cuenta Klarens2023. Revisar también la pestaña **Actions**.

**Ojo con los horarios de GitHub Actions** (aplica también a la sincronización EDI):
- GitHub **no garantiza** los horarios en cuentas gratuitas: con carga alta descarta ejecuciones (el 26-27/10 la sincronización EDI corrió cada 4 a 6 horas en vez de cada 30 min). Por eso los horarios usan minutos poco comunes (no el minuto 0), y la sincronización EDI tiene además el Vercel Cron diario.
- En un repositorio público, GitHub **desactiva los workflows programados tras 60 días sin actividad** (avisa antes por correo). Cualquier commit reinicia el conteo; si ya se desactivaron: Actions → el workflow → **Enable workflow**.
- Si el fork de Klarens2023 se borra y se vuelve a crear, hay que habilitar Actions, recrear **todos** los secretos (`APP_URL`, `CRON_SECRET` y los de esta tabla) y subir un commit nuevo a `main` (Sync fork) para que los horarios se registren. Revisar además en Vercel → Settings → Git que siga conectado. Como respaldo de la sincronización EDI, `vercel.json` programa seis Vercel Cron diarios (Hobby solo permite uno al día por entrada; con seis queda cada ~4 h: 1, 5, 9, 13, 17 y 21 h de Bogotá, ±59 min) a `/api/logistica/ordenes-cen/sincronizar`; Vercel envía `CRON_SECRET` en el encabezado `Authorization`, así que debe ser el mismo valor de la variable de entorno.

### Secretos (Klarens2023/inventario-app → Settings → Secrets and variables → Actions)

| Secreto | Valor |
|---|---|
| `RESPALDO_DATABASE_URL` | Producción, rol `app_respaldo`, host **sin** `-pooler` |
| `RESPALDO_CLAVE` | Clave de cifrado (40 letras y números) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` | Los mismos de Vercel |
| `RESPALDO_DRIVE_FOLDER_ID` | Carpeta de Drive solo para respaldos, en la misma unidad compartida de las fotos |
| `PRUEBA_RESTAURACION_DATABASE_URL` | Rama de **desarrollo**, rol `neondb_owner` (si falta, no se prueba la restauración) |

## Cómo restaurar

### Dentro de las últimas 6 horas
Neon → **Backup & Restore** → elegir la hora → **Preview data** para revisar → **Restore**. Neon guarda el estado anterior por si hay que deshacer.

### Más de 6 horas atrás (desde el respaldo diario)
No se restaura encima de producción a ciegas: primero se carga en una base aparte, se revisa y luego se decide.

1. **Crear antes un snapshot** de producción en Neon, para poder deshacer.
2. En Drive, descargar el archivo del día que se necesita (`respaldo-neondb-….dump.gpg`).
3. Descifrarlo. En **Git Bash** (viene con Git para Windows), en la carpeta del archivo:
   ```bash
   gpg --pinentry-mode loopback --decrypt --output respaldo.dump respaldo-neondb-AAAA-MM-DD_HHMM.dump.gpg
   ```
   Pide la clave `RESPALDO_CLAVE`.
4. Necesitas `pg_restore` versión 17 o superior: instalador de PostgreSQL para Windows (postgresql.org), opción solo *Command Line Tools*.
5. En Neon (SQL Editor, rol `neondb_owner`) crear una base vacía: `CREATE DATABASE neondb_restaurado;`
6. Restaurar en esa base, con la cadena de `neondb_owner` (Neon → Connect, base `neondb_restaurado`):
   ```bash
   pg_restore --no-owner --no-acl --exit-on-error --dbname="postgresql://neondb_owner:...@.../neondb_restaurado?sslmode=require" respaldo.dump
   ```
7. Revisar los datos en `neondb_restaurado` y decidir:
   - **Recuperar solo algunas filas o tablas:** copiarlas a `neondb` con SQL.
   - **Volver a todo ese día:** cambiar `DATABASE_URL` en Vercel a `neondb_restaurado` (con el rol `app_operaciones`) y redesplegar. Antes, conectado a `neondb_restaurado`, darle permisos: las sentencias `GRANT` y `ALTER DEFAULT PRIVILEGES` de `scripts/crear-rol-app.sql`, cambiando `neondb` por `neondb_restaurado` (el `CREATE ROLE` no, porque el rol ya existe).
8. Borrar `respaldo.dump` del equipo: contiene todos los datos sin cifrar.
