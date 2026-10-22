# Seguridad

## Activos y actores

- **Datos:** usuarios y hashes de contraseña; pagos QR (montos y fotos de comprobantes en Google Drive); ventas por punto; inventario y conteos; órdenes de compra EDI y pedidos en Siesa; hoja de vida de equipos; bitácora de auditoría.
- **Credenciales de integración:** Neon, Google (cuenta de servicio), SFTP de Carvajal y Subrik, Siesa Connekta, `NEXTAUTH_SECRET`, `CRON_SECRET`.
- **Actores:** admin, líder (gestiona su área), usuario por módulos, pvn/pvv (operadores de punto de venta, a menudo desde celulares compartidos), GitHub Actions (cron), internet anónimo.

## Amenazas consideradas

| Amenaza | Control actual |
|---|---|
| Acceso sin sesión | Middleware en páginas; cada ruta API exige sesión o Bearer (`401`) |
| Escalada de privilegios entre roles/módulos | Chequeo de rol/`tieneModulo` en el servidor en cada ruta; líder limitado a su área y sin crear/editar admins |
| Usuario retirado o degradado que sigue operando | Revalidación de la sesión y del token móvil contra la BD en cada petición (AUD-01) |
| Acceso a datos de otro usuario (IDOR) | pvn/pvv: consultas filtradas por `usuario_id` del token (turnos, pagos, registros); conteo solo por quien cargó; acumulación solo de filas propias |
| Fuerza bruta de contraseñas | 5 intentos → 15 min de bloqueo por cuenta (sin límite por IP: AUD-17) |
| Inyección SQL | Todas las consultas usan plantillas parametrizadas de Neon (`sql\`...${valor}\`` o `sql(texto, [params])`); los únicos fragmentos interpolados en texto son constantes del código |
| XSS | React escapa por defecto; no hay `dangerouslySetInnerHTML`; los formatos imprimibles escapan con `escapeHtml` (AUD-05); Content-Security-Policy en `next.config.js` limita orígenes de scripts y conexiones (AUD-24) |
| CSRF | Cookie de NextAuth `SameSite=Lax` (no viaja en POST de otros sitios); no hay GET con efectos salvo el cron, que exige `CRON_SECRET` |
| Acceso a fotos de Drive | `/api/qr/foto` solo entrega archivos de registros que el usuario puede ver (AUD-27), salvo lo ya cacheado públicamente en la CDN (AUD-19) |
| Enumeración de usuarios por tiempo | Hash señuelo cuando el usuario no existe (AUD-17) |
| Archivos subidos | Solo imágenes (`type image/*`), máx. 8 MB, re-codificadas a JPEG con sharp antes de subir a Drive (no se guarda el archivo original) |
| Abuso del cron | `GET /api/logistica/ordenes-cen/sincronizar` compara `CRON_SECRET` en tiempo constante; sin secreto configurado responde 503 |
| Operaciones duplicadas | Pedido EDI con reserva atómica (AUD-07); kardex de repuestos transaccional con CHECK `stock >= 0`; índices únicos de turnos y registros PVN (AUD-08, ya aplicados en producción); consecutivos con reintento (AUD-21) |
| Dependencias | `npm audit` en cada revisión; Next 15.5.28 y next-auth 4.24.15 con los avisos de 2026 corregidos (AUD-13) |
| Exposición de secretos | `.env*` en `.gitignore`; no hay secretos en el historial (búsqueda de patrones de llaves, tokens y cadenas de conexión); `.env.example` solo con nombres |
| SFTP de terceros | Conexión solo de lectura: nunca borra, mueve ni renombra archivos |

## Sesiones

- Web: JWT cifrado de NextAuth en cookie; 8 h (admin/líder/usuario) o 24 h (pvn/pvv).
- Móvil: JWT HS256 de 30 días firmado con `NEXTAUTH_SECRET`.
- Ambas se revalidan contra la BD en cada petición: desactivar al usuario las corta. Cambiar `NEXTAUTH_SECRET` invalida todas las sesiones y tokens.

## Datos en el dispositivo

La web no guarda datos de negocio en `localStorage`/IndexedDB ni usa Service
Worker. Las fotos de pagos se sirven con caché pública en la CDN por decisión de
costos (AUD-19).

## Reglas para código nuevo

1. Toda ruta API valida autenticación **y** permiso en el servidor; usar `getAuthUser` (rechaza sesiones revocadas y con cambio de contraseña pendiente) o `getServerSession` + chequeo de rol/módulo.
2. Filtrar por el usuario del token cuando el recurso es propio; nunca confiar en un `usuario_id` del body.
3. SQL siempre parametrizado; nunca concatenar texto del usuario.
4. Todo HTML/SVG armado como texto pasa por `escapeHtml`.
5. Operaciones de varias sentencias: `sql.transaction([...])` o una sola sentencia con CTE.
6. Reglas de unicidad: respaldarlas con índice único, no solo con un SELECT previo.
7. Registrar las acciones relevantes con `logAudit` (sin contraseñas ni datos sensibles en `datos`).

## Si se expone un secreto

1. Rotarlo en el servicio de origen (Neon: nueva contraseña del rol; Google: nueva llave de la cuenta de servicio y borrar la anterior; SFTP/Siesa: pedir rotación al proveedor; `NEXTAUTH_SECRET`/`CRON_SECRET`: generar otro con `openssl rand -base64 32`).
2. Actualizarlo en Vercel (y en los secretos de GitHub Actions para `CRON_SECRET`) y volver a desplegar.
3. Si llegó a Git, retirarlo del historial (`git filter-repo`) y considerar comprometido el valor aunque se borre.
