# API

Todas las rutas viven en `app/api/**/route.ts` y responden JSON. Errores:
`{ "error": "mensaje" }` con 400 (datos inválidos), 401 (sin sesión válida),
403 (sin rol/módulo), 404, 409 (conflicto de estado o duplicado), 5xx.

**Autenticación**

- *Sesión*: cookie de NextAuth (`getServerSession`). Revalidada contra la BD en
  cada petición (lib/auth.ts): un usuario inactivo queda sin rol ni módulos.
- *Sesión o Bearer*: además acepta `Authorization: Bearer <jwt>` de
  `/api/auth/mobile/login` (`getAuthUser`, lib/api-auth.ts), también revalidado
  contra la BD. Rechaza sesiones con cambio de contraseña pendiente.
- *Módulo X*: `tieneModulo(rol, modulos, X)`; `admin` siempre pasa.

## Autenticación y cuenta

| Método | Ruta | Auth | Permiso | Descripción |
|---|---|---|---|---|
| GET/POST | `/api/auth/[...nextauth]` | — | — | NextAuth (login web, sesión, logout) |
| POST | `/api/auth/mobile/login` | — | usuario con `acceso_movil` | `{username,password}` → `{token,user}` (JWT HS256, 30 días) |
| PUT | `/api/cambiar-password` | Sesión o Bearer | cualquiera, incluso con cambio pendiente | `{nueva_password}` 6–100 caracteres |

## Administración

| Método | Ruta | Auth | Permiso | Descripción |
|---|---|---|---|---|
| GET | `/api/usuarios` | Sesión | admin; lider (su área, o `?rol=pvn_pvv`) | Lista con módulos |
| POST | `/api/usuarios` | Sesión | admin; lider (su área, sin crear admin) | Crea con contraseña temporal aleatoria (`password_temporal` en la respuesta, una sola vez) y cambio obligatorio |
| PUT | `/api/usuarios/[id]` | Sesión | admin; lider (usuarios no admin de su área) | Activar, rol, nombre, usuario, área (solo admin), punto, acceso móvil, módulos, restablecer contraseña |
| GET | `/api/areas` | Sesión | admin, lider | Áreas |
| POST, PUT, DELETE | `/api/areas`, `/api/areas/[id]` | Sesión | admin | Gestión de áreas (no se borra una protegida o con usuarios) |
| GET | `/api/auditoria` | Sesión | admin | Bitácora (máx. 500 filas) |

## Inventario (logística)

| Método | Ruta | Auth | Permiso | Descripción |
|---|---|---|---|---|
| GET | `/api/inventario` | Sesión | `cargar` o `consulta` | Sin `fecha`: fechas disponibles; con `fecha`: filas + `bloqueado` |
| POST | `/api/inventario` | Sesión | `cargar` | multipart `file` (TXT), `dia`, `modo`. Reemplaza en una transacción; 409 si hay filas acumuladas |
| GET | `/api/inventario/tipos` | Sesión | `cargar` o `consulta` | Tipos de una fecha |
| PUT | `/api/conteo` | Sesión | `consulta`; solo quien cargó (o admin) y no acumulado | Conteo físico |
| POST | `/api/acumulaciones` | Sesión | `acumulados`; no admin solo sus filas | Bloquea filas |
| GET | `/api/acumulados` | Sesión | `acumulados` | Vista acumulada |
| DELETE | `/api/reiniciar` | Sesión | admin; body `{confirmar:"ELIMINAR"}` | Borra historial (opcional rango) |

## Puntos de venta (PVN/PVV) y pagos QR

| Método | Ruta | Auth | Permiso | Descripción |
|---|---|---|---|---|
| GET | `/api/pvn/puntos-venta` | Sesión o Bearer | cualquiera | Puntos de venta |
| POST, PUT | `/api/pvn/puntos-venta`, `/[id]` | Sesión o Bearer / Sesión | `pvn_catalogo` | Crear / editar punto |
| GET | `/api/pvn/productos`, `/[id]` | Sesión o Bearer | cualquiera | Catálogo con componentes |
| POST, PUT | `/api/pvn/productos`, `/[id]` | Sesión | `pvn_catalogo` | Crear / editar producto |
| GET | `/api/pvn/registros` | Sesión o Bearer | `pvn`: los propios; otros: `pvn_historial` | Registros de ventas |
| POST | `/api/pvn/registros` | Sesión o Bearer | pvn, admin, lider | Registro por turno (pvn solo hoy); atómico; 409 si ya existe |
| GET | `/api/pvn/analisis`, `/analisis/producto` | Sesión | `pvn_analisis` | Análisis de ventas |
| GET | `/api/qr/turno` | Sesión o Bearer | pvn, pvv | Turno de hoy, pendiente o historial (propios) |
| POST | `/api/qr/turno` | Sesión o Bearer | pvn, pvv | `accion: abrir \| cerrar` (pvv cierra con foto de datafono y nº de recogida) |
| GET, POST | `/api/qr/turno/activos` | Sesión | GET `pvn_pagos_qr`; POST admin | Turnos abiertos / cierre forzado |
| GET | `/api/qr/turno/cierres` | Sesión | `pvn_pagos_qr` | Cierres con datafono |
| POST | `/api/qr/pagos` | Sesión o Bearer | pvn, pvv con turno abierto propio | multipart `foto` (imagen ≤ 8 MB), `valor`, `turno_id?` |
| GET | `/api/qr/pagos` | Sesión o Bearer | pvn/pvv: propios del turno; otros: `pvn_pagos_qr` | Pagos con filtros |
| PUT, DELETE | `/api/qr/pagos/[id]` | Sesión o Bearer | admin: cualquiera; pvn/pvv: propio, de hoy, turno abierto | Editar valor/punto, eliminar |
| POST | `/api/qr/cierre-dia` | Sesión o Bearer | pvn, pvv | Registro de auditoría del día |
| GET | `/api/qr/foto?id=&thumb=1` | Sesión o Bearer | cualquiera autenticado | Proxy de imagen de Drive (caché pública, ver SECURITY.md) |

## Órdenes EDI (módulo `ordenes_cen`, Sesión o Bearer)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/logistica/ordenes-cen` | Órdenes con filtros y resumen (máx. 2000) |
| GET, PATCH | `/api/logistica/ordenes-cen/[id]` | Detalle; `accion: descartar \| reactivar \| ruta \| reversar` |
| GET, POST | `/api/logistica/ordenes-cen/[id]/pedido` | Preparar/validar pedido Siesa; enviarlo `{confirmaAlertas}` (reserva atómica contra doble envío) |
| GET | `/api/logistica/ordenes-cen/[id]/cliente` | Cliente en Siesa vs. app |
| POST | `/api/logistica/ordenes-cen/sincronizar` | Traer órdenes de los SFTP (botón) |
| GET | `/api/logistica/ordenes-cen/sincronizar` | **Sin sesión**: `Authorization: Bearer <CRON_SECRET>` (comparación en tiempo constante) |
| GET, POST, PATCH | `/api/logistica/ordenes-cen/puntos` | Homologar EAN de entrega ↔ sucursal Siesa; bodega |
| GET, PUT | `/api/logistica/ordenes-cen/productos` | Maestro de productos (ítem Siesa, peso, und/caja) |
| GET, POST | `/api/logistica/ordenes-cen/items` | Copia local de ítems de Siesa / refrescarla |
| GET, PUT | `/api/logistica/ordenes-cen/clientes` | Configuración de pedido por NIT |
| GET, POST, PUT, DELETE | `/api/logistica/ordenes-cen/reglas`, `/[id]` | Reglas de ruta |
| GET, PUT | `/api/logistica/ordenes-cen/totales` | Totales de una ruta / vista por defecto |
| GET | `/api/logistica/ordenes-cen/bodegas` | Bodegas de Siesa |

## Sistemas (TIC)

| Método | Ruta | Auth | Permiso | Descripción |
|---|---|---|---|---|
| GET, POST | `/api/sistemas/equipos` | Sesión | `equipos` | Lista / crear equipo |
| GET, PUT | `/api/sistemas/equipos/[id]` | Sesión | `equipos` | Hoja de vida / editar |
| DELETE | `/api/sistemas/equipos/[id]` | Sesión | admin | Eliminar equipo |
| POST | `/api/sistemas/equipos/[id]/historial` | Sesión | `equipos` | Mantenimiento, incidencia o cambio |
| GET, POST | `/api/sistemas/mantenimientos` | Sesión | `equipos` | Programados / registrar realizado |
| GET, POST | `/api/sistemas/movimientos` | Sesión | `movimientos_tic` | Movimientos de activos |
| GET | `/api/sistemas/movimientos/[id]` | Sesión o Bearer | `movimientos_tic` | Detalle |
| PATCH | `/api/sistemas/movimientos/[id]` | Sesión | `movimientos_tic` | Cambiar estado |
| POST | `/api/sistemas/movimientos/[id]/foto` | Sesión o Bearer | `movimientos_tic` | Foto del formato firmado |
| GET, POST | `/api/sistemas/repuestos` | Sesión | `repuestos_tic` | Catálogo / crear artículo |
| PUT | `/api/sistemas/repuestos/[codigo]` | Sesión | `repuestos_tic` | Editar (el stock solo cambia con movimientos) |
| GET, POST | `/api/sistemas/repuestos/movimientos` | Sesión | `repuestos_tic` | Kardex / entrada, salida, ajuste (transaccional) |
| GET | `/api/sistemas/repuestos/movimientos/[id]` | Sesión | `repuestos_tic` | Comprobante |
| GET | `/api/sistemas/repuestos/asignaciones`, `/[id]` | Sesión | `repuestos_tic` | Asignaciones vigentes / detalle |
| POST | `/api/sistemas/repuestos/asignaciones/[id]` | Sesión | `repuestos_tic` | Devolución / retiro |
| GET | `/api/sistemas/repuestos/consumo` | Sesión | `repuestos_tic` | Análisis de consumo |
| GET | `/api/sistemas/repuestos/equipos` | Sesión | `repuestos_tic` | Buscador de equipos |
