/**
 * Migración: EmailRecipient { type:'group', group:'current_user' } → tipo exacto
 *
 * Contexto del fix:
 *   El grupo "current_user" resolvía el destinatario tomando el PRIMER valor
 *   del submission con forma de email. En formularios con varios campos email
 *   (médico, cuidador, paciente), el PDF firmado podía llegar al correo
 *   equivocado. Si no encontraba email en el formData caía al correo del
 *   usuario logueado — comportamiento oculto, frágil.
 *
 * Reglas (por cada recipient current_user en to/cc/bcc):
 *   - Form tiene EXACTAMENTE 1 widget type:'email' → reescribe a
 *     `{ type:'field', widgetId, widgetLabel }`. Resolución determinista.
 *   - Form NO tiene ningún widget type:'email' → reescribe a
 *     `{ type:'group', group:'me', groupLabel:'Yo (usuario actual)' }`. Equivale
 *     al fallback oculto que ya hacía (correo del usuario logueado), pero
 *     explícito en vez de incidental.
 *   - Form tiene >1 widgets email (ambiguo) → lo deja intacto y lo lista para
 *     revisión manual.
 *
 * Uso:
 *   node backend/scripts/migrate-current-user-to-field.mjs           (dry-run)
 *   node backend/scripts/migrate-current-user-to-field.mjs --apply   (escribe)
 *
 * Idempotente: ejecutarlo dos veces no toca lo que ya quedó como "field"/"me".
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const APPLY = process.argv.includes('--apply');
const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://localhost:27017/soulformsdb';

const RECIPIENT_FIELDS = ['toRecipients', 'ccRecipients', 'bccRecipients'];

function getEmailWidgets(form) {
  const widgets = form?.schema?.widgets;
  if (!Array.isArray(widgets)) return [];
  return widgets.filter((w) => w && w.type === 'email');
}

function widgetLabel(w) {
  const cfg = w?.config ?? {};
  return (
    (typeof cfg.label === 'string' && cfg.label.trim()) ||
    (typeof cfg.placeholder === 'string' && cfg.placeholder.trim()) ||
    w.id
  );
}

function migrateRecipientList(list, emailWidgets, report) {
  if (!Array.isArray(list)) return { list, changed: false };
  let changed = false;
  const next = list.map((r) => {
    if (!r || r.type !== 'group' || r.group !== 'current_user') return r;
    if (emailWidgets.length === 1) {
      changed = true;
      report.migrated++;
      const w = emailWidgets[0];
      return {
        ...r,
        type: 'field',
        widgetId: w.id,
        widgetLabel: widgetLabel(w),
        // Dejamos group/groupLabel para que un rollback manual sea trivial;
        // el resolver backend ignora esos campos cuando type === 'field'.
      };
    }
    if (emailWidgets.length === 0) {
      // Sin widget email, el grupo current_user caía al correo del usuario
      // logueado. Lo hacemos explícito reescribiendo a 'me'.
      changed = true;
      report.migratedToMe++;
      return {
        ...r,
        type: 'group',
        group: 'me',
        groupLabel: 'Yo (usuario actual)',
      };
    }
    report.ambiguous++;
    return r;
  });
  return { list: next, changed };
}

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const coll = db.collection('forms');

  const forms = await coll
    .find({ emailTemplate: { $ne: null } })
    .project({ _id: 1, name: 1, schema: 1, emailTemplate: 1 })
    .toArray();

  const summary = {
    inspected: forms.length,
    withCurrentUser: 0,
    migrated: 0,        // → type:'field'
    migratedToMe: 0,    // → type:'group', group:'me'
    ambiguous: 0,       // sin resolver automático (>1 widget email)
    formsUpdated: 0,
  };

  const unresolved = [];

  for (const form of forms) {
    const tmpl = form.emailTemplate ?? {};
    const emailWidgets = getEmailWidgets(form);

    // ¿Este form siquiera usa current_user en algún recipient?
    const touchesCurrentUser = RECIPIENT_FIELDS.some(
      (k) =>
        Array.isArray(tmpl[k]) &&
        tmpl[k].some(
          (r) => r && r.type === 'group' && r.group === 'current_user',
        ),
    );
    if (!touchesCurrentUser) continue;
    summary.withCurrentUser++;

    const perForm = { migrated: 0, migratedToMe: 0, ambiguous: 0 };
    const nextTmpl = { ...tmpl };
    let formChanged = false;
    for (const key of RECIPIENT_FIELDS) {
      const { list, changed } = migrateRecipientList(
        tmpl[key],
        emailWidgets,
        perForm,
      );
      if (changed) {
        nextTmpl[key] = list;
        formChanged = true;
      }
    }
    // Acumulamos agregados globales.
    summary.migrated += perForm.migrated;
    summary.migratedToMe += perForm.migratedToMe;
    summary.ambiguous += perForm.ambiguous;

    if (formChanged) {
      summary.formsUpdated++;
      if (APPLY) {
        await coll.updateOne(
          { _id: form._id },
          { $set: { emailTemplate: nextTmpl } },
        );
      }
    }

    if (perForm.ambiguous > 0) {
      unresolved.push({
        formId: form._id,
        name: form.name,
        emailWidgetCount: emailWidgets.length,
        emailWidgetIds: emailWidgets.map((w) => w.id),
        ambiguous: perForm.ambiguous,
      });
    }
  }

  console.log(APPLY ? '\n=== APLICANDO CAMBIOS ===' : '\n=== DRY-RUN ===');
  console.log(JSON.stringify(summary, null, 2));

  if (unresolved.length > 0) {
    console.log(
      `\n⚠ ${unresolved.length} formulario(s) con casos AMBIGUOS (edición manual):\n`,
    );
    for (const u of unresolved) {
      console.log(`• "${u.name}" (${u.formId})`);
      console.log(
        `    Motivo: tiene ${u.emailWidgetCount} widgets email, hay que elegir cuál`,
      );
      console.log(`    widgetIds email: ${u.emailWidgetIds.join(', ')}`);
      console.log(`    Recipients ambiguos pendientes: ${u.ambiguous}`);
    }
  }

  if (!APPLY) {
    console.log(
      '\n(dry-run) Sin cambios en BD. Para aplicar, re-ejecutar con  --apply',
    );
  } else {
    const total = summary.migrated + summary.migratedToMe;
    console.log(
      `\n✔ Actualizados ${summary.formsUpdated} formulario(s), ${total} recipient(s) convertido(s) (${summary.migrated} → field, ${summary.migratedToMe} → me).`,
    );
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('ERROR:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
