import { Model } from 'mongoose';
import { UserFormAssignmentDocument } from './user-form-assignment.schema';

// Nombres canónicos (Mongoose los genera desde las keys). Si Sara personalizó
// nombres a mano en el pasado, tocará ajustar aquí. Los que estamos rebuild-ando
// son los 4 unique-parcial preexistentes que ahora deben filtrar excluded:false.
const LEGACY_INDEX_NAMES = [
  'formId_1_userId_1',
  'projectId_1_userId_1',
  'formId_1_groupId_1',
  'projectId_1_groupId_1',
];

export async function rebuildAssignmentIndexes(
  model: Model<UserFormAssignmentDocument>,
): Promise<void> {
  // Backfill campo excluded en docs legacy — el partial-filter-expression
  // {excluded: false} NO matchea field ausente en Mongo (a diferencia de null).
  // Sin este backfill los índices unique-parcial rebuild-eados quedan sin cubrir
  // los docs viejos y pierden la garantía de unicidad.
  await model.updateMany(
    { excluded: { $exists: false } },
    { $set: { excluded: false } },
  );

  const existing = await model.collection.indexes();

  for (const name of LEGACY_INDEX_NAMES) {
    const idx = existing.find((i) => i.name === name);
    if (idx && !('excluded' in (idx.partialFilterExpression ?? {}))) {
      // Índice legacy sin filtro excluded: se cae y Mongoose lo recrea con el
      // nuevo shape en el próximo syncIndexes().
      try {
        await model.collection.dropIndex(name);
      } catch (e: unknown) {
        const err = e as { codeName?: string; code?: number };
        if (err.codeName !== 'IndexNotFound' && err.code !== 27) throw e;
      }
    }
  }

  await model.syncIndexes();
}
