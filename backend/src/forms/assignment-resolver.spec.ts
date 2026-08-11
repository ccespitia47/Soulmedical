import { resolveAccessibleFormIds } from './assignment-resolver';

describe('resolveAccessibleFormIds', () => {
  const forms = [
    { id: 'f1', folderId: 'folA', projectId: 'p1' },
    { id: 'f2', folderId: 'folA', projectId: 'p1' },
    { id: 'f3', folderId: 'folB', projectId: 'p1' },
    { id: 'f4', folderId: 'folC', projectId: 'p2' },
  ];

  it('proyecto asignado da acceso a todos sus forms', () => {
    const r = resolveAccessibleFormIds(
      [{ projectId: 'p1', folderId: null, formId: null, excluded: false }],
      forms,
    );
    expect([...r].sort()).toEqual(['f1', 'f2', 'f3']);
  });

  it('excluir un form dentro del proyecto lo quita', () => {
    const r = resolveAccessibleFormIds(
      [
        { projectId: 'p1', folderId: null, formId: null, excluded: false },
        { projectId: null, folderId: null, formId: 'f2', excluded: true },
      ],
      forms,
    );
    expect([...r].sort()).toEqual(['f1', 'f3']);
  });

  it('excluir carpeta bloquea todos sus forms', () => {
    const r = resolveAccessibleFormIds(
      [
        { projectId: 'p1', folderId: null, formId: null, excluded: false },
        { projectId: null, folderId: 'folA', formId: null, excluded: true },
      ],
      forms,
    );
    expect([...r].sort()).toEqual(['f3']);
  });

  it('form directo sin proyecto asignado también da acceso', () => {
    const r = resolveAccessibleFormIds(
      [{ projectId: null, folderId: null, formId: 'f4', excluded: false }],
      forms,
    );
    expect([...r]).toEqual(['f4']);
  });

  it('exclusión sin ancestro positivo no bloquea nada de otros', () => {
    const r = resolveAccessibleFormIds(
      [
        { projectId: null, folderId: null, formId: 'f1', excluded: false },
        { projectId: null, folderId: null, formId: 'f2', excluded: true }, // sin efecto
      ],
      forms,
    );
    expect([...r]).toEqual(['f1']);
  });

  it('carpeta asignada + form excluido dentro', () => {
    const r = resolveAccessibleFormIds(
      [
        { projectId: null, folderId: 'folA', formId: null, excluded: false },
        { projectId: null, folderId: null, formId: 'f1', excluded: true },
      ],
      forms,
    );
    expect([...r]).toEqual(['f2']);
  });
});
