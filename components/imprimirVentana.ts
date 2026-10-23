// Escribe un documento HTML en una ventana emergente y lanza el diálogo de
// impresión desde ESTA página (la que abrió la ventana).
//
// Antes cada formato llevaba `<script>window.onload = print</script>` dentro
// del HTML. Con la CSP por nonce (middleware.ts) ese script en línea no tiene
// nonce y el navegador lo bloquea: una ventana about:blank hereda la CSP de la
// página que la abrió. Llamar w.print() desde aquí no necesita ningún script
// dentro de la ventana.
export function escribirEImprimir(w: Window, html: string) {
  w.document.open()
  w.document.write(html)
  w.document.close()
  const imprimir = () => { w.focus(); w.print() }
  // close() termina el documento; 'load' llega cuando cargaron las imágenes
  // (logos), para no imprimir la hoja con huecos. Si ya cargó, se imprime ya.
  if (w.document.readyState === 'complete') imprimir()
  else w.addEventListener('load', imprimir, { once: true })
}
