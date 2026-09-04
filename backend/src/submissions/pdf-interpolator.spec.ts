import { interpolatePdfTemplate } from './pdf-interpolator';

describe('interpolatePdfTemplate', () => {
  const filesService = {
    download: jest.fn(),
  } as any;

  beforeEach(() => filesService.download.mockReset());

  const widgets = [
    { id: 'w1', type: 'text', label: 'Paciente' },
    { id: 'w2', type: 'text', label: 'Documento' },
    { id: 'wsig', type: 'signature', label: 'Firma' },
  ];

  it('reemplaza placeholders ${label} con valores string escapando HTML', async () => {
    const html = await interpolatePdfTemplate({
      template: '<p>Hola ${paciente} ${documento}</p>',
      data: { w1: 'María <b>López</b>', w2: '<CC 1234>' },
      widgets,
      filesService,
    });
    expect(html).toContain('María &lt;b&gt;López&lt;/b&gt;');
    expect(html).toContain('&lt;CC 1234&gt;');
  });

  it('resuelve referencia gridfs:<id> desde FilesService y embebe como data-URL', async () => {
    filesService.download.mockResolvedValue({
      buffer: Buffer.from([1, 2, 3]),
      contentType: 'image/png',
    });
    const html = await interpolatePdfTemplate({
      template: '<div>${firma}</div>',
      data: { wsig: 'gridfs:abc123' },
      widgets,
      filesService,
    });
    expect(html).toContain('<img src="data:image/png;base64,AQID"');
    expect(filesService.download).toHaveBeenCalledWith('abc123');
  });

  it('conserva data-URLs pre-existentes en el snapshot (retrocompat)', async () => {
    const html = await interpolatePdfTemplate({
      template: '<div>${firma}</div>',
      data: { wsig: 'data:image/png;base64,ZZZ' },
      widgets,
      filesService,
    });
    expect(html).toContain('<img src="data:image/png;base64,ZZZ"');
  });

  it('deja placeholder sin resolver como cadena vacía', async () => {
    const html = await interpolatePdfTemplate({
      template: '<p>${desconocido}</p>',
      data: {},
      widgets,
      filesService,
    });
    expect(html).toBe('<p></p>');
  });

  it('rechaza data-URL con caracteres inyectables (previene attribute injection)', async () => {
    const html = await interpolatePdfTemplate({
      template: '<div>${firma}</div>',
      // Intento de inyección: cerrar el atributo src y agregar onerror.
      data: { wsig: 'data:image/png;base64,ZZZ" onerror="alert(1)' },
      widgets,
      filesService,
    });
    expect(html).not.toContain('onerror');
    expect(html).toContain('[imagen no disponible]');
  });

  it('sanitiza contentType malformado devuelto por GridFS (fallback image/png)', async () => {
    filesService.download.mockResolvedValue({
      buffer: Buffer.from([1, 2, 3]),
      contentType: 'image/png" onerror="alert(1)',
    });
    const html = await interpolatePdfTemplate({
      template: '<div>${firma}</div>',
      data: { wsig: 'gridfs:abc123' },
      widgets,
      filesService,
    });
    expect(html).not.toContain('onerror');
    expect(html).toContain('<img src="data:image/png;base64,AQID"');
  });
});

describe('interpolatePdfTemplate — line breaks', () => {
  it('convierte \\n a <br/> en valores interpolados (para preservar párrafos)', async () => {
    const html = await interpolatePdfTemplate({
      template: 'Observaciones: ${observaciones}',
      data: { w1: 'Línea 1\nLínea 2\nLínea 3' },
      widgets: [{ id: 'w1', label: 'Observaciones', type: 'textarea' }],
      filesService: {} as never,
    });
    expect(html).toBe('Observaciones: Línea 1<br/>Línea 2<br/>Línea 3');
  });

  it('escapa HTML antes de convertir saltos de línea (no permite inyección)', async () => {
    const html = await interpolatePdfTemplate({
      template: '${obs}',
      data: { w1: '<script>alert(1)</script>\nsegunda' },
      widgets: [{ id: 'w1', label: 'obs', type: 'textarea' }],
      filesService: {} as never,
    });
    expect(html).toBe('&lt;script&gt;alert(1)&lt;/script&gt;<br/>segunda');
  });
});
