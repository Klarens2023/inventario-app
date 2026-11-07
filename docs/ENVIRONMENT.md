# Variables de entorno

Se definen en `.env.local` para desarrollo (está en `.gitignore`) y en
*Vercel → Project → Settings → Environment Variables* para producción. La
plantilla con todos los nombres es `.env.example`. Nunca pongas valores reales
en el repositorio, en issues ni en capturas.

| Variable | Obligatoria | Uso | Dónde se lee |
|---|---|---|---|
| `DATABASE_URL` | Sí | Cadena de conexión de Neon (con `sslmode=require`). Sin ella la app no arranca | `lib/db.ts` |
| `NEXTAUTH_SECRET` | Sí | Cifra la cookie de sesión y firma el JWT móvil. Cambiarla cierra todas las sesiones | `lib/auth.ts`, `lib/api-auth.ts`, login móvil |
| `NEXTAUTH_URL` | En desarrollo | URL base de NextAuth (en Vercel se detecta sola) | next-auth |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Para fotos | Cuenta de servicio de Google Drive | `lib/google-drive.ts`, `/api/qr/foto` |
| `GOOGLE_PRIVATE_KEY` | Para fotos | Llave privada de esa cuenta, con saltos de línea escritos como `\n` | ídem |
| `GOOGLE_DRIVE_FOLDER_ID` | Para fotos | Carpeta (o unidad compartida) donde se suben | `lib/google-drive.ts` |
| `CRON_SECRET` | Para el cron | Clave del encabezado `Authorization: Bearer` de la sincronización programada; la misma va en el secreto de GitHub Actions | `app/api/logistica/ordenes-cen/sincronizar/route.ts` |
| `CARVAJAL_SFTP_HOST/PORT/USER/PASSWORD/DIR` | Para EDI | SFTP de Carvajal (si falta HOST, USER o PASSWORD la fuente se omite) | `lib/cen/sftp.ts` |
| `SUBRIK_SFTP_HOST/PORT/USER/PASSWORD/DIR` | Para EDI | SFTP de Subrik | `lib/cen/sftp.ts` |
| `SIESA_CLIENT_ID`, `SIESA_CONNI_KEY`, `SIESA_CONNI_TOKEN` | Para Siesa | Credenciales de Connekta | `lib/siesa/connekta.ts` |
| `SIESA_API_URL` | No | Base de la API; **por defecto el ambiente QA** | `lib/siesa/connekta.ts` |
| `SIESA_ID_COMPANIA` | No | Id de compañía (defecto 9116) | ídem |
| `SIESA_REAL_CLIENT_ID`, `SIESA_REAL_CONNI_KEY`, `SIESA_REAL_CONNI_TOKEN` | Para pedidos institucionales | Credenciales de la API **real** de Siesa; por ahora solo se usan para buscar pedidos institucionales | `lib/siesa/connekta.ts`, `lib/cen/pedidosInstitucionales.ts` |
| `SIESA_REAL_API_URL`, `SIESA_REAL_ID_COMPANIA` | No | Base (defecto `https://api.siesacloud.com/connekta/siesa/estandar`) y compañía (defecto la de `SIESA_ID_COMPANIA`) de la API real | ídem |
| `CORREO_SMTP_USER`, `CORREO_SMTP_PASSWORD` | Para el aviso a facturación | Cuenta del departamento que envía los correos (Gmail o Google Workspace) y su **contraseña de aplicación** (requiere verificación en dos pasos en esa cuenta) | `lib/correo.ts` |
| `CORREO_SMTP_HOST`, `CORREO_SMTP_PORT`, `CORREO_REMITENTE` | No | Servidor SMTP (defecto `smtp.gmail.com`, puerto 465) y nombre del remitente (defecto "Logística Klarens") | ídem |
| `CORREO_FACTURACION_PARA`, `CORREO_FACTURACION_CC` | Para el aviso a facturación | Destinatarios del correo de pedidos creados en Siesa, separados por coma | `lib/cen/avisoFacturacion.ts` |
| `SIESA_CIA`, `SIESA_ID_DOCUMENTO_PEDIDO`, `SIESA_NOMBRE_DOCUMENTO_PEDIDO`, `SIESA_TIPO_DOCTO_PEDIDO`, `SIESA_EXT1_DETALLE` | No | Parámetros del conector de pedidos (defectos `1`, `142900`, `API_v1_Ventas_Comercial_PedidoVenta`, `PVS`, `FN`) | `lib/cen/pedidoSiesa.ts` |
| `SETUP_PASSWORD_<USUARIO>` | No | Solo para `scripts/setup-db.js`: contraseña inicial de ese usuario (si no, se genera una aleatoria) | `scripts/setup-db.js` |

Notas:

- `.env.local` de desarrollo contiene además `TRANSFERENCIAS_WEBHOOK_SECRET`, que ningún código usa: se puede retirar.
- Genera secretos con `openssl rand -base64 32`.
- Los scripts de `scripts/` leen `DATABASE_URL` del entorno de la terminal, no de `.env.local`.
