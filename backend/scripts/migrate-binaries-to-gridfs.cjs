/**
 * Migración: mueve firmas/fotos guardadas inline (base64 data URL) dentro de
 * form_submissions.data a GridFS (bucket "submission_files"), reemplazando el
 * valor por una referencia "gridfs:<fileId>".
 *
 * - Idempotente: ignora valores que ya son "gridfs:..." o que no son data URLs.
 * - Seguro: por defecto corre en SECO (no escribe). Para aplicar: --apply
 *
 * Uso:
 *   node scripts/migrate-binaries-to-gridfs.cjs            # simulación
 *   node scripts/migrate-binaries-to-gridfs.cjs --apply    # aplica cambios
 */
require('dotenv/config');
const mongoose = require('mongoose');

const BINARY_TYPES = new Set(['signature', 'photo']);
const GRIDFS_PREFIX = 'gridfs:';
const BUCKET_NAME = 'submission_files';

const APPLY = process.argv.includes('--apply');
const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://localhost:27017/soulformsdb';

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET_NAME });

  // 1) Mapa formId -> { widgetId -> tipo } para widgets binarios
  const forms = await db.collection('forms').find({}).toArray();
  const binaryByForm = new Map();
  for (const f of forms) {
    const widgets = (f.schema && f.schema.widgets) || [];
    const map = new Map();
    for (const w of widgets) if (BINARY_TYPES.has(w.type)) map.set(w.id, w.type);
    if (map.size) binaryByForm.set(f._id, map);
  }

  const subsCol = db.collection('form_submissions');
  const cursor = subsCol.find({});

  let scanned = 0;
  let migratedFields = 0;
  let migratedDocs = 0;
  const details = [];

  while (await cursor.hasNext()) {
    const sub = await cursor.next();
    scanned++;
    const binMap = binaryByForm.get(sub.formId);
    if (!binMap) continue;

    const data = sub.data || {};
    const updates = {};

    for (const [widgetId, kind] of binMap) {
      const value = data[widgetId];
      if (typeof value !== 'string') continue;
      if (value.startsWith(GRIDFS_PREFIX)) continue; // ya migrado
      const match = /^data:([^;]+);base64,(.+)$/s.exec(value);
      if (!match) continue; // vacío u otro formato

      const contentType = match[1];
      const buffer = Buffer.from(match[2], 'base64');
      if (buffer.length === 0) continue;

      if (APPLY) {
        const fileId = await new Promise((res, rej) => {
          const us = bucket.openUploadStream(`${kind}_${widgetId}`, {
            metadata: {
              kind,
              formId: sub.formId,
              widgetId,
              submittedById: sub.submittedById ?? null,
              contentType,
              migratedFrom: sub._id,
            },
          });
          us.on('error', rej);
          us.on('finish', () => res(String(us.id)));
          us.end(buffer);
        });
        updates[`data.${widgetId}`] = `${GRIDFS_PREFIX}${fileId}`;
      }

      migratedFields++;
      details.push(
        `  sub ${sub.submittedAt ? new Date(sub.submittedAt).toISOString().slice(0, 10) : '?'} | form ${sub.formId.slice(0, 8)} | widget ${widgetId} | ${kind} | ${buffer.length} bytes`,
      );
    }

    if (APPLY && Object.keys(updates).length) {
      await subsCol.updateOne({ _id: sub._id }, { $set: updates });
      migratedDocs++;
    } else if (!APPLY && details.length) {
      // en seco contamos doc si tuvo algún campo a migrar
      const hadField = Object.keys(data).some(
        (k) =>
          binMap.has(k) &&
          typeof data[k] === 'string' &&
          data[k].startsWith('data:'),
      );
      if (hadField) migratedDocs++;
    }
  }

  console.log(`\n=== Migración binarios → GridFS (${APPLY ? 'APLICANDO' : 'SIMULACIÓN'}) ===`);
  console.log(`Submissions escaneados: ${scanned}`);
  console.log(`Documentos con binarios a migrar: ${migratedDocs}`);
  console.log(`Campos (firma/foto) migrados: ${migratedFields}`);
  if (details.length) {
    console.log('\nDetalle:');
    console.log(details.join('\n'));
  }
  if (!APPLY && migratedFields > 0) {
    console.log('\n(SECO) Para aplicar de verdad: node scripts/migrate-binaries-to-gridfs.cjs --apply');
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
