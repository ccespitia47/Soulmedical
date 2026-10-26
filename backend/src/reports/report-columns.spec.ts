import {
  buildReportColumns,
  countSubformEntries,
  formatSubformCell,
  parseSubformEntries,
  type ReportWidget,
} from './report-columns';

describe('formatSubformCell', () => {
  it('aplana un arreglo JSON de checkbox a texto', () => {
    expect(formatSubformCell('["Opción 1"]')).toBe('Opción 1');
    expect(formatSubformCell('["Opción 1","Opción 2"]')).toBe('Opción 1, Opción 2');
  });

  it('devuelve strings planos tal cual', () => {
    expect(formatSubformCell('1015437174')).toBe('1015437174');
    expect(formatSubformCell('2026-07-29')).toBe('2026-07-29');
  });

  it('maneja vacíos', () => {
    expect(formatSubformCell(null)).toBe('');
    expect(formatSubformCell(undefined)).toBe('');
    expect(formatSubformCell('')).toBe('');
  });
});

describe('parseSubformEntries / countSubformEntries', () => {
  const raw =
    '[{"ig34gwuf":"1111111111","zwded3gd":"2026-07-29","zj4tg2wh":"[\\"Opción 1\\"]"}]';

  it('parsea el string JSON a entradas', () => {
    const entries = parseSubformEntries(raw);
    expect(entries).toHaveLength(1);
    expect(entries[0].ig34gwuf).toBe('1111111111');
  });

  it('cuenta entradas y tolera valores inválidos', () => {
    expect(countSubformEntries(raw)).toBe(1);
    expect(countSubformEntries('')).toBe(0);
    expect(countSubformEntries('no-json')).toBe(0);
    expect(countSubformEntries(null)).toBe(0);
  });
});

describe('buildReportColumns', () => {
  const subformWidget: ReportWidget = {
    id: 'sub_bio',
    label: 'Subformulario',
    type: 'subform',
    config: {
      fields: [
        { id: 'ig34gwuf', label: 'Teléfono', type: 'phone' },
        { id: 'zwded3gd', label: 'Fecha', type: 'date' },
        { id: 'zj4tg2wh', label: 'Opciones', type: 'checkbox' },
      ],
    },
  };

  it('expande el subformulario a una columna por campo interno (1 entrada)', () => {
    const cols = buildReportColumns([subformWidget], { sub_bio: 1 });
    expect(cols.map((c) => c.header)).toEqual([
      'Subformulario - Teléfono',
      'Subformulario - Fecha',
      'Subformulario - Opciones',
    ]);

    const data = {
      sub_bio:
        '[{"ig34gwuf":"1015437174","zwded3gd":"2026-07-28","zj4tg2wh":"[\\"Opción 1\\"]"}]',
    };
    expect(cols.map((c) => c.value(data))).toEqual([
      '1015437174',
      '2026-07-28',
      'Opción 1',
    ]);
  });

  it('numera columnas por entrada cuando hay varias entradas', () => {
    const cols = buildReportColumns([subformWidget], { sub_bio: 2 });
    expect(cols.map((c) => c.header)).toEqual([
      'Subformulario #1 - Teléfono',
      'Subformulario #1 - Fecha',
      'Subformulario #1 - Opciones',
      'Subformulario #2 - Teléfono',
      'Subformulario #2 - Fecha',
      'Subformulario #2 - Opciones',
    ]);

    const data = {
      sub_bio:
        '[{"ig34gwuf":"111","zwded3gd":"2026-01-01","zj4tg2wh":"[\\"A\\"]"},{"ig34gwuf":"222","zwded3gd":"2026-02-02","zj4tg2wh":"[\\"B\\",\\"C\\"]"}]',
    };
    expect(cols.map((c) => c.value(data))).toEqual([
      '111',
      '2026-01-01',
      'A',
      '222',
      '2026-02-02',
      'B, C',
    ]);
  });

  it('deja celdas vacías cuando un envío tiene menos entradas que el máximo', () => {
    const cols = buildReportColumns([subformWidget], { sub_bio: 2 });
    const data = {
      sub_bio: '[{"ig34gwuf":"111","zwded3gd":"2026-01-01","zj4tg2wh":"[\\"A\\"]"}]',
    };
    // La segunda entrada no existe -> columnas #2 vacías
    expect(cols.slice(3).map((c) => c.value(data))).toEqual(['', '', '']);
  });

  it('mezcla widgets normales y subformulario preservando el orden', () => {
    const text: ReportWidget = { id: 'w_text', label: 'Texto', type: 'text' };
    const cols = buildReportColumns([text, subformWidget], { sub_bio: 1 });
    expect(cols.map((c) => c.header)).toEqual([
      'Texto',
      'Subformulario - Teléfono',
      'Subformulario - Fecha',
      'Subformulario - Opciones',
    ]);
    expect(cols[0].value({ w_text: 'Prueba' })).toBe('Prueba');
  });

  it('cae a una sola columna si el subformulario no tiene campos definidos', () => {
    const empty: ReportWidget = {
      id: 'sub_empty',
      label: 'Subformulario',
      type: 'subform',
      config: { fields: [] },
    };
    const cols = buildReportColumns([empty], {});
    expect(cols).toHaveLength(1);
    expect(cols[0].header).toBe('Subformulario');
  });
});
