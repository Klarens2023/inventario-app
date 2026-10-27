# Pruebas y verificaciones

## Comandos

```bash
npm test                 # pruebas unitarias (node --test, Node 22.6+; probado con Node 24.15)
npx tsc --noEmit -p .    # tipos
npx next build           # build de producción (lee .env.local)
npm audit --omit=dev     # vulnerabilidades de dependencias de producción
npm run lint             # ESLint (0 errores y 0 avisos desde el 26/10/2026)

# Integración (escriben en la BD: SOLO contra la rama de desarrollo de Neon).
# Requiere la app corriendo con `npx next build && npm start` en el puerto 3000.
BD_DESARROLLO_HOST=ep-broad-cake-anqz0ha7 npm run test:integracion
```

Las pruebas de integración (`tests/integracion/`) crean usuarios `it_*` con una
contraseña aleatoria, inician sesión como cada rol (cookie web y token móvil) y
los borran al final. Si `BD_DESARROLLO_HOST` no coincide con el host de
`DATABASE_URL`, no corren (protección contra producción).

Las pruebas viven en `tests/` y usan el runner nativo de Node con eliminación de
tipos de TypeScript (sin dependencias nuevas). Solo cubren módulos sin acceso a
la BD (importan con extensión `.ts`; por eso `tests/` está excluido de `tsconfig`).

## Bitácora de inicios de sesión (27/10/2026)

`npm run test:integracion` 20/20 (3 nuevas): inicio web y móvil registran `LOGIN_EXITOSO` con canal e IP; 4 contraseñas erradas dan `LOGIN_FALLIDO` y la 5.ª `LOGIN_BLOQUEADO`, sin más registros durante el bloqueo; un usuario inexistente no deja rastro. En el navegador, /auditoria muestra el evento con su etiqueta. (En local la hora sale corrida 5 horas porque el driver de Neon interpreta `timestamp` sin zona con la hora del equipo; en Vercel el servidor está en UTC y se ve bien.)

## Alerta de consumo de Neon (26/10/2026)

`.github/workflows/alerta-consumo.yml` en Klarens2023, ejecutado a mano con umbral 1% contra la API real de Neon: cómputo 25,0 de 100 CU-h (25%, proyección 30% al cierre), transferencia 0,05 de 5 GB, almacenamiento de la rama mayor 0,037 de 1 GB. Terminó en rojo como se esperaba. Con el umbral real (50%) hoy no alerta.

## Respaldo diario (26/10/2026)

Primera ejecución completa de `.github/workflows/respaldo-bd.yml` en Klarens2023: `pg_dump` de producción con `app_respaldo` (solo lectura), cifrado AES-256, subida a Drive (0.63 MB, tamaño verificado), descarga desde Drive, descifrado y `pg_restore` en una base temporal de la rama de desarrollo: 35 tablas, 32 usuarios y 6635 pagos, igual que producción vista con Preview data de Neon ese día. La protección contra usar producción como destino de la prueba se activó correctamente en un intento previo con el secreto mal puesto.

## Rol mínimo de BD en producción (26/10/2026)

Antes, en la rama de desarrollo: `next start` con `DATABASE_URL` de `app_operaciones` (confirmado quitando un permiso: el login pasó a 500 y volvió a 401 al devolverlo); `npm run test:integracion` 17/17, `npm test` 16/16; crear usuario, crear repuesto (secuencias), abrir y cerrar turno y escribir en la bitácora sin errores; único `permission denied` en el log, el provocado a propósito. En producción, tras cambiar `DATABASE_URL` en Vercel: `/api/salud` 200 con la BD respondiendo; el usuario inició sesión en la web y en la app móvil sin errores y sin `permission denied` en los logs.

## Resultados del 23/10/2026 (rama `mejoras-seguridad-2026-10-23`)

**Producción (commit `beb3c67`, revisión externa de solo lectura):** `/login` con CSP con nonce distinto en cada petición (13/13 scripts con nonce); `/api/salud` 200 con la BD respondiendo; `/api/inventario` y `/api/usuarios` 401 sin sesión con `default-src 'none'`; `/dashboard` y `/contabilidad/…` redirigen al login. El usuario confirmó: inicio de sesión, navegación, impresión de un movimiento TIC, app móvil (APK 1.1.0) funcionando y ningún aviso "Límite por IP desactivado" en los logs de Vercel (la tabla existe).

| Verificación | Resultado |
|---|---|
| `npx tsc --noEmit -p .` | 0 errores |
| `npm run lint` | 0 errores, 56 avisos |
| `npx next build` | correcto |
| `npm test` | 13/13 (incluye la prueba estática de rutas protegidas) |
| `npm run test:integracion` (rama de desarrollo) | 16/16: matriz de 43 casos de ruta × 8 roles + sin sesión, token móvil en rutas solo web, `alg: none`, usuario inactivo, cambio de contraseña pendiente, IDOR de pagos y fotos, líder contra líder, límite por IP (web y móvil) |
| Prueba de mutación | Se quitó a propósito un permiso y se agregó una ruta sin control: ambas pruebas fallaron como debían |
| CSP con nonce (navegador, build local) | 14 scripts con nonce, 0 sin nonce; un `<img onerror>` inyectado NO se ejecuta (violación `script-src-attr`); login, panel, usuarios, movimientos, repuestos y análisis cargan sin errores de consola |
| Impresión sin script en línea | El script en línea viejo queda bloqueado por la CSP nueva; el flujo nuevo imprime después de cargar el logo (probado en un iframe). **23/10: el usuario imprimió en su Chrome un movimiento TIC y un acta de repuestos; salieron bien, con el logo** |
| IPs de la empresa (`LOGIN_IPS_CONFIANZA`) | 3 pruebas unitarias del rango /29; 35 fallos desde 190.242.100.250 → siempre 401, sin bloqueo ni conteo guardado |
| Rol mínimo de BD (rama de desarrollo) | Lee y escribe datos; niega CREATE/ALTER/DROP, CREATE ROLE, y UPDATE/DELETE en `audit_logs` |
| `GET /api/salud` | 200 `{"ok":true,"bd":"ok"}`, `Cache-Control: no-store` |

## Resultados del 22/10/2026

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit -p .` (antes de cambios) | 0 errores |
| `npm audit --omit=dev` (antes) | 10 vulnerabilidades: 1 crítica (next), 6 altas, 3 moderadas |
| `npm audit fix` (sin `--force`) | Actualizó sharp, undici, brace-expansion, nanoid, source-map-js, qs |
| `npm audit --omit=dev` (después) | 4: next (crítica), postcss en next (alta), uuid vía exceljs (2 moderadas) |
| `npm test` | 11 pruebas, 11 correctas (incluye la de contraseña temporal). La primera ejecución **falló** y destapó AUD-15 (parser EDIFACT); se corrigió el código, no la prueba |
| Regresión del parser con muestras reales | 15 archivos de `muestras-cen/` (11 `.edi`, 4 `.hse`): salida idéntica entre la versión anterior y la corregida. Se corrió en local; las muestras no salen del equipo |
| `npx tsc --noEmit -p .` (después) | 0 errores |
| `npx next build` (después) | Correcto (76 páginas, middleware 49 kB) |
| Prueba de humo con `npm run dev`, sin sesión | `/dashboard` y `/contabilidad/conciliacion-facturas` → redirección al login; `/api/usuarios`, `/api/qr/pagos`, `/api/pvn/productos/1` → 401; Bearer con `alg=none` → 401; cron sin `CRON_SECRET` configurado → 503; sin errores en el log del servidor |
| Lint | No hay ESLint configurado en el proyecto: no se ejecutó |
| Prueba guiada con el usuario (`npm run dev` con la base de `.env.local`, que es la de **producción**; sesión admin iniciada por el usuario) | Ver abajo |

### Prueba guiada del 22/10/2026

> **Aclaración posterior:** estas pruebas se hicieron creyendo que la base de `.env.local` era de pruebas, pero **es la base de producción** (lo de pruebas era Siesa QA). Los datos de prueba quedaron en producción; no se borró ningún dato real. Ver «Datos que quedaron» y `limpieza-pruebas-auditoria.sql`.

Usuario de prueba `prueba.auditoria` (área Sistemas, módulos Equipos TI y Movimientos TIC), creado desde la interfaz:

| Caso | Resultado |
|---|---|
| Crear usuario | Modal "Usuario creado" con contraseña temporal de 10 caracteres y botón Copiar (AUD-03) |
| Login móvil con la temporal | 200, `debe_cambiar_password: true` |
| API con ese token antes de cambiar la contraseña | 401 (AUD-02) |
| Login con `123456` | 401 |
| `PUT /api/cambiar-password` con el token | 200; luego la API responde 200 |
| Desactivar el usuario → mismo token | 401; login también 401. Reactivar → mismo token 200 (AUD-01) |
| Quitar el módulo `movimientos_tic` → mismo token en `/api/sistemas/movimientos/TIC-0001` | 200 → 403 al quitarlo (inmediato) |
| Restablecer contraseña desde Editar | Modal "Contraseña restablecida" con clave nueva; el token anterior pasa a 401; la temporal anterior ya no entra y la nueva sí |
| Bitácora (`/api/auditoria`) | Registra creación, cambios y restablecimiento sin incluir ninguna contraseña |
| Formato imprimible de TIC-0004 con `<b>`, `<i>` y `<img onerror>` en origen, descripción y observaciones | Se ven como texto literal; ningún elemento inyectado ni script ejecutado (AUD-05). La ventana emergente se reemplazó por un iframe del mismo origen porque el panel de pruebas no abre ventanas emergentes |
| Log del servidor | Sin errores |

| Recarga de inventario (AUD-06): TXT sintético de 3 referencias cargado desde /cargar para el 28/10/2026 (modo ítems) | Carga correcta en una sola inserción; decimales `10,00` y `1.250,50` leídos bien |
| Conteo de AUD-001 (9 de 10) y acumulación del día | 200; el día queda bloqueado |
| Recargar el mismo TXT encima del día acumulado | Rechazado; la pantalla muestra "El inventario items del 2026-10-28 ya tiene 3 registro(s) acumulados (bloqueados): no se puede recargar encima." Mismos ids, conteo y observación conservados; el 11/08 (22 filas) intacto |
| Limpieza | "Reiniciar" con rango 28/10–28/10 borró solo las 3 filas de prueba; el 11/08 sigue con 22 filas |

| Doble envío de pedido EDI (AUD-07), Siesa **QA** (`SIESA_API_URL` sin definir → `apiqa.siesacloud.com`): orden #66, OC 4646721521 (STO 251 – Valledupar), dos POST simultáneos con `confirmaAlertas` | Uno respondió 200 "Pedido PVS-1 creado en Siesa."; el otro 422 "La orden ya se está enviando o ya tiene pedido en Siesa." (~25 s) |
| Verificación | Orden en estado `enviado` con consecutivo PVS-1; un tercer envío queda bloqueado; "Reversar" (que lista todos los pedidos vivos de la OC en Siesa) reporta solo PVS-1 |

| Migración `scripts/migrate-add-indices-unicos.js` (en producción) | Creó `ux_pvn_turnos_activo_dia` y `ux_pvn_registros_turno`; no había duplicados |
| Tres aperturas de turno simultáneas del usuario `pv` (PVV rotativo, token móvil) en Sede Principal (AUD-08) | Una 201 (turno #746) y dos 409 "Ya tienes un turno abierto hoy"; un solo turno activo |
| Tres registros de ventas simultáneos (sesión admin, 28/10/2026, turno PRUEBA-AUD, 2 productos, una cantidad enviada como texto "2") | Un solo registro (#1) con 2 productos y 5 unidades; los otros dos rechazados |
| Registro con una cantidad que no cabe en INTEGER | No dejó encabezado huérfano (el reintento del mismo turno entró, #4), pero respondía **500**. Se agregó validación de rango en `app/api/pvn/registros/route.ts`: ahora 400 |
| Registro repetido del mismo turno / cantidad decimal | 409 / 400 |
| Cierre del turno #746 de `pv` (foto de datafono sintética de 60×40 px, recogida 999999) | 200; turno cerrado |

### Segunda ronda (Next 15.5.28 + React 19, servidor de producción local `npm start`)

| Caso | Resultado |
|---|---|
| `npx tsc --noEmit`, `npm test`, `npx next build` | 0 errores; 11/11; build correcto (76 páginas) |
| `npm audit --omit=dev` | 4 avisos: postcss 8.4.31 empaquetado en Next (solo procesa el CSS propio en el build) y uuid vía exceljs (solo afecta v3/v5/v6 con `buf`; exceljs usa `v4()`): no aplican. `next` ya no aparece |
| Sesión de admin existente tras la actualización | Sigue válida (`/api/auth/session` → rol admin) |
| Encabezado CSP en `/dashboard` | Presente, sin `'unsafe-eval'` en producción; `X-XSS-Protection` retirado |
| Recorrido por dashboard, usuarios, pagos QR, órdenes EDI | Sin bloqueos de CSP en la consola; estilos y fuentes cargan |
| Proxy de fotos (AUD-27) | Admin: foto de un pago 200. `pv` (sin módulo de pagos): foto de su cierre de turno 200, foto de un pago ajeno 404 (sin caché). Id inexistente 404; id con caracteres raros 400. ~120 ms por consulta con 6 607 pagos |
| Edición de usuario con nombre válido + usuario repetido | 400 y el nombre no cambia (antes quedaba aplicado) |
| Módulo inexistente al editar | Se descarta; quedan solo los válidos |
| Orden EDI con id no numérico | 404 (antes 500) |
| Dos movimientos TIC simultáneos | TIC-0005 y TIC-0006, cada uno con sus 2 activos |
| Movimiento con placa no registrada | Se guarda (AUD-29, pendiente de decisión); tras AUD-28 el detalle muestra los 2 activos (antes 1) |
| Producto PVN con receta y edición de la receta | Producto y componentes completos en cada paso; ids de componentes con la misma regla que antes |
| Log del servidor | Sin errores |
| `guardarOrden` (EDI) | **No ejercitado en vivo**: requiere archivos nuevos en el SFTP. Cubierto por tipos y revisión; validar en la próxima sincronización |

Datos de prueba que quedaron **en la base de producción** (para limpiar con `limpieza-pruebas-auditoria.sql`, excepto el usuario, que queda desactivado): usuario `prueba.auditoria` (desactivado) y el movimiento `TIC-0004` (no hay endpoint para borrarlo). En Siesa QA: pedido PVS-1 de la OC 4646721521 (orden #66 en `enviado`); para repetir la prueba, anularlo en Siesa y usar "Reversar". PVN: turno #746 de `pv` (cerrado) y registros de ventas #1 y #4 del 28/10/2026 a nombre del admin. En la carpeta de Google Drive configurada en `.env.local` quedó la foto sintética del cierre del datafono (nombre con `RG1_999999`). La contraseña de `pv` se restableció y cambió durante la prueba. Segunda ronda: movimientos TIC-0005, TIC-0006 y TIC-0007 (este con la placa `NO-EXISTE`) y el producto PVN 3874 "PRUEBA AUDITORIA PRODUCTO" (inactivo).

## Lo que las pruebas cubren

- `tests/seguridad.test.ts`: `escapeHtml` (carga XSS), `valorMonetario` (formatos válidos y montos rechazados), `tieneModulo` con sesión revocada (rol vacío), `modulosPorDefecto`.
- `tests/parser-edi.test.ts`: lectura EDIFACT con escape `?+`, reparto por tienda, IVA, fechas; formato Subrik; orden sin líneas rechazada; `codigoRelacion`.

## Lo que NO se probó (y cómo probarlo)

Todos los pasos (1 a 6) ya se probaron en la prueba guiada (arriba), salvo la redirección de la
pantalla web al login tras desactivar (se probó por API). Siguen pendientes:

1. **Revocación:** iniciar sesión con un usuario de prueba; desde otro navegador, admin lo desactiva; en la primera sesión cualquier acción debe dar 401/403 y al navegar debe ir al login. Repetir con el token de la app móvil.
2. **Cambio obligatorio:** restablecer la contraseña de un usuario de prueba, entrar, y desde la consola del navegador llamar `fetch('/api/usuarios')`: debe dar 403/401 hasta cambiarla.
3. **Inventario acumulado:** cargar un TXT, acumular el día, volver a cargar el mismo día y modo: debe responder 409 y conservar el conteo.
4. **Pedido EDI:** con Siesa QA, pulsar "Crear pedido" dos veces rápido: solo uno debe crearse.
5. **Registro PVN y turno:** registrar ventas y abrir turno; tras correr `scripts/migrate-add-indices-unicos.js`, un doble envío debe dar 409.
6. **Impresión TIC:** crear un movimiento con observación `<b>prueba</b>` e imprimir: debe verse el texto literal.

Que estas pruebas pasen no demuestra que la aplicación esté libre de vulnerabilidades: solo cubre los comportamientos descritos.

### Revisión externa pasiva de producción (22/10/2026, autorizada por el usuario)

Sitio: `https://operaciones.klarens.com.co` (Vercel, región iad1). Solo peticiones GET/HEAD
puntuales sin sesión, más un único POST al login móvil con un cuerpo que no es JSON (sin
usuario ni contraseña). Sin escaneos masivos, intentos de acceso ni explotación.

| Revisión | Resultado |
|---|---|
| Versión desplegada | **Next 14.2.35** (leído del código público): la actualización a 15.5.28 aún **no está desplegada** |
| Encabezados | HSTS, X-Frame-Options, nosniff, Referrer-Policy y Permissions-Policy presentes; **sin CSP** y con `X-XSS-Protection` (configuración anterior) |
| Optimizador de imágenes `/_next/image` | Activo con imágenes locales (200); rechaza orígenes externos (400). En Vercel lo atiende el servicio de imágenes de la plataforma, por lo que la exposición al aviso crítico de AVIF es menor que en un servidor propio; el aviso de Windows no aplica (Linux) |
| 13 APIs sin sesión (usuarios, auditoría, inventario, pagos, fotos, PVN, órdenes EDI, equipos, movimientos, áreas, acumulados) | Todas 401 `{"error":"No autorizado"}`, sin datos |
| Cron de sincronización sin clave o con clave falsa | 401 |
| `/.env`, `/.env.local`, `/.git/*`, `schema.sql`, `package.json`, `README.md`, `scripts/`, `docs/`, `muestras-cen/` | 404 (no se publican) |
| Mapas de código fuente (`.js.map`) | 404 |
| `/api/auth/providers`, `/api/auth/csrf`, `/api/auth/session` | 200 con información estándar de NextAuth (nombre del proveedor, token CSRF, sesión vacía): esperado |
| Páginas protegidas sin sesión | `/dashboard`, `/admin/usuarios`, `/auditoria`, `/pvn/pagos-qr`, `/logistica/ordenes-cen` → 307 al login. **`/contabilidad/conciliacion-facturas` → 200 sin sesión** (AUD-11 confirmado en producción; corregido localmente, falta desplegar). La pantalla procesa archivos en el navegador y no trae datos del servidor |
| Errores (rutas inexistentes, ids raros) | 404/401 genéricos, sin trazas, SQL ni rutas internas |
| Login móvil con cuerpo no JSON | 500 sin cuerpo (no filtra nada); corregido localmente (400) |

Conclusión: el perímetro sin sesión de producción está bien cerrado; los dos hallazgos
visibles desde fuera (Next 14 vulnerable y `/contabilidad` abierta) ya están corregidos en
el código y se resuelven al desplegar estos cambios.

### Decisiones aplicadas (22/10/2026, servidor de producción local)

Usuario de prueba `prueba.auditoria` como líder de Sistemas, con sesión web propia (curl contra localhost):

| Caso | Resultado |
|---|---|
| `/contabilidad/conciliacion-facturas` sin sesión (AUD-11) | 307 al login |
| La misma pantalla como líder sin el módulo | 307 al dashboard |
| Cambio obligatorio con 7 caracteres / igual a la temporal / válida sin actual (AUD-18) | 400 / 400 / 200 |
| Cambio voluntario sin actual / actual incorrecta / correcta | 400 / 403 / 200 |
| Líder restablece a otro líder de su área (AUD-16) | 403 "Solo un administrador puede modificar a otro líder" |
| Líder edita a un usuario de su área (sin cambios) | 200 (deja un registro "Modificó usuario" de `cissa` en la bitácora de pruebas) |
| Líder sube a un usuario a líder / crea un líder | 400 "Rol inválido" / 403 |
| AUD-20 | Verificado por revisión: la consulta usa `turno_id` como el cierre forzado del admin. No se probó en vivo (requiere subir pagos con foto a Drive) |
| Log del servidor | Sin errores |

Al final `prueba.auditoria` quedó desactivado de nuevo.

### Revisión externa del preview de Vercel (rama `auditoria-seguridad-2026-10`, 22/10/2026)

El preview está protegido con **Vercel Authentication** (sin sesión de Vercel todo redirige al login de Vercel, con `X-Robots-Tag: noindex`). El usuario inició sesión en Vercel en la pestaña de pruebas; la revisión se hizo desde ahí, **sin sesión de la app** y solo con GET.

| Revisión | Resultado |
|---|---|
| Versión | **Next 15.5.28** |
| Encabezados | CSP presente (sin `'unsafe-eval'`), `X-XSS-Protection` retirado, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy |
| 13 APIs sin sesión de la app | Todas 401 sin datos |
| Cron de sincronización | 503 "CRON_SECRET no está configurado": la variable no está definida para Preview (correcto: el cron solo corre contra producción) |
| Páginas protegidas, incluida `/contabilidad/conciliacion-facturas` | Redirigen al login (AUD-11 corregido en el despliegue) |
| `/.env`, `/.git`, `schema.sql`, `package.json`, `README.md`, `scripts/`, `docs/`, `limpieza-pruebas-auditoria.sql`, `muestras-cen` | 404 |
| Mapas de código fuente | 404 |
| Optimizador de imágenes | Local 200, origen externo 400 |
| Errores | 404/401 genéricos, sin trazas ni SQL |
| Consola del navegador en `/login` | Sin errores ni bloqueos de CSP |

Pendiente de probar por el usuario con sesión de la app en el preview: usuarios, Pagos QR con fotos y una orden EDI.

### Revisión externa final de producción, ya desplegada (22/10/2026)

`https://operaciones.klarens.com.co` con el commit `f774aa3` (Klarens2023/inventario-app). Solo GET/HEAD sin sesión.

| Revisión | Resultado |
|---|---|
| Versión | **Next 15.5.28** (antes 14.2.35) |
| Encabezados | CSP presente, `X-XSS-Protection` retirado, HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy |
| 13 APIs sin sesión | Todas 401 |
| Cron sin clave / con clave falsa | 401 / 401 |
| Archivos sensibles y mapas de código | 404 |
| Páginas protegidas, incluida `/contabilidad/conciliacion-facturas` | 307 al login (AUD-11 resuelto en producción) |
| Errores | Sin trazas, SQL ni rutas internas |
