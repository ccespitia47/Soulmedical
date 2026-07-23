import DOMPurify from "dompurify";

/**
 * Sanitiza HTML antes de inyectarlo con `dangerouslySetInnerHTML`.
 * Permite las etiquetas y atributos comunes que el editor de templates y
 * el widget HtmlBlock necesitan (tablas, listas, estilos inline, imágenes
 * data:URL para firmas), pero bloquea scripts y handlers JS inline.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ["style"],
    // Atributos que el HTML de plantillas necesita (colspan/rowspan en tablas,
    // class/id para que el <style> embebido aplique reglas .tg .tg-0pky, etc).
    ADD_ATTR: ["class", "id", "colspan", "rowspan", "style", "src", "alt"],
    // Permitimos data:image/... para que las firmas embebidas como base64
    // sigan renderizándose en previews. http:/https: para imágenes externas.
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    // Sin esto, DOMPurify puede tirar el contenido textual de <style>
    // (las reglas CSS) por ser considerado "código ejecutable". Lo
    // conservamos porque el sandbox del iframe/preview lo necesita.
    FORCE_BODY: false,
  });
}

/**
 * Variante especial para HTML que va a un PDF o iframe aislado: NO retoca
 * `<style>`, `<head>`, etiquetas semánticas raras, etc. Solo elimina lo
 * peligroso para ejecución (script, on*, javascript:). Úsalo cuando el HTML
 * no se inyecta en el DOM principal sino en un sandbox.
 */
export function sanitizeForPdf(html: string): string {
  return DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: true,
    ADD_TAGS: ["style", "link", "meta"],
    ADD_ATTR: ["class", "id", "colspan", "rowspan", "style", "src", "alt", "href", "type"],
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}
