# Inventario de secretos

Lista de **todas** las claves y credenciales que usa el sistema: qué son, dónde
viven, qué se rompe si fallan y cómo se cambian. **Este archivo nunca lleva
valores reales** (el repositorio es público). Los valores van solo en el
gestor de contraseñas de Sistemas y en el servicio donde se usan.

Revisado: 27/10/2026. Actualizar cada vez que se agregue o cambie un secreto.

## Dónde se configuran

| Lugar | Qué guarda | Quién entra |
|---|---|---|
| **Vercel** → proyecto `inventario-app` → Settings → Environment Variables (Production) | Variables de la app web | Cuenta `departamento_sistemas@klarens.com.co` |
| **GitHub** → `Klarens2023/inventario-app` → Settings → Secrets and variables → Actions | Secretos de los workflows (EDI, respaldo, alerta) | Cuenta Klarens2023 |
| **Neon** → proyecto `inventario` | Usuarios y contraseñas de la base | Cuenta de Neon de Sistemas |
| **Expo / EAS** → `klarenss-organization` | Keystore de Android | Cuenta de Expo (`klarens`) |
| **Gestor de contraseñas de Sistemas** | Copia de todo lo marcado 🔑 | Solo Sistemas |

🔑 = guardarlo también en el gestor: el servicio no deja volver a verlo.
⚠️ = el mismo valor está en dos lugares y deben coincidir.

## Aplicación web (Vercel)

| Variable | Qué es | Si falta o está mal | Cómo cambiarla |
|---|---|---|---|
| `DATABASE_URL` 🔑 | Conexión a Neon con el rol **`app_operaciones`** (solo datos, sin DDL) | La app no abre nada (500) | [Base de datos](#base-de-datos-neon): cambiar la contraseña del rol y pegar la nueva cadena |
| `NEXTAUTH_SECRET` 🔑 | Firma las sesiones web y los tokens de la app móvil | Al cambiarla, **todos** cierran sesión (web y app) y deben volver a entrar | Generar 40+ caracteres aleatorios → Vercel → Redeploy |
| `NEXTAUTH_URL` | Dirección pública de la app (no es secreta). En Vercel no está definida: NextAuth la deduce sola | Solo hace falta en local u otro hosting | — |
| `CRON_SECRET` 🔑 ⚠️ | Clave de la sincronización EDI programada (Vercel Cron y GitHub) | Sincronización EDI responde 401 | Generar → Vercel **y** secreto de GitHub con el mismo valor → Redeploy |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` ⚠️ | Cuenta de servicio de Google (fotos y respaldos en Drive) | No se suben fotos de pagos, cierres ni formatos | Google Cloud → IAM → Service accounts |
| `GOOGLE_PRIVATE_KEY` 🔑 ⚠️ | Llave privada de esa cuenta de servicio | Igual que arriba | Google Cloud → la cuenta → Keys → Add key (JSON) → copiar `private_key` → Vercel y GitHub → borrar la llave vieja |
| `GOOGLE_DRIVE_FOLDER_ID` | Carpeta de fotos en la unidad compartida (no es secreto) | No se suben fotos | — |
| `CARVAJAL_SFTP_HOST`, `_PORT`, `_USER`, `_DIR` | Servidor EDI de Carvajal | No llegan órdenes de Carvajal | Los da Carvajal |
| `CARVAJAL_SFTP_PASSWORD` 🔑 | Contraseña SFTP de Carvajal | Igual | Pedir cambio a Carvajal → Vercel → Redeploy |
| `SUBRIK_SFTP_HOST`, `_PORT`, `_USER`, `_DIR` | Servidor EDI de Subrik | No llegan órdenes de Subrik | Los da Subrik |
| `SUBRIK_SFTP_PASSWORD` 🔑 | Contraseña SFTP de Subrik | Igual | Pedir cambio a Subrik → Vercel → Redeploy |
| `SIESA_CLIENT_ID`, `SIESA_CONNI_KEY` 🔑, `SIESA_CONNI_TOKEN` 🔑 | Credenciales de la API Connekta de Siesa | No se envían pedidos a Siesa | Las genera el administrador de Siesa/Connekta |
| `SIESA_API_URL`, `SIESA_CIA`, `SIESA_ID_COMPANIA`, `SIESA_*_DOCTO*`, `SIESA_EXT1_DETALLE` | Configuración de Siesa (no son secretas) | Pedidos rechazados o a la compañía equivocada | — |
| `GITHUB_DISPATCH_TOKEN` 🔑 | Token *fine-grained* de la cuenta Klarens2023, solo para el repositorio `inventario-app`, permiso **Actions: Read and write**. Vercel Cron lo usa para lanzar el respaldo (3 a. m.) y la alerta de consumo (7 a. m.) | No se lanzan el respaldo ni la alerta (la ruta responde 503 y queda en el log) | GitHub (Klarens2023) → Settings → Developer settings → Fine-grained tokens → Regenerate; **vence**: anotar la fecha y renovarlo antes |
| `TOTP_CLAVE` 🔑 | Clave maestra (32 bytes, base64) que cifra en la base la clave de la verificación en dos pasos de cada administrador y firma sus códigos de recuperación | Sin ella la verificación en dos pasos queda **apagada** (los admins entran solo con contraseña). Si se cambia o se pierde, las claves guardadas ya no se pueden leer: **todos los administradores deben activarla de nuevo** (reiniciarla en /admin/usuarios) | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` → Vercel → Redeploy → reiniciar la 2FA de cada admin. Solo cambiarla si se filtró |
| `DEPURAR_FOTOS` | `activo` **solo en Production** (no es secreta): habilita el borrado automático de fotos de pagos de más de 60 días. Sin ella, la tarea solo simula | Las fotos viejas no se depuran (se acumulan en Drive) | — |
| `TRANSFERENCIAS_WEBHOOK_SECRET` | Ningún código la usa (resto de una función anterior) | Nada | Se puede borrar de Vercel y de `.env.local` |
| `LOGIN_IPS_CONFIANZA` | Segmento de la empresa `190.242.100.248/29`, exento del límite de login por IP (no es secreto) | La oficina queda con el límite normal | Si cambia la IP pública de la empresa |

Después de cambiar cualquier variable en Vercel: **Deployments → el último → Redeploy**. Las variables solo aplican a despliegues nuevos.

## Workflows (GitHub, Klarens2023/inventario-app)

GitHub no deja volver a ver un secreto: lo marcado 🔑 tiene que estar en el gestor.
**Si el repositorio se borra o se recrea, se pierden todos** y hay que crearlos de nuevo (ver [RESPALDOS.md](RESPALDOS.md)).

| Secreto | Lo usa | Valor | Si falta |
|---|---|---|---|
| `APP_URL` | Sincronizar órdenes EDI | `https://operaciones.klarens.com.co` | El workflow no sincroniza (quedan los Vercel Cron) |
| `CRON_SECRET` 🔑 ⚠️ | Sincronizar órdenes EDI | El mismo de Vercel | 401 |
| `RESPALDO_DATABASE_URL` 🔑 | Respaldo | Producción, rol **`app_respaldo`** (solo lectura), host **sin** `-pooler` | No hay respaldo |
| `RESPALDO_CLAVE` 🔑 | Respaldo | Clave de cifrado AES-256 | **Sin ella ningún respaldo se puede abrir.** No cambiarla sin guardar la vieja: los respaldos anteriores siguen cifrados con ella |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` 🔑 ⚠️ | Respaldo | Los mismos de Vercel | No sube a Drive |
| `RESPALDO_DRIVE_FOLDER_ID` | Respaldo | Carpeta "Respaldos BD" | No sube a Drive |
| `PRUEBA_RESTAURACION_DATABASE_URL` 🔑 | Respaldo (prueba de los domingos) | Rama de **desarrollo**, rol `neondb_owner` | No se prueba la restauración |
| `NEON_API_KEY` 🔑 | Alerta de consumo | Clave de API de Neon | No hay alerta de consumo |

## Base de datos (Neon)

| Rol | Rama | Lo usa | Permisos |
|---|---|---|---|
| `neondb_owner` 🔑 | production | **Solo** migraciones desde el equipo de Sistemas. No va en Vercel ni en GitHub | Dueño de todo |
| `app_operaciones` 🔑 | production | Vercel (`DATABASE_URL`) | Leer y escribir datos, sin crear ni borrar tablas; bitácora solo lectura e inserción |
| `app_respaldo` 🔑 | production | GitHub (`RESPALDO_DATABASE_URL`) | Solo lectura |
| `neondb_owner` 🔑 | desarrollo (rama **QA**, servidor `ep-green-boat-ani2f7vo`, creada el 30/10/2026 con **Auto-delete: Never**; la anterior se borró sola) | `.env.local` del equipo de Sistemas y `PRUEBA_RESTAURACION_DATABASE_URL` | Dueño de la rama de pruebas |

**Cambiar la contraseña de un rol:**
- `neondb_owner`: Neon → Roles → `neondb_owner` → Reset password.
- `app_operaciones` o `app_respaldo`: SQL Editor (production, `neondb_owner`) → `ALTER ROLE <rol> WITH PASSWORD '<nueva>';`
- Después, armar la cadena nueva y actualizarla donde se use (Vercel o GitHub). Con `app_operaciones`: Redeploy en Vercel.

## App móvil

| Secreto | Dónde | Si se pierde |
|---|---|---|
| Keystore de Android (`.jks`, alias y dos contraseñas) 🔑 | Expo (EAS) y respaldo en lugar seguro | **No se puede actualizar la app instalada**: habría que desinstalarla en cada teléfono e instalar una con otra firma |
| `EXPO_PUBLIC_API_URL` | `eas.json` (no es secreto, va dentro del APK) | La app no conecta |

La app no guarda contraseñas: usa el token que firma `NEXTAUTH_SECRET`.

## Cuentas de servicios

Todas deben tener verificación en dos pasos y la contraseña en el gestor 🔑.

| Servicio | Para qué |
|---|---|
| Vercel | Despliegue de la web, variables, crons |
| GitHub (Klarens2023 y louis-rook) | Código, workflows y sus secretos |
| Neon | Base de datos, roles, restauración |
| Expo | Builds de la app y keystore |
| Google Cloud / Workspace | Cuenta de servicio y unidad compartida de Drive |
| UptimeRobot | Monitoreo de `/login` y `/api/salud` |

## Si un administrador pierde el acceso de dos pasos

En orden, de la opción más simple a la de emergencia:

1. **Código de recuperación:** en el login, en el campo del código, escribir uno de los 10 códigos `XXXX-XXXX` que se mostraron al activar la verificación. Cada uno sirve una vez. Luego, en /seguridad, generar códigos nuevos y, si cambió de celular, pedir el reinicio.
2. **Otro administrador:** /admin/usuarios → **Reiniciar 2 pasos**. Al entrar, vuelve a escanear un QR.
3. **Emergencia (no hay otro admin ni códigos):** quien tenga acceso a Neon, en el SQL Editor (rama production, rol `neondb_owner`), reemplazando `admin` por el usuario:
   ```sql
   DELETE FROM usuario_codigos_recuperacion WHERE usuario_id = (SELECT id FROM usuarios WHERE username = 'admin');
   UPDATE usuarios SET totp_clave = NULL, totp_pendiente = NULL, totp_activo = FALSE,
          totp_activado_en = NULL, totp_ultimo_paso = NULL
   WHERE username = 'admin';
   ```
   Al entrar con su contraseña, la app lo lleva a /seguridad para activarla otra vez. Dejar constancia: este cambio no queda en la bitácora de la app.

Para no llegar al paso 3: mantener **al menos dos administradores** y guardar los códigos de recuperación en el gestor de contraseñas.

## Si alguien con acceso deja la empresa

Ver [BAJA-EMPLEADOS.md](BAJA-EMPLEADOS.md).

## Si un secreto se filtra

1. **Cambiarlo de inmediato** según su fila de arriba. Primero en el servicio de origen (Neon, Google, Siesa…), luego donde se usa (Vercel o GitHub) y Redeploy.
2. **Revisar si se usó:** /auditoria (inicios de sesión y acciones), logs de Vercel, y en Neon → Monitoring.
3. **Dejar constancia** de qué se filtró, cuándo y qué se cambió.

Nunca pegar cadenas de conexión, claves ni tokens en chats, correos o capturas. Si pasa, cambiarlos.
