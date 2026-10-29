// Textos compartidos entre el servidor y las pantallas (sin dependencias de BD,
// para poder importarlo desde componentes de cliente como /login).

/** Error que devuelve el login web cuando falta el código de verificación. */
export const CODIGO_2FA_REQUERIDO = 'CODIGO_2FA_REQUERIDO'

/** Mensaje cuando el código (o el de recuperación) no es válido. */
export const CODIGO_2FA_INCORRECTO = 'Código de verificación incorrecto'
