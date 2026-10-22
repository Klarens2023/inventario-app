# Informe de auditoría — 22/10/2026

## Resumen ejecutivo

Aplicación Next.js 14 (App Router) + PostgreSQL en Neon, sin ORM, desplegada en
Vercel, con integraciones a Google Drive, SFTP EDI (Carvajal, Subrik) y Siesa
Connekta, y una app móvil externa que consume la misma API. No usa PWA, Service
Worker, IndexedDB/Dexie, Drizzle ni sincronización offline: esas partes del
encargo no aplican.

La base es razonable: toda la SQL está parametrizada, cada ruta API valida
permisos en el servidor, hay bloqueo por intentos fallidos, encabezados de
seguridad, bitácora de auditoría, el SFTP es de solo lectura y el kardex de
repuestos es transaccional. Los problemas más serios estaban en el **ciclo de
vida de la sesión** (un usuario desactivado seguía operando hasta 30 días con la
app móvil, y el cambio obligatorio de contraseña se podía saltar), en la
**integridad de datos** (recargar un inventario borraba conteos ya cerrados;
doble envío de pedidos a Siesa; duplicados en PVN) y en las **credenciales por
defecto** (contraseña genérica `123456` y contraseñas de administrador
publicadas en el README).

Se corrigieron 12 hallazgos en el código (incluido un bug del parser EDIFACT que
destapó una prueba nueva), se actualizaron dependencias sin cambios mayores, se
agregaron 11 pruebas automatizadas y la documentación de `docs/`. Quedan
pendientes decisiones de negocio (contraseña temporal aleatoria, alcance del
líder), la actualización mayor de Next.js y verificaciones operativas que
requieren acceso a producción.

## Alcance y método

- Acceso: lectura y escritura del repositorio local, terminal (Node 24.15, npm),
  servidor de desarrollo local. **Sin** acceso a Vercel, Neon de forma directa,
  GitHub remoto ni la app móvil. No se ingresaron credenciales ni se escribieron
  datos en la base de datos.
- Estado inicial de Git: `main` en `d32a4c1`, único cambio previo
  `tsconfig.tsbuildinfo`. Los cambios de la auditoría **no se confirmaron**.
- Referencias: OWASP Top 10 2021 (A01 control de acceso, A02 fallas
  criptográficas, A03 inyección, A04 diseño inseguro, A05 configuración, A06
  componentes vulnerables, A07 autenticación), CWE-79 (XSS), CWE-613 (expiración
  de sesión insuficiente), CWE-362 (condición de carrera), CWE-798/1392
  (credenciales por defecto), avisos de GitHub Advisory Database vía `npm audit`.

## Cobertura

| Área | Archivos | Revisión |
|---|---|---|
| Autenticación y autorización | `middleware.ts`, `lib/auth.ts`, `lib/api-auth.ts`, `lib/permissions.ts`, `lib/loginBruteForce.ts`, `types/next-auth.d.ts`, login web/móvil, cambio de contraseña | Completa, línea a línea |
| Rutas API | Las 56 rutas de `app/api/**/route.ts` | Completa para autenticación, autorización, validación y SQL. En `sistemas/repuestos/asignaciones/[id]` y `consumo` se revisaron autorización y parametrización, no cada regla de negocio |
| Lógica de servidor | `lib/cen/*`, `lib/siesa/connekta.ts`, `lib/repuestos*.ts`, `lib/google-drive.ts`, `lib/audit.ts`, `lib/db.ts` | Completa |
| Configuración y despliegue | `next.config.js`, `vercel.json`, `.github/workflows/*`, `.gitignore`, `.env.example`, `package.json`, `tsconfig.json` | Completa |
| Base de datos | `schema.sql`, restricciones e índices de `scripts/migrate-*.js`, `scripts/setup-db.js`, `scripts/seed-modulos.js` | Restricciones e integridad; no se ejecutó ninguna migración |
| Secretos | Archivos versionados e historial de Git (patrones de llaves privadas, tokens, cadenas de conexión) | Sin hallazgos en el repositorio. De `.env.local` solo se leyeron los **nombres** de variables |
| Interfaz | `components/movimientos/imprimirMovimiento.ts`, `components/repuestos/imprimir.ts`, búsqueda de `dangerouslySetInnerHTML`/`innerHTML`/`eval`/`document.write` en todo `app/` y `components/`, modales de usuarios, `app/cambiar-password` | Puntos de riesgo XSS y flujo de contraseña |
| Dependencias | `package-lock.json` | `npm audit` |

**No revisado en detalle** (riesgo bajo: código de cliente que procesa archivos
locales o arma vistas): `lib/planos/*`, `lib/conciliacion-facturas/*`,
`lib/exportExcel.ts`, `lib/repuestos-excel.ts`, `lib/api/*` (clientes `fetch`),
la mayoría de `components/**` y páginas, `scripts/import-*.js`,
`scripts/probar-*.js`. **Excluido:** `node_modules/`, `.next/`, `public/`,
`muestras-cen/` (datos reales; solo se usaron localmente para la prueba de
regresión del parser), `.env.local` (valores).

**Documentación en el código:** se agregaron JSDoc y comentarios de decisión en
los archivos tocados por la auditoría (autenticación, validaciones, carga de
inventario, envío de pedidos, parser, scripts). No se comentó cada archivo del
repositorio: el código existente ya tiene comentarios de intención en la mayoría
de rutas y módulos, y comentar línea a línea los ~27 000 líneas restantes no
aportaba al objetivo de seguridad.

## Resultados

- 27 hallazgos (detalle en [FINDINGS.md](FINDINGS.md)): 0 críticos confirmados en el código propio; 5 altos (1 en dependencia); 8 medios; 10 bajos; 4 informativos.
- Corregidos: AUD-01, 02, 03, 05, 06, 07, 09, 10, 11, 12, 14, 15. Parciales: AUD-04, 08, 25. Aceptado: AUD-19. Pendientes: el resto (ver [REMAINING-RISKS.md](REMAINING-RISKS.md)).
- Verificación: `tsc` 0 errores, `next build` correcto, 11/11 pruebas, regresión del parser con 15 muestras reales idéntica, prueba de humo sin sesión correcta. Detalle en [TESTING.md](TESTING.md).
- Cambios: [CHANGES.md](CHANGES.md).

## Estado tras la primera ronda

*Auditado con hallazgos importantes pendientes*: seguía abierto AUD-13 (Next.js con
avisos críticos) y faltaban las pruebas con usuarios reales. Ambos se resolvieron en la
segunda ronda; el estado vigente está al final de este documento.

## Segunda ronda (22/10/2026, tarde)

- **Investigación externa:** se consultaron la GitHub Advisory Database y los avisos de seguridad de Next.js de 2026. La línea 14 no tiene parches y 14.2.35 estaba expuesta a dos avisos **críticos** de ejecución remota de código; se actualizó a Next 15.5.28 + React 19 (AUD-13). next-auth 4.24.15 ya incluía las correcciones de 2026. Los dos avisos restantes de `npm audit` no aplican a esta configuración.
- **Corregidos además:** AUD-21, AUD-22, AUD-24, AUD-27 y el nuevo AUD-28; parciales AUD-17 y AUD-26. Nuevo pendiente de decisión: AUD-29.
- **Verificación:** tipos, 11 pruebas, build y prueba en vivo con el servidor de producción local (ver TESTING.md).

### Estado final

**Auditado con correcciones verificadas y riesgos residuales documentados.** No quedan
hallazgos críticos ni altos abiertos en el código. Riesgos residuales: límite de intentos por IP (AUD-17), CSP sin
nonces (AUD-24), esquema no reproducible (AUD-23) y verificaciones que dependen de
producción: credenciales publicadas en el historial (AUD-04), migración de índices
únicos (AUD-08) y el despliegue de estos cambios, que producción aún no tiene. Esto no certifica que la aplicación esté libre de
vulnerabilidades.

**Revisión externa de producción (autorizada):** el perímetro sin sesión está bien cerrado
(APIs 401, sin archivos sensibles publicados, sin mapas de código, errores genéricos). Producción
aún corre la versión anterior (Next 14.2.35, sin CSP, `/contabilidad` abierta): los riesgos ya
corregidos en el código siguen vigentes allá hasta desplegar. Detalle en TESTING.md.

**Decisiones del 22/10/2026:** se aplicaron AUD-16, AUD-18 y AUD-20 (verificadas en vivo, ver TESTING.md) y se aceptó AUD-29.
