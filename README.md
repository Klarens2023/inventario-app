# 📦 Control de Inventario — Guía de Implementación

## PASO 1 — Instalar herramientas (solo una vez)

### 1.1 Node.js
- Descarga: https://nodejs.org → elige **LTS**
- Instala normalmente. Verifica abriendo CMD:
  ```
  node -v   → debe mostrar v18 o superior
  npm -v    → debe mostrar algo
  ```

### 1.2 Git
- Descarga: https://git-scm.com/download/win
- Instala con opciones por defecto

### 1.3 VS Code (recomendado)
- Descarga: https://code.visualstudio.com

---

## PASO 2 — Crear cuenta en Neon (base de datos gratuita)

1. Ve a https://neon.tech y crea una cuenta gratuita
2. Crea un **New Project**, nómbralo `inventario`
3. En el dashboard, copia la **Connection String** que dice:
   ```
   postgresql://user:password@ep-xxx.neon.tech/inventario?sslmode=require
   ```
4. Guárdala, la necesitas en el Paso 4

---

## PASO 3 — Crear el schema en Neon

1. En el dashboard de Neon, ve a **SQL Editor**
2. Abre el archivo `schema.sql` de este proyecto
3. Copia TODO el contenido y pégalo en el SQL Editor
4. Presiona **Run** → debe decir "Success" en verde

---

## PASO 4 — Configurar el proyecto localmente

1. Abre una terminal (CMD o PowerShell) en la carpeta del proyecto
2. Instala dependencias:
   ```
   npm install
   ```
3. Crea el archivo de variables de entorno:
   ```
   copy .env.example .env.local
   ```
4. Abre `.env.local` y llena los valores:
   ```
   DATABASE_URL="postgresql://...tu string de Neon..."
   NEXTAUTH_SECRET="cualquier-texto-largo-aleatorio-min-32-chars"
   NEXTAUTH_URL="http://localhost:3000"
   ```
   Para generar el secret puedes usar:
   https://generate-secret.vercel.app/32

---

## PASO 5 — Crear los usuarios iniciales

Con la terminal en la carpeta del proyecto:

**Windows CMD:**
```
set DATABASE_URL=postgresql://...tu-string... && node scripts/setup-db.js
```

**Windows PowerShell:**
```
$env:DATABASE_URL="postgresql://...tu-string..."; node scripts/setup-db.js
```

El script muestra **una sola vez** una contraseña temporal aleatoria por usuario
(o usa la de `SETUP_PASSWORD_ADMIN`, `SETUP_PASSWORD_USUARIO1`... si las defines).
Los usuarios quedan obligados a cambiarla al primer ingreso, y si ya existen no se modifican.

> ⚠️ No escribas contraseñas reales en este README ni en el código.

---

## PASO 6 — Probar en local

```
npm run dev
```

Abre http://localhost:3000 en el navegador.

Prueba de flujo completo:
1. **Login** con `admin` y la contraseña temporal que mostró `setup-db.js`
2. **Cargar inventario** → sube el archivo `inv22.txt` de prueba
3. **Conteo Físico** → selecciona la fecha, edita conteos y guarda
4. **Acumulados** → busca sin filtros para ver todo

---

## PASO 7 — Subir a GitHub

1. Crea una cuenta en https://github.com si no tienes
2. Crea un **New repository** (privado), nómbralo `inventario-control`
3. En la terminal del proyecto:
   ```
   git init
   git add .
   git commit -m "primer commit"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/inventario-control.git
   git push -u origin main
   ```

---

## PASO 8 — Desplegar en Vercel (producción)

1. Ve a https://vercel.com y crea cuenta (puedes entrar con GitHub)
2. Presiona **New Project**
3. Importa el repositorio `inventario-control` que creaste
4. En **Environment Variables** agrega:

   | Variable | Valor |
   |----------|-------|
   | `DATABASE_URL` | tu string de Neon |
   | `NEXTAUTH_SECRET` | el mismo secret que usaste en local |

   > `NEXTAUTH_URL` NO hace falta, Vercel lo pone automáticamente

5. Presiona **Deploy** → en 1-2 minutos tendrás una URL del tipo:
   ```
   https://inventario-control-xxx.vercel.app
   ```

---

## PASO 9 — Usuarios y contraseñas en producción

Para cambiar contraseñas, ve al **SQL Editor de Neon** y ejecuta:

```sql
-- Primero genera el hash con node (en tu PC local):
-- node -e "const b=require('bcryptjs'); b.hash('NuevaPass123!',10).then(h=>console.log(h))"

UPDATE usuarios
SET password_hash = '$2a$10$el-hash-generado-aqui'
WHERE username = 'admin';
```

---

## Estructura del proyecto

```
inventory-app/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/  ← autenticación
│   │   ├── inventario/          ← carga y consulta de datos
│   │   ├── conteo/              ← guardar conteo físico
│   │   ├── acumulados/          ← informe histórico
│   │   └── reiniciar/           ← borrar historial
│   ├── login/                   ← página de login
│   ├── dashboard/               ← inicio
│   ├── cargar/                  ← subir TXT
│   ├── consulta/                ← conteo físico editable
│   └── acumulados/              ← informe acumulados
├── components/
│   └── Sidebar.tsx              ← navegación lateral
├── lib/
│   ├── db.ts                    ← conexión Neon
│   └── auth.ts                  ← config NextAuth
├── scripts/
│   └── setup-db.js              ← crear usuarios iniciales
├── schema.sql                   ← tablas y vistas en PostgreSQL
└── .env.example                 ← plantilla de variables
```

---

## Solución de problemas comunes

| Error | Solución |
|-------|----------|
| `Cannot find module` | Corre `npm install` de nuevo |
| `Invalid DATABASE_URL` | Verifica que copiaste bien el string de Neon |
| `NEXTAUTH_SECRET missing` | Asegúrate que `.env.local` existe y tiene el secret |
| Login no funciona | Verifica que corriste `setup-db.js` con la DATABASE_URL correcta |
| Vercel error en build | Revisa que todas las variables de entorno están en el panel de Vercel |
