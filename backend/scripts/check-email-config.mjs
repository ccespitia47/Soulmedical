import 'dotenv/config';
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/soulformsdb';
await mongoose.connect(MONGO_URI);
const db = mongoose.connection.db;

// Trae todos los forms públicos y revisa si su emailTemplate está enabled + toRecipients
const forms = await db.collection('forms')
  .find({ isPublic: true })
  .project({ _id: 1, name: 1, emailTemplate: 1, sendConfirmationEmail: 1 })
  .toArray();

console.log(`\n=== ${forms.length} formularios públicos ===\n`);
for (const f of forms) {
  const tmpl = f.emailTemplate ?? {};
  const enabled = tmpl.enabled === true;
  const toRecipients = tmpl.toRecipients ?? [];
  const subject = tmpl.subject ?? '(sin subject)';
  const bodyLen = (tmpl.emailBody ?? '').length;
  const hasPlaceholders = /\$\{[^}]+\}/.test(tmpl.emailBody ?? '');
  console.log(`"${f.name}"  (_id: ${f._id})`);
  console.log(`  emailTemplate.enabled:       ${enabled}`);
  console.log(`  toRecipients:                ${toRecipients.length}`);
  console.log(`  sendConfirmationEmail:       ${f.sendConfirmationEmail === true}`);
  console.log(`  emailBody length:            ${bodyLen} chars`);
  console.log(`  emailBody usa placeholders:  ${hasPlaceholders}`);
  console.log(`  subject:                     "${subject}"`);
  const wouldSend = enabled && toRecipients.length > 0;
  console.log(`  ¿Emitiría email al hacer submit público? ${wouldSend ? 'SÍ' : 'NO'}`);
  console.log('');
}

await mongoose.disconnect();
process.exit(0);
