import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name: string
      email: string
      rol: string
      area: string
      debe_cambiar_password: boolean
      /** Admin que debe activar la verificación en dos pasos antes de usar la app */
      debe_configurar_2fa?: boolean
      punto_venta_id: number | null
      modulos: string[]
      /** true si el usuario fue desactivado/eliminado después de iniciar sesión */
      revocado?: boolean
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    rol: string
    area: string
    debe_cambiar_password: boolean
    debe_configurar_2fa?: boolean
    punto_venta_id: number | null
    modulos: string[]
    /** Lo fija callbacks.jwt al revalidar contra la BD (lib/auth.ts) */
    revocado?: boolean
  }
}
