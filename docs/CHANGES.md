# Cambios de la auditoría (22/10/2026)

Punto de partida: commit `d32a4c1` en `main`; único cambio previo sin confirmar:
`tsconfig.tsbuildinfo` (artefacto). Los cambios **no se confirmaron en Git**:
quedan en el árbol de trabajo para revisarlos y probarlos antes del commit.

| # | Hallazgo | Cambio | Archivos |
|---|---|---|---|
| 1 | AUD-01, AUD-02 | Revalidación de la sesión contra la BD en cada lectura; sesión revocada o con cambio de contraseña pendiente sin rol ni módulos; se eliminó el `update()` del cliente que quitaba la marca de cambio obligatorio | `lib/estadoUsuario.ts` (nuevo), `lib/auth.ts`, `types/next-auth.d.ts` |
| 2 | AUD-01, AUD-12 | `getAuthUser`: rechaza sesiones revocadas; token móvil revalidado en la BD y verificado solo con HS256; JSDoc | `lib/api-auth.ts`, `app/api/auth/mobile/login/route.ts` |
| 3 | AUD-01, AUD-11 | Middleware: sesión revocada → login; `/contabilidad/conciliacion-facturas` exige el módulo `conciliacion_facturas` | `middleware.ts` |
| 4 | AUD-02 | `GET /api/pvn/productos/[id]` usa `getAuthUser` (antes solo comprobaba que hubiera sesión) | `app/api/pvn/productos/[id]/route.ts` |
| 5 | AUD-05 | Escape HTML en el formato imprimible de movimientos TIC | `lib/html.ts` (nuevo), `components/movimientos/imprimirMovimiento.ts` |
| 6 | AUD-09, AUD-10 | Validación de montos de pagos QR; escape del texto del banner SVG | `lib/validacion.ts` (nuevo), `app/api/qr/pagos/route.ts`, `app/api/qr/pagos/[id]/route.ts` |
| 7 | AUD-06 | Carga de inventario: 409 si hay filas acumuladas; borrado + inserción masiva en una transacción | `app/api/inventario/route.ts` |
| 8 | AUD-07 | Reserva atómica de la orden antes de enviar el pedido a Siesa; liberación si falla la red | `lib/cen/pedidoSiesa.ts` |
| 9 | AUD-08 | Registro de ventas PVN atómico (CTE) con validación del detalle; manejo de duplicado (23505 → 409) al abrir turno y registrar ventas | `app/api/pvn/registros/route.ts`, `app/api/qr/turno/route.ts` |
| 10 | AUD-08 | Migración nueva de índices únicos (ya aplicada en la BD de producción el 22/10/2026) y validación de rango INTEGER en el detalle de ventas | `scripts/migrate-add-indices-unicos.js` (nuevo), `app/api/pvn/registros/route.ts` |
| 11 | AUD-04 | `setup-db.js` sin contraseñas fijas, sin sobrescribir usuarios existentes y con cambio obligatorio; README sin credenciales | `scripts/setup-db.js`, `README.md` |
| 12 | AUD-15 | Parser EDIFACT: el escape `?` solo se quita en el último nivel | `lib/cen/parser.ts` |
| 13 | AUD-14 | `npm audit fix` sin `--force` (solo versiones dentro de los rangos de `package.json`) | `package-lock.json` |
| 14 | AUD-25 | Pruebas con `node --test` y script `npm test`; `tests/` excluido de `tsconfig` (importa con extensión `.ts`) | `tests/seguridad.test.ts`, `tests/parser-edi.test.ts` (nuevos), `package.json`, `tsconfig.json` |
| 14b | AUD-03 | Contraseña temporal aleatoria por usuario al crear/restablecer, mostrada una sola vez en un modal | `lib/passwordTemporal.ts`, `components/usuarios/ModalPasswordTemporal.tsx` (nuevos), `app/api/usuarios/route.ts`, `app/api/usuarios/[id]/route.ts`, `lib/api/usuarios.ts`, `app/admin/usuarios/page.tsx`, `components/usuarios/ModalCrear.tsx`, `ModalEditar.tsx` |
| 17 | AUD-13 | Next 14.2.35 → 15.5.28 y React 18 → 19.3; codemod de `params` asíncrono; `serverExternalPackages` | `package.json`, `package-lock.json`, `next.config.js`, 21 rutas con `[id]`/`[codigo]`, `components/pvn-qr/ComprobanteForm.tsx` |
| 18 | AUD-24 | Content-Security-Policy; se retira `X-XSS-Protection` | `next.config.js` |
| 19 | AUD-27 | Proxy de fotos con control por registro y validación del id | `app/api/qr/foto/route.ts` |
| 20 | AUD-21, AUD-22 | Reintento de consecutivos y transacciones en usuarios, movimientos TIC, productos PVN y órdenes EDI | `lib/reintentar.ts`, `lib/pvn-componentes.ts` (nuevos), `app/api/usuarios/route.ts`, `app/api/usuarios/[id]/route.ts`, `app/api/sistemas/movimientos/route.ts`, `app/api/sistemas/equipos/route.ts`, `app/api/sistemas/repuestos/route.ts`, `app/api/pvn/productos/route.ts`, `app/api/pvn/productos/[id]/route.ts`, `lib/cen/sincronizar.ts` |
| 21 | AUD-17 | Hash señuelo en el login web y móvil | `lib/loginBruteForce.ts`, `lib/auth.ts`, `app/api/auth/mobile/login/route.ts` |
| 22 | AUD-26 | Ids no numéricos → 404; sin `@vercel/blob`; sin carpeta `{app/` | 7 rutas con `[id]`, `package.json` |
| 23 | AUD-28 | `LEFT JOIN` en el detalle de movimientos TIC | `app/api/sistemas/movimientos/[id]/route.ts` |
| 24 | — | Configuración `inventory-app-prod` (`npm start`) para pruebas locales | `.claude/launch.json` |
| 25 | AUD-16 | Líder solo gestiona usuario/pvn/pvv | `app/api/usuarios/route.ts`, `app/api/usuarios/[id]/route.ts`, `components/usuarios/UsuariosList.tsx`, `ModalCrear.tsx`, `ModalEditar.tsx` |
| 26 | AUD-18 | Mínimo 8, distinta de la actual y contraseña actual en cambios voluntarios | `app/api/cambiar-password/route.ts`, `app/cambiar-password/page.tsx` |
| 27 | AUD-20 | Resumen del cierre por `turno_id` | `app/api/qr/turno/route.ts` |
| 28 | AUD-30 | Sin auto-restablecimiento; lista de usuarios tolerante a errores; enlace «Cambiar contraseña» | `app/api/usuarios/[id]/route.ts`, `lib/api/usuarios.ts`, `app/admin/usuarios/page.tsx`, `components/usuarios/ModalEditar.tsx`, `components/Sidebar.tsx` |
| 29 | AUD-31 | Lectura de montos en pesos colombianos en los formularios de pagos QR | `lib/validacion.ts`, `app/pvn/subir-qr/page.tsx`, `app/pvn/pagos-qr/page.tsx`, `components/pvn-qr/CargarQRPendienteForm.tsx`, `tests/seguridad.test.ts` |
| 30 | AUD-32 | Lecturas del cliente tolerantes a respuestas de error | `lib/api/pvn-analisis.ts`, `lib/api/pvn-historial.ts`, `lib/api/pvn-registrar.ts`, `lib/api/movimientos.ts`, `components/movimientos/MovimientoDetalle.tsx`, `components/movimientos/MovimientosList.tsx`, `app/admin/usuarios/page.tsx` |
| 31 | AUD-23 | Exportador del esquema real y `db/esquema.sql` | `scripts/exportar-esquema.js`, `db/esquema.sql` (nuevos), `schema.sql` (nota) |
| 15 | — | `.env.example` con todas las variables que usa el código (solo nombres) | `.env.example` |
| 16 | — | Documentación | `docs/*` |

## Cambios de comportamiento visibles

- Desactivar un usuario o cambiarle rol/módulos aplica de inmediato (web y app móvil), no al vencer la sesión.
- Un usuario con cambio de contraseña pendiente no puede usar ninguna API salvo `/api/cambiar-password` (antes muchas rutas lo dejaban pasar).
- No se puede recargar el TXT de inventario de una fecha/modo/tipo que ya tenga registros acumulados (409 con mensaje).
- Un segundo envío simultáneo del mismo pedido EDI responde "La orden ya se está enviando…".
- Montos de pago fuera de rango o no finitos responden "Valor inválido" (400) en vez de 500 o de guardarse.
- Ya no existe la contraseña `123456`: al crear o restablecer un usuario aparece una contraseña temporal única que solo se ve una vez.
- La app corre en Next 15 y React 19 (mismas pantallas; build y pruebas en vivo correctos).
- Un usuario PVN/PVV ya no puede ver por URL las fotos de pagos o cierres de otra persona.
- Los activos con placa escrita a mano vuelven a aparecer en el detalle y el formato impreso de movimientos TIC.
- Un líder ya no ve ni puede usar Editar/Desactivar sobre otros líderes, ni crear líderes.
- Contraseñas nuevas: mínimo 8 caracteres; para cambiarla voluntariamente se pide la actual.
- El total que ve el operador al cerrar turno es solo el de ese turno.
- Cada petición autenticada hace una consulta extra a la BD (por PK, con subconsulta de módulos).

## Revertir

Todos los cambios son de código; no se modificó la base de datos ni configuración
externa. `git diff` muestra el detalle; `git checkout -- <archivo>` revierte uno.
Para `package-lock.json`, `git checkout -- package-lock.json && npm ci`.
