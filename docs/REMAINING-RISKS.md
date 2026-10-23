# Riesgos pendientes y próximos pasos

## Acciones inmediatas (operación, fuera del código)

0. ~~Desplegar estos cambios~~: desplegado el 22/10/2026 (Next 15.5.28, CSP y `/contabilidad` protegida, verificado desde fuera).
1. **Verificar credenciales por defecto (AUD-04).** Las contraseñas que publicaba el README siguen en el historial de Git. Confirmar que ningún usuario de producción las usa: iniciar sesión como `admin`, `usuario1`, `usuario2` con ellas debe fallar; si alguna entra, cambiarla de inmediato y revisar `audit_logs`. Si el repositorio es o fue público, tratarlas como comprometidas.
2. ~~Correr `scripts/migrate-add-indices-unicos.js` en producción~~: ya quedó aplicada el 22/10/2026 (la base de `.env.local` es la de producción).
2b. ~~Limpiar los datos de las pruebas guiadas~~ (hecho el 22/10/2026; quedan por confirmar la foto de Drive y el pedido PVS-1 en Siesa QA):, que quedaron en producción: correr `limpieza-pruebas-auditoria.sql` en el SQL Editor de Neon (ver TESTING.md) y borrar en Google Drive la foto `…RG1_999999…`. Anular el pedido PVS-1 en Siesa QA.
2c. ~~Crear una base de desarrollo~~: rama de Neon creada; `.env.local` apunta a ella desde el 22/10/2026.
3. **Desplegar y probar** los pasos manuales de [TESTING.md](TESTING.md#lo-que-no-se-probó-y-cómo-probarlo) en un ambiente de pruebas antes de producción.
4. ~~Desplegar la rama `mejoras-seguridad-2026-10-23`~~: desplegada el 23/10/2026 (commit `beb3c67`), con la tabla `login_intentos_ip` y la variable `LOGIN_IPS_CONFIANZA` en producción. Ver [REVISION-2026-10-23.md](REVISION-2026-10-23.md).
5. **Monitoreo:** registrar `https://operaciones.klarens.com.co/api/salud` en un monitor externo gratuito (p. ej. UptimeRobot) con aviso por correo.
6. **Rol mínimo de BD:** correr `scripts/crear-rol-app.js` en producción y cambiar `DATABASE_URL` de Vercel a ese rol (las migraciones siguen con el dueño).

## Decisiones que requieren aprobación

| ID | Propuesta | Impacto en la operación |
|---|---|---|
| — | Ninguna pendiente: AUD-16, 18 y 20 se aplicaron y AUD-29 se aceptó (22/10/2026) | — |

## Riesgos técnicos pendientes (por prioridad)

| Prioridad | ID | Riesgo | Siguiente paso |
|---|---|---|---|
| 1 | AUD-17 | Bloqueo de cuentas ajenas: quien conozca un usuario puede bloquearlo 15 min con 5 fallos (el límite por IP del 23/10 lo frena desde una sola conexión, no desde muchas) | Vercel WAF / Attack Challenge si se observa abuso; 2FA para administradores |
| 4 | AUD-25 | Las pruebas de integración cubren autorización, no la lógica de negocio de cada ruta (cálculos, Excel, EDI) | Agregar casos por módulo a `tests/integracion/` |
| 4 | — | App móvil en Expo SDK 54 (la última es 58): 41 alertas de npm, casi todas de herramientas de compilación | Rama `prueba/expo-sdk58` lista (tsc, expo-doctor y bundle OK); falta build EAS y prueba en teléfono |
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
