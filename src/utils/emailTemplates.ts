export const DEFAULT_EMAIL_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f0f4f8; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
    .header { background: #00c2a8; color: white; padding: 24px; text-align: center; }
    .content { padding: 24px; color: #374151; line-height: 1.6; }
    .footer { text-align: center; padding: 16px; border-top: 1px solid #e2e8f0; color: #9ca3af; font-size: 12px; }
    @media (max-width: 600px) { body { padding: 8px; } .content { padding: 16px; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1 style="margin:0;font-size:22px">Nuevo Registro Recibido</h1></div>
    <div class="content">
      <p>Hola,</p>
      <p>Se ha recibido un nuevo registro. Los detalles están en el PDF adjunto.</p>
      <p>Gracias por tu atención.</p>
    </div>
    <div class="footer"><p>Este email fue generado automáticamente por SoulForms</p></div>
  </div>
</body>
</html>`;

type WidgetField = { label: string };

export function buildPdfHtmlTemplate(widgets: WidgetField[]): string {
  const fields = widgets
    .map(
      (w) => `    <div class="field">
      <div class="field-label">${w.label}</div>
      <div class="field-value">\${${w.label
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[^a-z0-9]/gi, "")}}</div>
    </div>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f0f4f8; }
    .container { max-width: 700px; margin: 0 auto; background: white; border-radius: 8px; padding: 24px; }
    .header { background: #00c2a8; color: white; padding: 16px; border-radius: 8px 8px 0 0; text-align: center; margin: -24px -24px 24px; }
    .field { margin-bottom: 16px; padding: 12px; background: #f9fafb; border-left: 3px solid #00c2a8; border-radius: 0 6px 6px 0; }
    .field-label { font-weight: bold; color: #374151; margin-bottom: 4px; font-size: 12px; text-transform: uppercase; }
    .field-value { color: #111827; font-size: 14px; }
    .footer { text-align: center; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #9ca3af; font-size: 12px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1 style="margin:0;font-size:20px">Formulario Completado</h1></div>
${fields}
    <div class="footer"><p>Documento generado por SoulForms</p></div>
  </div>
</body>
</html>`;
}

export function renderWithPlaceholders(
  template: string,
  placeholders: Array<{ placeholder: string; description: string }>
): string {
  let html = template;
  placeholders.forEach((p) => {
    const escaped = p.placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    html = html.replace(new RegExp(escaped, "g"), `[Ejemplo: ${p.description}]`);
  });
  return html;
}
