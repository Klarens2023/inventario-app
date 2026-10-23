// Configuración de ESLint (formato "flat" de ESLint 9).
// Usa las reglas recomendadas de Next.js (next/core-web-vitals) y de TypeScript.
// Se corre con: npm run lint
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'

// FlatCompat traduce las configuraciones antiguas (.eslintrc) que aún publica
// eslint-config-next al formato nuevo.
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) })

export default [
  // Carpetas generadas o de terceros: no se revisan
  { ignores: ['.next/**', 'node_modules/**', 'public/**', 'muestras-cen/**', 'next-env.d.ts', '.claude/**'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Los scripts de migración (CommonJS) usan require(): es lo esperado ahí
      '@typescript-eslint/no-require-imports': 'off',
      // Variables sin usar con prefijo _ son intencionales
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
]
