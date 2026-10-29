import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { sql } from './db'
import {
  compararSenuelo, ipCliente, mensajeBloqueoIp, minutosBloqueoIp, minutosRestantesBloqueo,
  registrarFalloIp, registrarIntentoFallido, resetearIntentosFallidos,
} from './loginBruteForce'
import { cargarEstadoUsuario } from './estadoUsuario'
import { registrarInicioSesion } from './audit'
import { rolRequiereDosPasos, segundoFactorLogin } from './dosPasos'
import { CODIGO_2FA_REQUERIDO, CODIGO_2FA_INCORRECTO } from './dosPasosConstantes'

// ════════════════════════════════════════════════════════════════════════════
// Configuración de NextAuth: inicio de sesión WEB con usuario y contraseña.
// (La app móvil usa su propio login: app/api/auth/mobile/login/route.ts.)
//
// Flujo:
//  1. authorize(): valida credenciales contra la tabla usuarios, con límite de
//     intentos por IP y por usuario (lib/loginBruteForce.ts), y el código de
//     verificación en dos pasos de los administradores (lib/dosPasos.ts).
//  2. callbacks.jwt(): al iniciar sesión copia los datos al token (cookie
//     cifrada); en cada lectura posterior los vuelve a leer de la BD.
//  3. callbacks.session(): arma lo que ven las páginas y las rutas API.
// ════════════════════════════════════════════════════════════════════════════

const SESION_PVN_PVV_SEGUNDOS = 24 * 60 * 60 // 24 horas
const SESION_DEFAULT_SEGUNDOS = 8 * 60 * 60  // 8 horas (admin, lider, usuario)

export const authOptions: NextAuthOptions = {
  // maxAge es el techo (para que la cookie no expire antes que el JWT de
  // pvn/pvv); la duración real por rol se fija abajo en el callback jwt,
  // escribiendo token.exp directamente.
  session: { strategy: 'jwt', maxAge: SESION_PVN_PVV_SEGUNDOS },
  pages: {
    signIn: '/login',
    error:  '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Usuario', type: 'text' },
        password: { label: 'Contraseña', type: 'password' },
        // Solo administradores con verificación en dos pasos: código de 6 dígitos o de recuperación
        codigo: { label: 'Código de verificación', type: 'text' },
      },
      async authorize(credentials, req) {
        // Sin usuario o sin contraseña no hay nada que validar
        if (!credentials?.username || !credentials?.password) return null

        // Primero el límite por IP: si la conexión está bloqueada no se consulta
        // ni se compara nada (tampoco se gasta tiempo de bcrypt).
        const ip = ipCliente(req?.headers)
        const minutosIp = await minutosBloqueoIp(ip)
        if (minutosIp > 0) throw new Error(mensajeBloqueoIp(minutosIp))

        // Solo usuarios activos; un usuario desactivado se trata como inexistente
        const rows = await sql`
          SELECT id, username, password_hash, nombre, rol, area, debe_cambiar_password, punto_venta_id,
                 bloqueado_hasta,
                 -- to_jsonb: NULL en vez de error si la migración de 2FA aún no se corrió
                 COALESCE((to_jsonb(usuarios) ->> 'totp_activo')::boolean, false) AS totp_activo
          FROM usuarios
          WHERE username = ${credentials.username}
            AND activo = true
          LIMIT 1
        `

        if (rows.length === 0) {
          // Usuario inexistente o inactivo: también cuenta como fallo de la IP
          await compararSenuelo(credentials.password)
          await registrarFalloIp(ip)
          return null
        }

        const user = rows[0]

        // Cuenta bloqueada por 5 fallos seguidos: se avisa sin comparar la contraseña
        const minutosRestantes = minutosRestantesBloqueo({ bloqueado_hasta: user.bloqueado_hasta })
        if (minutosRestantes > 0) {
          throw new Error(`Demasiados intentos fallidos. Intenta de nuevo en ${minutosRestantes} minuto(s).`)
        }

        // bcrypt compara contra el hash guardado (nunca se guarda la contraseña)
        const valid = await bcrypt.compare(credentials.password, user.password_hash)
        if (!valid) {
          const quedoBloqueado = await registrarIntentoFallido(user.id)
          await registrarFalloIp(ip)
          await registrarInicioSesion({
            resultado: quedoBloqueado ? 'bloqueado' : 'fallido', usuarioId: user.id, username: user.username,
            canal: 'web', ip, navegador: req?.headers?.['user-agent'] as string | undefined, motivo: 'contraseña incorrecta',
          })
          return null
        }
        // Segundo paso (solo administradores): código de la app autenticadora
        const factor = await segundoFactorLogin(user as { id: number; rol: string; totp_activo: boolean }, credentials.codigo)
        // Sin código: la pantalla de login lo pide y vuelve a enviar todo (no cuenta como fallo)
        if (factor === 'falta-codigo') throw new Error(CODIGO_2FA_REQUERIDO)
        if (factor === 'invalido') {
          // Un código errado cuenta igual que una contraseña errada: a los 5 se bloquea la cuenta
          const quedoBloqueado = await registrarIntentoFallido(user.id)
          await registrarFalloIp(ip)
          await registrarInicioSesion({
            resultado: quedoBloqueado ? 'bloqueado' : 'fallido', usuarioId: user.id, username: user.username,
            canal: 'web', ip, navegador: req?.headers?.['user-agent'] as string | undefined, motivo: 'código de verificación incorrecto',
          })
          throw new Error(quedoBloqueado ? 'Demasiados intentos fallidos. Intenta de nuevo en 15 minuto(s).' : CODIGO_2FA_INCORRECTO)
        }

        // Contraseña (y código, si aplica) correctos: el contador de fallos vuelve a cero
        await resetearIntentosFallidos(user.id)
        // Rastro del ingreso (quién, cuándo, desde qué IP): ver /auditoria
        await registrarInicioSesion({
          resultado: 'exitoso', usuarioId: user.id, username: user.username,
          canal: 'web', ip, navegador: req?.headers?.['user-agent'] as string | undefined,
          motivo: factor === 'recuperacion' ? 'con código de recuperación' : factor === 'totp' ? 'con verificación en dos pasos' : undefined,
        })

        // try/catch: si la migración de usuario_modulos aún no se ha corrido,
        // no debe romper el login de nadie — simplemente no hay módulos extra.
        let modulos: string[] = []
        try {
          const modulosRows = await sql`SELECT modulo FROM usuario_modulos WHERE usuario_id = ${user.id}`
          modulos = modulosRows.map(r => r.modulo as string)
        } catch {}

        const rol = user.rol ?? 'usuario'
        // Admin siempre va a área 'general', sin importar lo que tenga en BD
        const area = rol === 'admin' ? 'general' : (user.area ?? 'logistica')
        // Este objeto llega como `user` al callback jwt (solo en el inicio de sesión)
        return {
          id: String(user.id),
          name: user.nombre,
          email: user.username,
          rol,
          area,
          debe_cambiar_password: user.debe_cambiar_password ?? false,
          totp_activo: Boolean(user.totp_activo),
          punto_venta_id: user.punto_venta_id ?? null,
          modulos,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as { id: string; name?: string; rol?: string; area?: string; debe_cambiar_password?: boolean; totp_activo?: boolean; punto_venta_id?: number | null; modulos?: string[] }
        token.id                    = u.id
        token.name                  = u.name
        token.rol                   = u.rol ?? 'usuario'
        token.area                  = u.rol === 'admin' ? 'general' : (u.area ?? 'logistica')
        token.debe_cambiar_password = u.debe_cambiar_password ?? false
        token.debe_configurar_2fa   = rolRequiereDosPasos(u.rol) && !u.totp_activo
        token.punto_venta_id        = u.punto_venta_id ?? null
        token.modulos               = u.modulos ?? []

        // Sesión más larga para pvn/pvv (24h) que para el resto (8h); se fija
        // solo al iniciar sesión, no en cada refresco del token.
        const duracion = ['pvn', 'pvv'].includes(token.rol as string)
          ? SESION_PVN_PVV_SEGUNDOS
          : SESION_DEFAULT_SEGUNDOS
        token.exp = Math.floor(Date.now() / 1000) + duracion
        return token
      }

      // Seguridad: en cada lectura de la sesión (getServerSession, /api/auth/session,
      // useSession().update()) se vuelve a leer el usuario en la BD. Así un usuario
      // desactivado pierde el acceso de inmediato y los cambios de rol, módulos o
      // "debe cambiar contraseña" aplican sin esperar a que venza el JWT.
      // Antes, update({ debe_cambiar_password: false }) desde el navegador bastaba
      // para saltarse el cambio obligatorio de contraseña: ahora manda la BD.
      try {
        const estado = await cargarEstadoUsuario(token.id)
        if (!estado) {
          token.revocado = true
          token.modulos = []
        } else {
          token.revocado              = false
          token.rol                   = estado.rol
          token.area                  = estado.area
          token.punto_venta_id        = estado.punto_venta_id
          token.debe_cambiar_password = estado.debe_cambiar_password
          token.debe_configurar_2fa   = estado.debe_configurar_2fa
          token.modulos               = estado.modulos
        }
      } catch (e) {
        // Si la BD no responde se conservan los datos del token (comportamiento
        // anterior) en vez de cerrar la sesión de todos por un fallo transitorio;
        // la sesión sigue acotada por su vencimiento (8 h / 24 h).
        console.error('[auth] No se pudo revalidar la sesión contra la BD:', e)
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        // Sesión revocada (usuario inactivo o eliminado) o con cambio de contraseña
        // pendiente: se publica sin rol ni módulos, para que las rutas que usan
        // getServerSession directamente nieguen todo con su chequeo de rol/módulo.
        // /api/cambiar-password solo necesita el id (usa getAuthUser).
        // También mientras un admin no active la verificación en dos pasos.
        const restringida = Boolean(token.revocado) || Boolean(token.debe_cambiar_password) || Boolean(token.debe_configurar_2fa)
        session.user.id                    = token.id as string
        session.user.name                  = token.name as string
        session.user.rol                   = restringida ? '' : (token.rol as string)
        session.user.area                  = (token.area as string) ?? (token.rol === 'admin' ? 'general' : 'logistica')
        session.user.debe_cambiar_password = token.debe_cambiar_password as boolean
        session.user.debe_configurar_2fa   = Boolean(token.debe_configurar_2fa)
        session.user.punto_venta_id        = (token.punto_venta_id as number | null) ?? null
        session.user.modulos               = restringida ? [] : ((token.modulos as string[]) ?? [])
        session.user.revocado              = Boolean(token.revocado)
      }
      return session
    },
  },
}
