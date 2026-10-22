# Hallazgos

Escala: **Crítico**, **Alto**, **Medio**, **Bajo**, **Informativo**.
Tipo: *Confirmado* (evidencia en el código), *Potencial* (depende de condiciones
no verificables desde el repositorio), *Recomendación*.
Estado: **Corregido** (cambio aplicado y verificado como se indica),
**Parcial**, **Pendiente**, **Aceptado** (riesgo asumido y documentado).

| ID | Severidad | Tipo | Título | Estado |
|---|---|---|---|---|
| AUD-01 | Alto | Confirmado | Sesiones no revocables: usuarios desactivados o con permisos retirados seguían operando | Corregido |
| AUD-02 | Medio | Confirmado | El cambio obligatorio de contraseña se podía saltar | Corregido |
| AUD-03 | Alto | Confirmado | Contraseña genérica fija `123456` para usuarios nuevos y restablecidos | Corregido (aprobado 22/10/2026) |
| AUD-04 | Alto | Confirmado / Potencial | Credenciales por defecto publicadas en README y `setup-db.js` las reimponía | Parcial |
| AUD-05 | Medio | Confirmado | XSS almacenado en el formato imprimible de movimientos TIC | Corregido |
| AUD-06 | Alto | Confirmado | Recargar inventario borraba conteos ya acumulados y la carga no era atómica | Corregido |
| AUD-07 | Medio | Confirmado | Doble envío del mismo pedido EDI a Siesa por concurrencia | Corregido |
| AUD-08 | Medio | Confirmado | Duplicados por carrera en turnos y registros PVN; registro no atómico | Corregido (código e índices ya en producción) |
| AUD-09 | Bajo | Confirmado | Montos de pagos QR sin límite (Infinity, desbordamiento) | Corregido |
| AUD-10 | Bajo | Confirmado | Inyección de marcado en el banner SVG de las fotos de pago | Corregido |
| AUD-11 | Medio | Confirmado | `/contabilidad/*` sin control de módulo en el middleware | Corregido |
| AUD-12 | Bajo | Confirmado | JWT móvil verificado sin fijar algoritmo | Corregido |
| AUD-13 | Crítico | Confirmado | Next.js 14.2.35 con avisos críticos (RCE en optimizador de imágenes y en servidores Windows) | Corregido: Next 15.5.28 + React 19 |
| AUD-14 | Medio | Confirmado | Dependencias con vulnerabilidades corregibles sin cambios mayores | Corregido (parcial: quedan las que exigen versión mayor) |
| AUD-15 | Bajo | Confirmado | Parser EDIFACT perdía caracteres escapados (`?+`, `?:`) | Corregido |
| AUD-16 | Medio | Confirmado | Un líder puede restablecer la contraseña de otro líder de su área y suplantarlo | Corregido (aprobado 22/10/2026) |
| AUD-17 | Bajo | Confirmado | Bloqueo por intentos permite bloquear cuentas ajenas y enumerar usuarios | Parcial (tiempo igualado; falta límite por IP) |
| AUD-18 | Bajo | Confirmado | Política de contraseñas débil; el cambio no pide la contraseña actual | Corregido (aprobado 22/10/2026) |
| AUD-19 | Bajo | Confirmado | Fotos de pagos servidas con caché pública en la CDN | Aceptado (decisión previa documentada) |
| AUD-20 | Medio | Confirmado (funcional) | El resumen al cerrar turno suma por día, no por turno | Corregido (aprobado 22/10/2026) |
| AUD-21 | Bajo | Confirmado | Ids consecutivos con `MAX()+1` (equipos, movimientos, repuestos, productos) | Corregido (reintento ante duplicado) |
| AUD-22 | Bajo | Confirmado | Escrituras de varias sentencias sin transacción | Corregido |
| AUD-23 | Informativo | Confirmado | `schema.sql` desactualizado: la BD no se puede reconstruir desde el repo | Corregido (`db/esquema.sql`) |
| AUD-24 | Informativo | Recomendación | Sin Content-Security-Policy | Corregido |
| AUD-25 | Informativo | Confirmado | Sin pruebas automatizadas ni configuración de lint | Parcial |
| AUD-26 | Informativo | Confirmado | Higiene del repositorio y entradas no validadas que terminan en 500 | Parcial (falta sacar `tsconfig.tsbuildinfo` de Git) |
| AUD-27 | Bajo | Confirmado | `/api/qr/foto` entrega cualquier archivo de la cuenta de servicio a cualquier usuario autenticado | Corregido |
| AUD-28 | Medio | Confirmado (funcional) | El detalle y el formato impreso de un movimiento TIC omitían los activos con placa escrita a mano | Corregido |
| AUD-29 | Bajo | Confirmado | Los movimientos TIC aceptan placas que no existen en Equipos TI | Aceptado (decisión 22/10/2026) |
| AUD-30 | Alto (funcional) | Confirmado | Restablecer la propia contraseña dejaba la cuenta sin acceso (error de la app antes de mostrar la temporal) | Corregido |
| AUD-31 | Alto (dinero) | Confirmado | Montos con punto de miles («25.000») se guardaban como $25 en los formularios de pagos QR (web y móvil) | Corregido |
| AUD-32 | Medio (funcional) | Confirmado | Pantallas que se caían («Application error») cuando la API respondía error | Corregido |

---

### AUD-01 — Sesiones no revocables · Alto · Corregido
- **Ubicación:** `lib/auth.ts` (callback `jwt`), `lib/api-auth.ts`, `middleware.ts`.
- **Descripción:** rol, módulos y punto de venta se copiaban al JWT al iniciar sesión y nunca se volvían a leer. Desactivar un usuario (`PUT /api/usuarios/[id]` con `activo:false`) o quitarle módulos no tenía efecto hasta que vencía el token: 8 h (admin/líder/usuario), 24 h (pvn/pvv) y **30 días** el token de la app móvil.
- **Explotación:** un empleado retirado con un token móvil vigente sigue registrando/consultando pagos hasta 30 días; un usuario degradado conserva permisos de admin hasta 8 h.
- **Corrección:** `lib/estadoUsuario.ts` lee el estado real (una consulta por PK). El callback `jwt` lo aplica en cada lectura de sesión y marca `revocado` si el usuario está inactivo; la sesión revocada se publica sin rol ni módulos y `getAuthUser` la rechaza; el middleware manda al login. El token móvil se revalida igual en `getAuthUser`.
- **Decisión:** si la BD falla al revalidar la sesión web se conservan los datos del token (comportamiento anterior) para no cerrar todas las sesiones por un fallo transitorio; para el token móvil, en cambio, se rechaza (500).
- **Verificación:** `tsc` y `next build` sin errores; prueba de humo sin sesión (401/redirect). **No se probó con usuarios reales** (no se ingresaron credenciales): ver TESTING.md, pasos manuales.

### AUD-02 — Cambio obligatorio de contraseña evitable · Medio · Corregido
- **Ubicación:** `lib/auth.ts` (antes: `trigger === 'update'` copiaba `session.debe_cambiar_password` enviado por el navegador); rutas con `getServerSession`.
- **Evidencia:** cualquier usuario con contraseña genérica podía llamar `update({ debe_cambiar_password: false })` (POST a `/api/auth/session`) y la marca se quitaba sin cambiar la contraseña. Además, ~40 rutas usan `getServerSession` directamente y no revisaban la marca (solo lo hacía `getAuthUser`).
- **Corrección:** la marca sale de la BD en cada lectura; con cambio pendiente la sesión se publica sin rol ni módulos, así que todas las rutas niegan el acceso salvo `/api/cambiar-password`.

### AUD-03 — Contraseña genérica fija · Alto · Corregido
- **Ubicación:** `app/api/usuarios/route.ts:9`, `app/api/usuarios/[id]/route.ts:8`, textos en `components/usuarios/ModalCrear.tsx` y `ModalEditar.tsx`.
- **Descripción:** todo usuario nuevo o restablecido queda con `123456`. Quien conozca el nombre de usuario (suelen ser predecibles) puede entrar antes que el titular y fijar su propia contraseña: el cambio obligatorio no lo impide.
- **Corrección (aprobada por el usuario):** `lib/passwordTemporal.ts` genera 10 caracteres aleatorios con `crypto.randomInt` (alfabeto sin 0/O/1/l/I). `POST /api/usuarios` y `PUT /api/usuarios/[id]` con `resetPassword` guardan solo el hash y devuelven `password_temporal` una única vez (`Cache-Control: no-store`); `components/usuarios/ModalPasswordTemporal.tsx` la muestra con botón Copiar y no se guarda en el navegador. Prueba en `tests/seguridad.test.ts`.
- **Cambio de operación:** quien crea o restablece la cuenta debe entregar esa clave al usuario; si se pierde, se restablece otra vez.

### AUD-04 — Credenciales por defecto publicadas · Alto · Parcial
- **Evidencia:** `README.md` listaba usuario y contraseña de `admin`, `usuario1`, `usuario2`; `scripts/setup-db.js` las tenía en el código y, por `ON CONFLICT DO UPDATE`, volvía a poner la contraseña conocida de `admin` cada vez que se corría.
- **Corrección aplicada:** el script genera contraseñas temporales aleatorias (o las toma de `SETUP_PASSWORD_*`), marca cambio obligatorio y no toca usuarios existentes; el README ya no las muestra.
- **Pendiente:** los valores siguen en el historial de Git. **Verificar en producción** que ninguna cuenta use esas contraseñas (ver REMAINING-RISKS.md). No se consultó la BD de producción.

### AUD-05 — XSS almacenado en impresión de movimientos TIC · Medio · Corregido
- **Ubicación:** `components/movimientos/imprimirMovimiento.ts`.
- **Evidencia:** nombres, documentos, áreas, descripciones y observaciones se insertaban sin escapar en un HTML que se escribe con `document.write` en una ventana del mismo origen.
- **Explotación:** un usuario con `movimientos_tic` guarda `<img src=x onerror=...>` en "observaciones"; cuando un admin imprime el formato, el script corre con su sesión (p. ej. crea un usuario admin vía `/api/usuarios`).
- **Corrección:** `lib/html.ts` (`escapeHtml`) aplicado a todos los datos variables. El formato de repuestos (`components/repuestos/imprimir.ts`) ya escapaba.
- **Prueba:** `tests/seguridad.test.ts`.

### AUD-06 — Recarga de inventario sobre datos acumulados · Alto · Corregido
- **Ubicación:** `app/api/inventario/route.ts` (POST).
- **Evidencia:** la carga borraba las filas de la fecha+modo+tipo sin mirar `acumulado`; el `ON DELETE CASCADE` borraba también los conteos ya cerrados (que `/api/conteo` prohíbe modificar). Además hacía un `INSERT` por fila: un fallo a mitad dejaba la fecha incompleta.
- **Corrección:** 409 si alguna fila a reemplazar está acumulada; borrado + inserción masiva (`unnest`) en `sql.transaction`.
- **Cambio de comportamiento:** ya no se puede recargar encima de un día acumulado (antes se podía, perdiendo el conteo). Si se necesita, un admin debe usar "Reiniciar" para esa fecha.

### AUD-07 — Doble envío de pedido a Siesa · Medio · Corregido
- **Ubicación:** `lib/cen/pedidoSiesa.ts` (`enviarPedido`).
- **Evidencia:** la validación ("ya existe pedido con esta OC") y el envío no eran atómicos; dos clics o dos usuarios a la vez podían crear dos pedidos.
- **Corrección:** antes de llamar a Siesa, un `UPDATE ... WHERE estado IN ('pendiente','error')` reserva la orden (queda `enviado`); el segundo intento recibe "ya se está enviando". Si la llamada falla por red se libera la reserva. Si la función se corta a mitad (timeout de Vercel), la orden queda `enviado` sin consecutivo: se corrige con "Reversar", que verifica en Siesa.

### AUD-08 — Duplicados por carrera en PVN · Medio · Parcial
- **Evidencia:** "un turno abierto por día" y "un registro por turno" solo se validan con un SELECT previo; no hay restricción única. El registro de ventas insertaba el detalle fila por fila.
- **Corrección aplicada:** el registro y su detalle se insertan en una sola sentencia; se valida el detalle; los dos endpoints traducen la violación de unicidad (23505) a 409.
- **Migración:** `scripts/migrate-add-indices-unicos.js` se corrió el 22/10/2026 en la base de `.env.local`, que resultó ser la de **producción**: los índices ya están aplicados allá (no había duplicados). Se probó con envíos simultáneos (ver TESTING.md). La prueba también destapó un 500 con cantidades fuera del rango INTEGER, ya corregido (400).

### AUD-09 — Montos de pagos QR · Bajo · Corregido
`parseFloat` aceptaba `1e999` (Infinity) y valores que no caben en `NUMERIC(14,2)` (500 al insertar). `lib/validacion.ts` (`valorMonetario`) los rechaza manteniendo los formatos que ya enviaban los clientes. Prueba en `tests/seguridad.test.ts`.

### AUD-10 — Marcado en el banner SVG · Bajo · Corregido
`agregarEtiqueta` (`app/api/qr/pagos/route.ts`) interpolaba el nombre del punto y del usuario en un SVG que procesa `sharp`/librsvg. Un `&` o `<` rompía el banner (se perdía en silencio) y permitía inyectar elementos SVG. Ahora se escapa.

### AUD-11 — `/contabilidad` sin control de módulo · Medio · Corregido
El `matcher` del middleware no incluía `/contabilidad`, así que cualquier usuario autenticado (incluido pvn/pvv) abría la conciliación de facturas. El procesamiento es local en el navegador (no expone datos del servidor), pero es una pantalla restringida por módulo. Se agregó al `matcher` y al mapa ruta→módulo.

### AUD-12 — Algoritmo del JWT móvil · Bajo · Corregido
Se firma y verifica explícitamente con HS256 (`algorithms: ['HS256']`). Prueba de humo: un token `alg=none` recibe 401.

### AUD-13 — Next.js 14.2.35 · Alto (Crítico según npm audit) · Pendiente
`npm audit` reporta para todo el rango hasta 16.3.0-preview avisos críticos/altos (DoS en Server Components y en el optimizador de imágenes, envenenamiento de caché de redirecciones del middleware, smuggling en rewrites, SSRF en Server Actions…). Aplicabilidad: la app usa App Router, middleware con redirecciones y `next/image`; no usa Server Actions, rewrites ni i18n. Corregirlo exige actualizar a una versión mayor (15/16) con cambios incompatibles (APIs asíncronas `cookies()/headers()`, `params` como Promise, next-auth v4). **No se actualizó automáticamente**; ver plan en REMAINING-RISKS.md.

### AUD-14 — Dependencias · Medio · Corregido (parcial)
`npm audit fix` (sin `--force`) actualizó dentro de los rangos declarados: sharp 0.35.3→0.35.5 (libheif/librsvg), undici, brace-expansion, nanoid, source-map-js, qs. Producción pasó de 10 a 4 avisos. Quedan: next (AUD-13), postcss empaquetado en next, uuid vía exceljs (moderado; solo aplica si se pasa `buf` a uuid v3/v5/v6, exceljs no lo hace). En desarrollo quedan braces/postcss de Tailwind (solo build).

### AUD-15 — Escape EDIFACT · Bajo · Corregido
`separar()` quitaba el carácter de escape `?` en el primer nivel (segmentos), así que un `?+` llegaba como `+` al separar elementos y cortaba la descripción. Ahora solo se desescapa a nivel de componentes. Verificado: las 15 muestras reales locales (`muestras-cen/`) producen exactamente el mismo resultado antes y después; prueba sintética en `tests/parser-edi.test.ts`.

### AUD-16 — Líder suplanta a otro líder · Medio · Pendiente
`PUT /api/usuarios/[id]` deja a un líder restablecer la contraseña (a `123456`) de cualquier usuario no admin de su área, incluidos otros líderes; luego puede entrar como ellos y sus acciones quedan a nombre del otro en la auditoría. Propuesta: que un líder solo gestione roles inferiores (`usuario`, `pvn`, `pvv`). Es una regla de negocio: **requiere aprobación**.

### AUD-17 — Bloqueo y enumeración · Bajo · Pendiente
Cinco intentos fallidos bloquean la cuenta 15 min sin importar el origen: un tercero puede bloquear cuentas ajenas a voluntad. El mensaje "Demasiados intentos" solo aparece para usuarios existentes y, si el usuario no existe, se responde sin calcular bcrypt (diferencia de tiempo): ambos permiten saber qué usuarios existen. Recomendación: límite por IP (p. ej. middleware/edge o Vercel WAF), mensaje genérico y bcrypt "señuelo".

### AUD-18 — Política de contraseñas · Bajo · Pendiente
Mínimo 6 caracteres; `/api/cambiar-password` no pide la contraseña actual (con una sesión robada se puede cambiar la contraseña y tomar la cuenta). Recomendación: mínimo 8–10 y pedir la actual cuando el cambio no es el obligatorio.

### AUD-19 — Caché pública de fotos · Bajo · Aceptado
`/api/qr/foto` responde con `Cache-Control: public, immutable`: la CDN sirve la foto a quien tenga la URL sin revisar sesión. Está documentado en el código como decisión de costos (plan Hobby de Vercel). Se mantiene; el id de Drive actúa como secreto.

### AUD-20 — Resumen de cierre de turno · Medio (funcional) · Pendiente
Al cerrar turno (`app/api/qr/turno/route.ts`), el total de pagos se calcula por `usuario_id + fecha`, no por `turno_id`: si el usuario tuvo dos turnos el mismo día, el resumen del segundo incluye los pagos del primero. El cierre forzado del admin sí usa `turno_id`. Corregirlo cambia lo que ve el usuario al cerrar: **requiere confirmar** cuál es la regla deseada.

### AUD-21 — Ids `MAX()+1` · Bajo · Pendiente
`generarId` de equipos (KL-), movimientos (TIC-), artículos (REP-) y productos PVN calculan el siguiente id con una lectura previa; dos altas simultáneas chocan en la PK y una falla con 500 (no hay corrupción). Recomendación: secuencias de PostgreSQL.

### AUD-22 — Escrituras sin transacción · Bajo · Pendiente
`POST /api/usuarios` (usuario + módulos), `PUT /api/usuarios/[id]` (varios UPDATE y módulos), `POST /api/sistemas/movimientos` (cabecera + activos), productos PVN (producto + componentes), `guardarOrden` de EDI (orden + líneas). Un fallo intermedio deja datos a medias. Recomendación: `sql.transaction` o sentencias únicas con CTE, como ya hace el módulo de repuestos.

### AUD-23 — Esquema no reproducible · Informativo · Corregido (ver «Revisión de lo que faltaba»)
`schema.sql` no tiene columnas y tablas que el código usa (ver ARCHITECTURE.md). Recomendación: exportar el esquema real (`pg_dump --schema-only`) y versionarlo, o adoptar migraciones numeradas.

### AUD-24 — CSP · Informativo · Pendiente
`next.config.js` define encabezados de seguridad (HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) pero no `Content-Security-Policy`, que habría mitigado AUD-05. `X-XSS-Protection` está obsoleto. Recomendación: CSP en modo `Report-Only` primero (los estilos en línea exigen `style-src 'unsafe-inline'`).

### AUD-25 — Pruebas y lint · Informativo · Parcial
No había pruebas ni ESLint configurado (`next build` omite el lint). Se agregó `npm test` (`node --test`, sin dependencias nuevas) con 11 pruebas. No se configuró ESLint (agregaría dependencias y reglas nuevas: decisión del equipo).

### AUD-26 — Higiene · Informativo · Pendiente
- `@vercel/blob` está en dependencias y no se usa; `.env.local` tiene `TRANSFERENCIAS_WEBHOOK_SECRET`, que el código no usa.
- `tsconfig.tsbuildinfo` está versionado (artefacto de compilación) y aparece siempre modificado.
- Carpeta basura `{app/` en la raíz (expansión de llaves fallida), sin seguimiento en Git.
- Varias rutas hacen `parseInt(params.id)` sin validar: un id no numérico produce 500 en vez de 400/404.
- `muestras-cen/` contiene datos reales de órdenes: está en `.gitignore`, correcto; mantenerlo fuera del repo.

### AUD-27 — Alcance del proxy de fotos · Bajo · Pendiente
Cualquier usuario autenticado (incluido pvn/pvv) puede pedir `/api/qr/foto?id=<fileId>` de cualquier archivo creado por la cuenta de servicio (pagos, cierres, formatos TIC) si conoce el id. Los ids no son adivinables y solo aparecen en respuestas a usuarios con permiso, por eso es Bajo. Recomendación: verificar que el `fileId` pertenezca a un registro que el usuario puede ver.

---

## Segunda ronda (22/10/2026, tarde)

### AUD-13 — Next.js · Crítico · Corregido
Investigación externa (GitHub Advisory Database y avisos de Vercel de mayo de 2026): la línea 14 no tiene parches; 14.2.35 queda afectada por 23 avisos, entre ellos dos **críticos**: ejecución remota de código en la optimización de imágenes con AVIF ([GHSA-2xp9-vwfh-vxw4](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4); la app tiene `/_next/image` activo porque usa `next/image`) y en servidores con sistema de archivos Windows ([GHSA-p293-qw3h-jr36](https://github.com/advisories/GHSA-p293-qw3h-jr36); afecta al servidor de desarrollo en Windows). Se actualizó a **Next 15.5.28** (rama de mantenimiento, ≥ 15.5.24, que corrige ambos) y **React 19.3**. Cambios: codemod oficial `next-async-request-api` (21 rutas con `params` asíncrono), `serverExternalPackages` en `next.config.js`, tipo `RefObject` en `ComprobanteForm`. `npm audit` ya no lista `next`. next-auth ya estaba en 4.24.15, que corrige sus avisos de 2026.

### AUD-17 — Login · Parcial
Si el usuario no existe, el login (web y móvil) compara contra un hash señuelo (`compararSenuelo` en `lib/loginBruteForce.ts`): tarda lo mismo que con un usuario real y no se puede averiguar por tiempo qué usuarios existen. Sigue pendiente un límite por IP (el bloqueo es por cuenta): en Vercel, sin memoria compartida, requiere Vercel WAF o una tabla de intentos por IP.

### AUD-21 / AUD-22 — Transacciones e ids · Corregido
- `lib/reintentar.ts` (`conReintentoPorDuplicado`): recalcula el consecutivo y reintenta si choca (equipos KL-, movimientos TIC-, artículos REP-, productos PVN).
- En una sola sentencia o `sql.transaction`: alta de usuario + módulos; edición de usuario (primero valida todo y luego aplica; antes un error en un campo dejaba aplicados los anteriores); movimiento TIC + activos; producto PVN + receta (`lib/pvn-componentes.ts`); orden EDI + líneas + reparto (`guardarOrden`).
- Módulos de usuario: se descartan nombres que no existen en el catálogo.

### AUD-24 — CSP · Corregido
`next.config.js` envía `Content-Security-Policy`: `default-src 'self'`, scripts solo del propio sitio (con `'unsafe-inline'`, que exige Next sin nonces; `'unsafe-eval'` solo en desarrollo), `connect-src 'self'`, `img-src 'self' data: blob:`, `object-src 'none'`, `base-uri`, `form-action` y `frame-ancestors 'self'`, con Google Fonts permitido. Se retiró `X-XSS-Protection` (obsoleto). Limita la exfiltración de datos si se colara un XSS; no lo evita por completo por `'unsafe-inline'` (mejora futura: nonces).

### AUD-26 — Higiene · Parcial
Ids no numéricos en la URL responden 404 en vez de 500; se quitó `@vercel/blob` (sin uso) y la carpeta basura `{app/`; el login móvil responde 400 si el cuerpo no es JSON. Falta sacar `tsconfig.tsbuildinfo` de Git (`git rm --cached`, a hacer junto con el commit).

### AUD-27 — Proxy de fotos · Corregido
`/api/qr/foto` valida el formato del id y solo entrega el archivo si pertenece a un pago o cierre de turno propio (o el usuario tiene `pvn_pagos_qr`) o a un movimiento TIC (con `movimientos_tic`); si no, 404. La caché pública de la CDN (AUD-19) sigue: una URL ya servida puede volver a servirse sin pasar por este control.

### AUD-28 — Activos que desaparecían del formato TIC · Medio · Corregido
El formulario permite escribir la placa a mano, pero `GET /api/sistemas/movimientos/[id]` hacía `JOIN` con Equipos TI: el activo con placa no registrada no aparecía en el detalle ni en el formato impreso (aunque sí contaba en el total de la lista). Ahora `LEFT JOIN`.

### AUD-29 — Placas inexistentes en movimientos TIC · Bajo · Pendiente
No hay llave foránea ni validación: se puede guardar un movimiento con una placa que no existe. Validarlo podría impedir registrar estibas o herramientas que no están en Equipos TI; **requiere decidir** si toda placa debe existir en Equipos TI.

---

## Decisiones del 22/10/2026

### AUD-16 — Líder vs. líder · Corregido
Un líder solo gestiona usuarios `usuario`, `pvn` y `pvv` de su área: no puede editar,
desactivar ni restablecer a otro líder (403), ni asignar o crear el rol líder. En la lista de
usuarios, los botones de esas filas no aparecen para un líder, y la opción «Líder de Área»
solo la ve el admin. Archivos: `app/api/usuarios/route.ts`, `app/api/usuarios/[id]/route.ts`,
`components/usuarios/UsuariosList.tsx`, `ModalCrear.tsx`, `ModalEditar.tsx`.

### AUD-18 — Política de contraseñas · Corregido
Mínimo 8 caracteres; la nueva debe ser distinta de la actual; en un cambio voluntario se exige
la contraseña actual (403 si no coincide). En el cambio obligatorio no se pide. La pantalla
`/cambiar-password` muestra el campo «Contraseña actual» solo en el cambio voluntario.
**La app móvil** debe enviar `password_actual` si ofrece cambio voluntario de contraseña.

### AUD-20 — Resumen de cierre de turno · Corregido
El total al cerrar suma solo los pagos de ese turno (`turno_id`), igual que el cierre forzado
del admin; la bitácora guarda además el `turno_id`.

### AUD-29 — Placas libres en movimientos TIC · Aceptado
Se mantiene la posibilidad de registrar placas que no están en Equipos TI (estibas,
herramientas). Desde AUD-28 esos activos sí aparecen en el detalle y en el formato impreso.

### AUD-30 — Restablecer la propia contraseña dejaba la cuenta sin acceso · Alto (funcional) · Corregido
Detectado en producción el 22/10/2026, después del despliegue. El admin se restableció la contraseña desde Usuarios → Editar → «Restablecer contraseña». Desde AUD-02, una sesión con cambio pendiente queda sin permisos; la lista de usuarios respondió 401 y la pantalla guardó el objeto de error en lugar de la lista (`usuarios.filter is not a function`). La app mostró «Application error» **antes** de enseñar la contraseña temporal, así que la cuenta quedó con una clave que nadie conocía (se recupera entrando a `/cambiar-password` con la sesión todavía abierta, que no pide la actual en el cambio obligatorio).
Corrección: `PUT /api/usuarios/[id]` rechaza `resetPassword` sobre la propia cuenta (400); `fetchUsuarios` y la carga de áreas toleran respuestas de error; en «Editar» de la propia cuenta aparece «Cambiar mi contraseña» en vez de «Restablecer»; la barra lateral tiene el enlace «Cambiar contraseña» para cualquier usuario. Verificado en local contra la rama de desarrollo de Neon.

### AUD-31 — Montos con punto de miles se guardaban mil veces menores · Alto (dinero) · Corregido
Encontrado en la auditoría de la app móvil (MOV-01, `pvn-pvv-mobile/docs/AUDITORIA.md`). Los formularios de pagos QR leían el monto con `parseFloat(texto.replace(/[^\d.]/g, ''))`: «25.000», como se escribe en Colombia, quedaba en **$25**. Estaba en la app móvil y en la web (`app/pvn/subir-qr/page.tsx`, `app/pvn/pagos-qr/page.tsx`, `components/pvn-qr/CargarQRPendienteForm.tsx`). En la copia de producción hay 7 de 6 609 pagos por debajo de $1 000 (entre $167 y $349; la mediana es $12 450), que conviene revisar contra la foto del comprobante.
Corrección: `parseValorPesos` en `lib/validacion.ts` (y su equivalente en la app móvil) lee el punto y la coma como separadores de miles; solo los toma como decimal si el último va seguido de 1 o 2 dígitos. Prueba en `tests/seguridad.test.ts`.

### AUD-32 — Pantallas que se caían ante una respuesta de error · Medio (funcional) · Corregido
Misma causa que AUD-30, buscada en todo el cliente: funciones de `lib/api/*` y llamadas `fetch` que pasaban
`res.json()` a la pantalla sin revisar si la respuesta era un error. Con un 401 (sesión revocada o con cambio
de contraseña pendiente), 403 o 500, la pantalla recibía `{ error }` donde esperaba una lista y fallaba al hacer
`.map`/`.filter`. Corregidas: puntos de venta (Análisis, Historial y Usuarios), productos (Registrar ventas),
análisis y detalle de producto PVN, y detalle e impresión de movimientos TIC. Las listas devuelven `[]` y los
detalles lanzan un error que la pantalla ya atrapa.

### Revisión de lo que faltaba (22/10/2026, tarde)
- `lib/planos/*`, `lib/exportExcel.ts`, `lib/repuestos-excel.ts`: ExcelJS escribe los textos como texto (un
  valor que empieza con `=` no se ejecuta al abrir el archivo); la única fórmula es un `SUBTOTAL` fijo del código.
- `lib/conciliacion-facturas/*`: lectura de Excel en el navegador con SheetJS 0.20.3 (con sus avisos conocidos
  corregidos); los montos se comparan con tolerancia, no por igualdad exacta.
- Enlaces armados con placas de equipo: siempre bajo `/sistemas/equipos/…`, sin riesgo de `javascript:`.
- `scripts/import-*.js` y `scripts/probar-*.js`: leen las credenciales del entorno, sin secretos en el código;
  los `import-*` hacen `INSERT … ON CONFLICT` o `UPDATE` por EAN (no borran).
- AUD-23: `scripts/exportar-esquema.js` genera `db/esquema.sql` desde el catálogo de PostgreSQL (34 tablas,
  90 restricciones, 36 índices, 3 vistas, 24 secuencias). Verificado ejecutando las 187 sentencias completas en un
  esquema temporal de la rama de desarrollo dentro de una transacción que se deshizo al final.
