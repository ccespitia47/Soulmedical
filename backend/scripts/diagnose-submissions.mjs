import 'dotenv/config';
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/soulformsdb';

await mongoose.connect(MONGO_URI);
const db = mongoose.connection.db;

const form = await db.collection('forms').findOne({ name: { $regex: 'aviso', $options: 'i' } });
console.log(`\n=== Form config: "${form.name}" (${form._id}) ===\n`);
console.log(`isPublic:                    ${form.isPublic}`);
console.log(`requiresEmailVerification:   ${form.requiresEmailVerification}`);
console.log(`sendConfirmationEmail:       ${form.sendConfirmationEmail}`);
console.log(`version:                     ${form.version}`);
console.log(`createdAt:                   ${form.createdAt}`);
console.log(`updatedAt:                   ${form.updatedAt}`);

// Buscar TODAS las submissions cuyo formId sea este UUID (exact) o cualquier variante
const exactCount = await db.collection('form_submissions').countDocuments({ formId: String(form._id) });
console.log(`\nSubmissions con formId EXACTO: ${exactCount}`);

// Otras colecciones que pudieran tener submissions públicas
const collections = await db.listCollections().toArray();
console.log(`\n=== Colecciones que contienen "submission", "public", "response", "record", "task" ===`);
for (const c of collections) {
  if (/submission|public|response|record|task|form_/i.test(c.name)) {
    const count = await db.collection(c.name).estimatedDocumentCount();
    console.log(`  ${c.name.padEnd(35)} ~${count} docs`);
  }
}

// Submissions donde el formId TIENE parte del uuid (por si hay prefijo/sufijo/versionado)
const uuidPart = String(form._id).slice(0, 8);
const fuzzy = await db.collection('form_submissions').find({
  formId: { $regex: uuidPart, $options: 'i' },
}).limit(5).project({ _id: 1, formId: 1, submittedAt: 1 }).toArray();
console.log(`\nSubmissions cuyo formId contiene "${uuidPart}": ${fuzzy.length}`);
for (const s of fuzzy) console.log(`  ${s.formId} - ${s.submittedAt}`);

// Últimas 10 submissions de CUALQUIER form, para ver si hay algo reciente que no cae en este form
const latest = await db.collection('form_submissions')
  .find({})
  .sort({ submittedAt: -1 })
  .limit(10)
  .project({ _id: 1, formId: 1, submittedAt: 1, submittedById: 1, taskId: 1, 'metadata.source': 1 })
  .toArray();
console.log(`\n=== Últimas 10 submissions (de cualquier form) ===\n`);
for (const s of latest) {
  const f = await db.collection('forms').findOne({ _id: s.formId }, { projection: { name: 1 } });
  console.log(`  ${s.submittedAt?.toISOString?.() ?? s.submittedAt}`);
  console.log(`    formId:  ${s.formId} → ${f?.name ?? '(form no encontrado)'}`);
  console.log(`    subById: ${s.submittedById} | taskId: ${s.taskId ?? '-'} | source: ${s.metadata?.source ?? '-'}`);
  console.log('');
}

await mongoose.disconnect();
process.exit(0);
