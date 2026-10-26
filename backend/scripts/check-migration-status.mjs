import 'dotenv/config';
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/soulformsdb';
await mongoose.connect(MONGO_URI);
const db = mongoose.connection.db;

const forms = await db
  .collection('forms')
  .find({ 'emailTemplate.toRecipients': { $exists: true, $ne: [] } })
  .project({ _id: 1, name: 1, 'emailTemplate.toRecipients': 1 })
  .toArray();

let okField = 0;
let okMe = 0;
let legacy = 0;
const legacyForms = [];

for (const f of forms) {
  const recipients = f.emailTemplate?.toRecipients ?? [];
  for (const r of recipients) {
    if (r.type === 'field') okField++;
    else if (r.type === 'group' && r.group === 'me') okMe++;
    else if (r.type === 'group' && r.group === 'current_user') {
      legacy++;
      legacyForms.push({ id: f._id, name: f.name });
    }
  }
}

console.log(`Recipients TO con type:'field'                        : ${okField}`);
console.log(`Recipients TO con group:'me'                          : ${okMe}`);
console.log(`Recipients TO con type:'group' + group:'current_user' : ${legacy}  (deberia ser 0)`);
if (legacyForms.length > 0) {
  console.log('\nForms que todavia tienen current_user activo (resolver backend los procesaria con heuristico):');
  for (const l of legacyForms) console.log(`  - ${l.name} (${l.id})`);
}

await mongoose.disconnect();
process.exit(0);
