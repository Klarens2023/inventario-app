# Arquitectura

## Tecnologías (versiones reales, `package-lock.json`)

| Pieza | Versión | Uso |
|---|---|---|
| Next.js (App Router) | 15.5.28 | Páginas React y rutas API (`app/api/**/route.ts`, `params` asíncrono), middleware |
| React | 19.3 | Interfaz (componentes cliente con `'use client'`) |
| TypeScript | 5.x, `strict` | Todo el código de `app/`, `components/`, `lib/`, `types/` |
| next-auth | 4.24.15 | Login con usuario/contraseña (Credentials), sesión JWT en cookie |
| jsonwebtoken | 9 | JWT propio de la app móvil (Bearer) |
| bcryptjs | 2.4 | Hash de contraseñas (costo 10) |
| @neondatabase/serverless | 0.9 | PostgreSQL en Neon por HTTP; SQL a mano con plantillas parametrizadas |
| googleapis + sharp | 173 / 0.35 | Subida de fotos a Google Drive y miniaturas |
| ssh2-sftp-client | 11 | Lectura de órdenes EDI en los SFTP de Carvajal y Subrik |
| exceljs / xlsx | 4.4 / 0.20 | Exportaciones y lectura de Excel (planos, conciliación) |
| Tailwind CSS | 3.4 | Estilos (la mayoría de componentes usa estilos en línea) |

No hay ORM (no Drizzle), ni PWA/Service Worker, ni Dexie/IndexedDB, ni cola de
sincronización offline: la web trabaja siempre en línea contra la API. La app
móvil (PVN/PVV, React Native) **no está en este repositorio** y solo consume la API
de este (`/api/auth/mobile/login` + Bearer).

Despliegue: Vercel (`vercel.json`); base de datos en Neon; una tarea de GitHub
Actions (`.github/workflows/sincronizar-ordenes-edi.yml`) llama cada 30 min a la
sincronización de órdenes EDI.

## Roles y módulos

- Roles (`usuarios.rol`): `admin`, `lider`, `usuario`, `pvn` (punto de venta
  nacional), `pvv` (punto de venta Valledupar).
- Módulos asignables por usuario (`usuario_modulos`, lista en `lib/permissions.ts`):
  `cargar`, `consulta`, `acumulados`, `ordenes_cen`, `pvn_historial`,
  `pvn_analisis`, `pvn_catalogo`, `pvn_pagos_qr`, `equipos`, `movimientos_tic`,
  `repuestos_tic`, `planos`, `conciliacion_facturas`. `admin` tiene todos.
- `pvn`/`pvv` solo ven sus pantallas (`/pvn/registrar`, `/pvn/subir-qr`).
- Áreas (`areas`): agrupan usuarios; el líder administra usuarios de su área.

## Flujo de una petición

```
Navegador ──► middleware.ts ──► página (app/**/page.tsx, cliente)
                 │  getToken(): sin sesión o revocada → /login
                 │  rol/módulo de la ruta → /dashboard si no tiene acceso
                 ▼
            fetch('/api/...') ──► app/api/**/route.ts
                                    │ getServerSession() o getAuthUser()
                                    │   └─ lib/auth.ts callbacks.jwt revalida el usuario en la BD
                                    │ chequeo de rol / tieneModulo()
                                    ▼
                                  lib/db.ts (Neon, SQL parametrizado) · lib/audit.ts (bitácora)
                                  servicios externos: Google Drive, SFTP EDI, Siesa Connekta
App móvil ── Bearer JWT ─────────► mismas rutas vía getAuthUser() (revalida en la BD)
```

El middleware solo decide qué **pantallas** se muestran; la barrera real de los
datos son los chequeos dentro de cada ruta API.

## Módulos funcionales

| Módulo | Páginas | API | Lógica |
|---|---|---|---|
| Inventario (logística) | `/cargar`, `/consulta`, `/acumulados` | `/api/inventario`, `/api/conteo`, `/api/acumulaciones`, `/api/acumulados`, `/api/reiniciar` | Carga TXT de Siesa por fecha, conteo físico, acumulado (bloqueo) |
| Órdenes EDI (CEN) | `/logistica/ordenes-cen/**` | `/api/logistica/ordenes-cen/**` | `lib/cen/*`: SFTP → parser EDIFACT/Subrik → `cen_ordenes` → rutas → pedido Siesa (`lib/siesa/connekta.ts`) |
| Puntos de venta | `/pvn/**` | `/api/pvn/**`, `/api/qr/**` | Registro de ventas por turno, pagos QR con foto (Drive), turnos y cierre con datafono |
| Sistemas (TIC) | `/sistemas/**` | `/api/sistemas/**` | Hoja de vida de equipos, movimientos con formato imprimible, repuestos/insumos con kardex (`lib/repuestos*.ts`) |
| Contabilidad | `/planos/**`, `/contabilidad/conciliacion-facturas` | — (procesamiento en el navegador) | `lib/planos/*` genera TXT/Excel para Siesa; `lib/conciliacion-facturas/*` compara Excel |
| Administración | `/admin/usuarios`, `/auditoria` | `/api/usuarios/**`, `/api/areas/**`, `/api/auditoria` | Usuarios, áreas, módulos y bitácora |

## Mapa de archivos

| Ruta | Responsabilidad |
|---|---|
| `middleware.ts` | Acceso a páginas por sesión, rol y módulo |
| `lib/auth.ts` | Configuración NextAuth: login, bloqueo por intentos, duración por rol, revalidación de la sesión contra la BD |
| `lib/api-auth.ts` | `getAuthUser()`: sesión web o Bearer móvil, revalidado contra la BD |
| `lib/estadoUsuario.ts` | Lectura del estado vigente del usuario (activo, rol, módulos) |
| `lib/loginBruteForce.ts` | 5 intentos fallidos → bloqueo de 15 min |
| `lib/permissions.ts` | Catálogo de módulos y `tieneModulo()` |
| `lib/db.ts` | Cliente Neon (`sql`) |
| `lib/audit.ts` | `logAudit()` → `audit_logs` (no interrumpe si falla) |
| `lib/html.ts` | `escapeHtml()` para HTML/SVG armado como texto |
| `lib/validacion.ts` | `valorMonetario()` para montos de pagos |
| `lib/passwordTemporal.ts` | Contraseñas temporales aleatorias al crear/restablecer usuarios |
| `lib/reintentar.ts` | Reintento de altas con consecutivo `MAX()+1` ante duplicado |
| `lib/pvn-componentes.ts` | Inserción de la receta de un producto PVN en una sentencia |
| `lib/google-drive.ts` | Subida a Drive, compresión, URL de proxy `/api/qr/foto` |
| `lib/cen/*` | EDI: SFTP solo lectura, parser, sincronización, rutas, ítems y pedido Siesa |
| `lib/siesa/connekta.ts` | Cliente de la API Connekta (consultas y conector de pedidos) |
| `lib/repuestos*.ts` | Validaciones y consultas transaccionales del kardex de repuestos |
| `lib/planos/*`, `lib/conciliacion-facturas/*`, `lib/exportExcel.ts` | Generación de archivos (cliente) |
| `lib/api/*` | Funciones `fetch` del cliente por módulo |
| `components/**` | Componentes de UI por módulo; `imprimir*.ts` arman formatos HTML imprimibles |
| `types/**` | Tipos compartidos; `types/next-auth.d.ts` extiende la sesión |
| `scripts/*.js` | Migraciones y cargas manuales (se corren a mano con `DATABASE_URL`) |
| `schema.sql` | Esquema base **desactualizado** (ver Base de datos) |
| `tests/*.test.ts` | Pruebas con `node --test` |

## Base de datos

PostgreSQL (Neon). El esquema real es `schema.sql` **más** las migraciones de
`scripts/migrate-*.js` corridas a mano. `schema.sql` no refleja columnas que el
código usa (`inventario_datos.modo` y `lote`, `usuarios.area`, `punto_venta_id`,
`acceso_movil`, `intentos_fallidos`, `bloqueado_hasta`, tablas `pvn_registros`,
`pvn_productos`, `equipos_*`…): no se puede reconstruir la BD solo desde el
repositorio (hallazgo AUD-23).

Tablas principales y reglas de integridad:

- `usuarios` (username único) · `usuario_modulos` (FK con `ON DELETE CASCADE`) · `areas` (key única) · `audit_logs`.
- `inventario_datos` → `inventario_conteos` (`ON DELETE CASCADE`). `acumulado = true` bloquea el conteo y, desde esta auditoría, también la recarga de esa fecha.
- `pvn_puntos_venta`, `pvn_productos`/`pvn_componentes`, `pvn_registros`/`pvn_registros_detalle`, `pvn_turnos`, `pvn_pagos_qr` (`valor NUMERIC(14,2)`, FK a `pvn_turnos`).
- `cen_archivos` (único por fuente+nombre: no se reprocesa un archivo), `cen_ordenes` (único por comprador+número; `estado` con CHECK), `cen_orden_lineas`, `cen_orden_distribucion`, `cen_puntos_ean` (EAN único), `cen_productos`, `cen_config_clientes`, `cen_reglas_ruta`, `cen_rutas`, `cen_items_siesa`.
- `equipos_tecnologicos` y sus historiales, `tic_movimientos`/`tic_movimiento_activos`, `tic_articulos` (CHECK `stock_actual >= 0`), `tic_articulo_movimientos`, `tic_articulo_asignaciones`.
- Pendiente de correr: `scripts/migrate-add-indices-unicos.js` (un turno abierto por usuario y día; un registro de ventas por usuario, fecha y turno).

Montos: columnas `NUMERIC` en la BD; en JavaScript se manejan como `number`
(punto flotante) para sumas de pantalla. No hay operaciones de caja que dependan
de esa aritmética: los totales oficiales se calculan con `SUM()` en SQL.
