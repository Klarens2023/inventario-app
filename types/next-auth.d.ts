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
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    rol: string
    area: string
    debe_cambiar_password: boolean
  }
}
