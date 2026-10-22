# Riesgos pendientes y próximos pasos

## Acciones inmediatas (operación, fuera del código)

0. **Desplegar estos cambios** (primero en un *preview* de Vercel). La revisión externa del 22/10/2026 confirmó que producción sigue en Next 14.2.35, sin CSP y con `/contabilidad/conciliacion-facturas` abierta sin sesión; todo eso queda resuelto con el despliegue.
1. **Verificar credenciales por defecto (AUD-04).** Las contraseñas que publicaba el README siguen en el historial de Git. Confirmar que ningún usuario de producción las usa: iniciar sesión como `admin`, `usuario1`, `usuario2` con ellas debe fallar; si alguna entra, cambiarla de inmediato y revisar `audit_logs`. Si el repositorio es o fue público, tratarlas como comprometidas.
2. ~~Correr `scripts/migrate-add-indices-unicos.js` en producción~~: ya quedó aplicada el 22/10/2026 (la base de `.env.local` es la de producción).
2b. **Limpiar los datos de las pruebas guiadas**, que quedaron en producción: correr `limpieza-pruebas-auditoria.sql` en el SQL Editor de Neon (ver TESTING.md) y borrar en Google Drive la foto `…RG1_999999…`. Anular el pedido PVS-1 en Siesa QA.
2c. **Crear una base de desarrollo** (rama de Neon) y usarla en `.env.local` y en el Preview de Vercel: hoy el entorno local apunta a producción.
3. **Desplegar y probar** los pasos manuales de [TESTING.md](TESTING.md#lo-que-no-se-probó-y-cómo-probarlo) en un ambiente de pruebas antes de producción.

## Decisiones que requieren aprobación

| ID | Propuesta | Impacto en la operación |
|---|---|---|
| — | Ninguna pendiente: AUD-16, 18 y 20 se aplicaron y AUD-29 se aceptó (22/10/2026) | — |

## Riesgos técnicos pendientes (por prioridad)

| Prioridad | ID | Riesgo | Siguiente paso |
|---|---|---|---|
| 1 | AUD-17 | Bloqueo de cuentas ajenas (el tiempo del login ya está igualado) | Límite por IP con Vercel WAF o una tabla de intentos por IP |
| 3 | AUD-24 | CSP con `'unsafe-inline'` en scripts | Pasar a nonces por petición en el middleware |
| 4 | AUD-23 | Esquema no reproducible | `pg_dump --schema-only` versionado o migraciones numeradas |
| 5 | AUD-25 | Cobertura de pruebas baja | Pruebas de integración de rutas API contra una rama de Neon de pruebas; ESLint |
| 6 | AUD-26 | Higiene | Sacar `tsconfig.tsbuildinfo` de Git (`git rm --cached` + `.gitignore`) al hacer el commit |

## Riesgos aceptados

- **AUD-29:** placas libres en movimientos TIC (decisión del 22/10/2026).

- **AUD-19:** caché pública de fotos en la CDN (decisión de costos).
- Si la BD no responde al revalidar una sesión web, se usan los datos del token hasta su vencimiento (máx. 8–24 h) en vez de cerrar todas las sesiones (AUD-01).
- Si la función de Vercel se corta en medio del envío de un pedido EDI, la orden queda "enviada" sin consecutivo y se corrige con "Reversar" (AUD-07).

## Fuera del alcance revisado

- La app móvil (no está en este repositorio). Debe validarse que maneje los nuevos 401 (usuario desactivado) y 400 ("Valor inválido") de forma clara.
- Configuración de Vercel, Neon (roles, ramas, backups) y GitHub (visibilidad del repo, protección de ramas, secretos): no hubo acceso.
- Respaldo y recuperación: Neon ofrece restauración a un punto en el tiempo según el plan contratado; no se verificó la configuración. Recomendación: confirmar la ventana de retención y probar una restauración en una rama.
