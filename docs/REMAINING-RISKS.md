# Riesgos pendientes y próximos pasos

## Acciones inmediatas (operación, fuera del código)

0. ~~Desplegar estos cambios~~: desplegado el 22/10/2026 (Next 15.5.28, CSP y `/contabilidad` protegida, verificado desde fuera).
1. **Verificar credenciales por defecto (AUD-04).** Las contraseñas que publicaba el README siguen en el historial de Git. Confirmar que ningún usuario de producción las usa: iniciar sesión como `admin`, `usuario1`, `usuario2` con ellas debe fallar; si alguna entra, cambiarla de inmediato y revisar `audit_logs`. Si el repositorio es o fue público, tratarlas como comprometidas.
2. ~~Correr `scripts/migrate-add-indices-unicos.js` en producción~~: ya quedó aplicada el 22/10/2026 (la base de `.env.local` es la de producción).
2b. ~~Limpiar los datos de las pruebas guiadas~~ (hecho el 22/10/2026; quedan por confirmar la foto de Drive y el pedido PVS-1 en Siesa QA):, que quedaron en producción: correr `limpieza-pruebas-auditoria.sql` en el SQL Editor de Neon (ver TESTING.md) y borrar en Google Drive la foto `…RG1_999999…`. Anular el pedido PVS-1 en Siesa QA.
2c. ~~Crear una base de desarrollo~~: rama de Neon creada; `.env.local` apunta a ella desde el 22/10/2026.
3. **Desplegar y probar** los pasos manuales de [TESTING.md](TESTING.md#lo-que-no-se-probó-y-cómo-probarlo) en un ambiente de pruebas antes de producción.
4. ~~Desplegar la rama `mejoras-seguridad-2026-10-23`~~: desplegada el 23/10/2026 (commit `beb3c67`), con la tabla `login_intentos_ip` y la variable `LOGIN_IPS_CONFIANZA` en producción. Ver [REVISION-2026-10-23.md](REVISION-2026-10-23.md).
5. ~~Monitoreo~~: hecho el 26/10/2026 en UptimeRobot, con aviso al correo de sistemas. Monitor `Operaciones - sitio` sobre `/login`, cada 5 min y sin tocar la BD. Monitor `Operaciones - base de datos` tipo Keyword `"ok":true` sobre `/api/salud`, cada 60 min para no mantener despierto el cómputo de Neon.
6. ~~Rol mínimo de BD~~: hecho el 26/10/2026. Producción usa `app_operaciones` (creado con `scripts/crear-rol-app.sql`). Las migraciones se corren con la cadena de `neondb_owner`, que se copia en Neon → Connect y ya no está en Vercel.

7. **Respaldos:** Neon (plan actual) solo restaura las últimas 6 horas (comprobado el 26/10/2026 con Preview data). Se agregó un respaldo diario cifrado en Drive con 30 días y prueba semanal de restauración ([RESPALDOS.md](RESPALDOS.md)); activo desde el 26/10/2026: la primera ejecución restauró 35 tablas, 32 usuarios y 6635 pagos en una base temporal. La rama `production` de Neon no está protegida (Branch protection).

8. **Consumo y planes (revisado el 26/10/2026):** en Vercel Hobby el equipo (inventario-app + klarens-frontend) usa el 34% de la CPU activa (81 de 240 min/mes; inventario-app 51 min). Lo demás está por debajo del 15%. En Neon Free, `inventario` usa unas 25 CU-h de 100 al mes. Si se pasa del límite, **Vercel pausa los dos proyectos y Neon suspende la base** hasta el mes siguiente. Neon tiene una alerta diaria al 50% ([`.github/workflows/alerta-consumo.yml`](../.github/workflows/alerta-consumo.yml)). Vercel Hobby no expone el consumo por API (`/v1/billing/charges` responde *costs not found*): solo envía sus propios correos al acercarse al límite. Además, Hobby es para uso personal no comercial: se recomienda Vercel Pro (alertas de gasto al 50/75/100%).

## Decisiones que requieren aprobación

| ID | Propuesta | Impacto en la operación |
|---|---|---|
| — | Ninguna pendiente: AUD-16, 18 y 20 se aplicaron y AUD-29 se aceptó (22/10/2026) | — |

## Riesgos técnicos pendientes (por prioridad)

| Prioridad | ID | Riesgo | Siguiente paso |
|---|---|---|---|
| 1 | AUD-17 | Bloqueo de cuentas ajenas: quien conozca un usuario puede bloquearlo 15 min con 5 fallos (el límite por IP del 23/10 lo frena desde una sola conexión, no desde muchas) | Vercel WAF / Attack Challenge si se observa abuso; 2FA para administradores |
| 4 | AUD-25 | Las pruebas de integración cubren autorización, no la lógica de negocio de cada ruta (cálculos, Excel, EDI) | Agregar casos por módulo a `tests/integracion/` |
| 4 | — | App móvil en Expo SDK 54 (la última es 58): 41 alertas de npm, casi todas de herramientas de compilación | 23/10: APK 1.2.0 con SDK 58 (rama `prueba/expo-sdk58`) probado en teléfono: login, turno, pagos QR con cámara y galería, cierre de datáfono e historial OK. Falta unirlo a `main` del repo móvil y distribuirlo |
| 6 | AUD-26 | Higiene | Sacar `tsconfig.tsbuildinfo` de Git (`git rm --cached` + `.gitignore`) al hacer el commit |

## Riesgos aceptados

- **AUD-29:** placas libres en movimientos TIC (decisión del 22/10/2026).

- **AUD-19:** caché pública de fotos en la CDN (decisión de costos).
- **Repositorios públicos (decisión del 26/10/2026):** `louis-rook/inventario-app`, `Klarens2023/inventario-app` y los dos de `control-pv-mobile` siguen públicos; cualquiera puede leer el código y su historial. Se revisó el historial completo (171 y 46 commits): no hay archivos `.env`, llaves ni cadenas de conexión reales; solo valores de ejemplo (`user:password@ep-xxx`). Lo único sensible del historial son las contraseñas por defecto que publicaba el README (AUD-04), que ya no deben estar en uso. Regla mientras sigan públicos: nunca subir secretos, IPs internas ni datos de clientes; `npm test` y `.gitignore` (`.env*.local`) ayudan, pero hay que revisar cada commit. Para hacerlos privados: primero `louis-rook/…` (GitHub separa el fork de Klarens2023, que sigue público), luego `Klarens2023/…`; confirmar en GitHub → Settings → Applications → Vercel que tiene acceso al repositorio y probar con un Redeploy. Desde ahí no hay "Sync fork": se despliega con `git push klarens main`. En plan Hobby, Vercel puede bloquear despliegues de repositorios privados si el autor del commit no es el dueño de la cuenta.
- Si la BD no responde al revalidar una sesión web, se usan los datos del token hasta su vencimiento (máx. 8–24 h) en vez de cerrar todas las sesiones (AUD-01).
- Si la función de Vercel se corta en medio del envío de un pedido EDI, la orden queda "enviada" sin consecutivo y se corrige con "Reversar" (AUD-07).

## Fuera del alcance revisado

- La app móvil (no está en este repositorio). Debe validarse que maneje los nuevos 401 (usuario desactivado) y 400 ("Valor inválido") de forma clara.
- Configuración de Vercel, Neon (roles, ramas, backups) y GitHub (visibilidad del repo, protección de ramas, secretos): no hubo acceso.
- Respaldo y recuperación: Neon ofrece restauración a un punto en el tiempo según el plan contratado; no se verificó la configuración. Recomendación: confirmar la ventana de retención y probar una restauración en una rama.
