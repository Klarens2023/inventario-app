/**
 * Escapa texto para insertarlo dentro de HTML o SVG (contenido de etiquetas y
 * valores de atributos entre comillas).
 *
 * Seguridad: todo dato que venga de usuarios o de la BD y se arme como cadena
 * HTML (ventanas de impresión con document.write, banners SVG de sharp) debe
 * pasar por aquí; si no, un nombre como `<img src=x onerror=...>` se ejecuta
 * con la sesión de quien imprime (XSS almacenado).
 *
 * @param v cualquier valor; null/undefined se convierten en cadena vacía
 * @returns el texto con & < > " ' reemplazados por entidades
 */
export function escapeHtml(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
