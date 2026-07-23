import { FilesService } from '../files/files.service';

type Widget = { id: string; type: string; label?: string };

type Input = {
  template: string;
  data: Record<string, unknown>;
  widgets: Widget[];
  filesService: FilesService;
};

const GRIDFS_PREFIX = 'gridfs:';
const IMG_STYLE =
  'max-height:80px;max-width:100%;object-fit:contain;display:block;';

function escapeHtml(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugLabel(label: string): string {
  return label.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/gi, '');
}

/**
 * Combina el template HTML (con placeholders `${slug}`) + los datos del envío
 * (`widgetId → value`) + resolución de referencias `gridfs:<id>` → data-URL,
 * y devuelve el HTML listo para enviar a Puppeteer.
 */
export async function interpolatePdfTemplate(input: Input): Promise<string> {
  const { template, data, widgets, filesService } = input;

  // Mapa slug(label) → widgetId para expandir ${paciente} → data[widgetId]
  const bySlug = new Map<string, Widget>();
  for (const w of widgets) {
    if (w.label) bySlug.set(slugLabel(w.label), w);
  }

  // Resolver cada placeholder (async por gridfs)
  const parts: Array<string | Promise<string>> = [];
  let last = 0;
  const re = /\$\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(template))) {
    parts.push(template.slice(last, match.index));
    parts.push(resolveValue(match[1], data, bySlug, filesService));
    last = re.lastIndex;
  }
  parts.push(template.slice(last));

  const resolved = await Promise.all(parts.map(async (p) => await p));
  return resolved.join('');
}

async function resolveValue(
  key: string,
  data: Record<string, unknown>,
  bySlug: Map<string, Widget>,
  filesService: FilesService,
): Promise<string> {
  const widget = bySlug.get(key);
  const value = widget ? data[widget.id] : undefined;
  if (value == null) return '';
  const str = typeof value === 'string' ? value : JSON.stringify(value);

  if (str.startsWith('data:image/')) {
    return `<img src="${str}" style="${IMG_STYLE}">`;
  }

  if (str.startsWith(GRIDFS_PREFIX)) {
    const fileId = str.slice(GRIDFS_PREFIX.length);
    try {
      const { buffer, contentType } = await filesService.download(fileId);
      const b64 = buffer.toString('base64');
      return `<img src="data:${contentType};base64,${b64}" style="${IMG_STYLE}">`;
    } catch {
      return '<span style="color:#999">[imagen no disponible]</span>';
    }
  }

  return escapeHtml(str);
}
