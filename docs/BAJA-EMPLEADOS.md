# Baja de un empleado (o cambio de cargo)

Qué hacer cuando alguien con acceso deja la empresa, cambia de cargo o
termina un contrato. **Hacerlo el mismo día de la salida**, idealmente
mientras se le entrega la carta o se recogen los equipos.

Primero ubicar en qué nivel está la persona. Los niveles se acumulan: alguien
de Sistemas también hace los pasos de los niveles 1 y 2.

| Nivel | Quién | Pasos |
|---|---|---|
| **1** | Cualquier usuario de la app: operativos y puntos de venta (PVN/PVV) | [Paso 1](#1-usuario-de-la-app-todos) |
| **2** | Administradores y líderes de la app | [Paso 1](#1-usuario-de-la-app-todos) + [Paso 2](#2-administradores-y-líderes) |
| **3** | Personal de Sistemas con acceso a Vercel, GitHub, Neon, Expo, Google o las claves | Pasos 1 + 2 + [Paso 3](#3-personal-de-sistemas-con-acceso-técnico) |

## 1. Usuario de la app (todos)

1. **/admin/usuarios** → buscar a la persona → **Desactivar**.
   - El acceso se corta **en el acto**, en la web y en la app móvil: cada petición vuelve a revisar en la base si el usuario está activo, así que una sesión abierta o un teléfono con la app ya no sirven.
   - **No se borra el usuario.** Desactivado, la bitácora (/auditoria) conserva su nombre en todo lo que hizo.
2. **Teléfono de un punto de venta:** si queda para otra persona, cerrar sesión en la app y entrar con el usuario nuevo. Nunca compartir el usuario del que se fue.
3. **Revisar /auditoria**, filtrando por la persona y los últimos días: inicios de sesión y acciones fuera de lo normal (pagos eliminados, cierres extraños, cambios de usuarios).
4. **Si se reemplaza a alguien en el mismo cargo:** crear un usuario nuevo para la persona nueva (con su contraseña temporal) en vez de reactivar o renombrar el anterior.

## 2. Administradores y líderes

Además del paso 1:

1. En **/auditoria**, filtrar las acciones **Usuario Creado** y **Usuario Modificado** de esa persona en las últimas semanas. Revisar que no haya dejado cuentas creadas, reactivadas o con más módulos de lo necesario.
2. Si conocía la contraseña de **otros** usuarios (por ejemplo, la temporal que entregó a alguien), **restablecerlas** desde /admin/usuarios.
3. Si era el **único** administrador, confirmar antes de desactivarlo que queda otra persona con rol admin.
4. Su verificación en dos pasos deja de servir al desactivarlo; no hace falta reiniciarla. Si **otro** admin le había dado sus códigos de recuperación o su celular estaba en su poder, reiniciar la verificación de ese otro admin.

## 3. Personal de Sistemas con acceso técnico

Además de los pasos 1 y 2. Con [SECRETOS.md](SECRETOS.md) a la mano, ir servicio por servicio.

### a) Quitar su acceso a las cuentas

| Servicio | Qué hacer |
|---|---|
| **Vercel** | Team → Members: quitarlo. Si usaba la cuenta compartida (`departamento_sistemas@…`), **cambiar su contraseña** y revisar la verificación en dos pasos |
| **GitHub** | Quitarlo como colaborador de `Klarens2023/inventario-app` y `louis-rook/…`. Si conocía la contraseña de la cuenta Klarens2023, cambiarla y revocar sus sesiones (Settings → Sessions) |
| **Neon** | Organization → Members: quitarlo. Si usaba la cuenta compartida, cambiar su contraseña |
| **Expo** | Organization `klarenss-organization` → Members: quitarlo |
| **Google** (Workspace / Cloud) | Suspender su cuenta. Revisar que no tenga acceso a la unidad compartida ni a la cuenta de servicio |
| **UptimeRobot** | Si estaba en los avisos, quitar su correo |
| **Gestor de contraseñas** | Quitarle el acceso a la bóveda de Sistemas |

### b) Cambiar las claves que pudo ver

Cambiar **todas las que la persona pudo conocer**. El procedimiento de cada una está en [SECRETOS.md](SECRETOS.md). En orden de prioridad:

| Clave | Efecto del cambio en la operación |
|---|---|
| Contraseñas de los roles de Neon (`neondb_owner`, `app_operaciones`, `app_respaldo`) | Ninguno, si se actualiza `DATABASE_URL` en Vercel y `RESPALDO_DATABASE_URL` en GitHub en el mismo momento |
| `GOOGLE_PRIVATE_KEY` (crear llave nueva y **borrar la vieja** en Google Cloud) | Ninguno, si se actualiza en Vercel y GitHub a la vez |
| `CRON_SECRET` | Ninguno, si se cambia en Vercel y GitHub a la vez y se hace Redeploy |
| `GITHUB_DISPATCH_TOKEN` y `NEON_API_KEY` (revocar y crear nuevos) | Ninguno |
| Contraseñas SFTP de Carvajal y Subrik, tokens de Siesa | Hay que pedirlas a cada proveedor; coordinar para no cortar la llegada de órdenes |
| `NEXTAUTH_SECRET` | **Cierra la sesión de todos** (web y app móvil): hacerlo fuera de horario y avisar |
| `RESPALDO_CLAVE` | Las copias nuevas usan la clave nueva. **Guardar también la vieja**: los respaldos de los últimos 30 días siguen cifrados con ella |
| Keystore de Android | **No se puede cambiar** sin reinstalar la app en todos los teléfonos. Si se sospecha que se lo llevó, evaluar con calma. El riesgo es que alguien firme una app falsa que se instale como actualización |

### c) Revisar actividad

- **Vercel → Deployments:** despliegues que no reconozcas.
- **GitHub → Actions y commits:** ejecuciones o cambios recientes de la persona.
- **Neon → Roles:** que no existan roles nuevos que no estén en SECRETOS.md:
  ```sql
  SELECT rolname FROM pg_roles WHERE rolname NOT LIKE 'pg\_%' ORDER BY 1;
  ```

## Registro

Al terminar, dejar constancia (correo a la jefatura o acta de entrega de cargo) con:
- nombre y nivel de la persona, y fecha de salida;
- usuario de la app desactivado (sí o no);
- accesos quitados y claves cambiadas, con fecha.

Revisado: 29/10/2026. Actualizar si se agregan servicios o claves (ver [SECRETOS.md](SECRETOS.md)).
