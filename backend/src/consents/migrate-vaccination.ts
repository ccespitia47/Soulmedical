/**
 * Migración one-off: submissions viejas del formulario de Vacunación (SAI/SOUL,
 * `backend/src/consents/consents.seeder.ts`) → colección `consent_records` del
 * motor de consentimientos.
 *
 * - Idempotente: upsert por `origenSubmissionId` (id de la form_submission de
 *   origen). Volver a correrla no duplica registros.
 * - Reversible: los documentos migrados quedan marcados con
 *   `origenSubmissionId`, lo que permite borrarlos (`{ origenSubmissionId: { $ne: null } }`)
 *   si algo sale mal.
 * - Segura por defecto: corre en DRY-RUN (no escribe) salvo que se pase
 *   `--apply`. `--dry-run` fuerza el modo seco incluso si además se pasa
 *   `--apply` (gana la opción más segura).
 *
 * Uso (desde backend/):
 *   npx ts-node src/consents/migrate-vaccination.ts             # dry-run
 *   npx ts-node src/consents/migrate-vaccination.ts --dry-run   # dry-run explícito
 *   npx ts-node src/consents/migrate-vaccination.ts --apply     # aplica (escribe)
 */
import 'dotenv/config';
import mongoose, { model } from 'mongoose';
import {
  FormSubmission,
  FormSubmissionSchema,
} from '../submissions/form-submission.schema';
import {
  ConsentRecord,
  ConsentRecordSchema,
  Entidad,
  EstadoConsentimiento,
  TipoConsentimiento,
} from './consent-record.schema';
import { consentHash } from './consent-hash';

/** formId de Vacunación (consents.seeder.ts) → entidad correspondiente. */
export const VACCINATION_FORM_IDS: Record<string, Entidad> = {
  'consent-vaccination-soul': 'SOUL',
  'consent-vaccination-sai': 'SAI',
};

// Ids de campo VIEJOS de la submission (soulConfig.ts / consents.seeder.ts),
// no los del nuevo ConsentRecord. La vacunación no tiene apellido separado
// (se mapea a `nombres` completo y `apellidos = null`).
const IDENTITY_FIELD_IDS = [
  'pacienteNombre',
  'pacienteTipoDoc',
  'pacienteNumDoc',
  'ciudad',
] as const;
const SIGNATURE_FIELD_IDS = ['firma', 'firmaResponsable'] as const;
const MAPPED_FIELD_IDS = new Set<string>([
  ...IDENTITY_FIELD_IDS,
  ...SIGNATURE_FIELD_IDS,
]);

/** Submission mínima que necesita el mapeo (subset de FormSubmission/lean doc). */
export type SubmissionLike = {
  _id: unknown;
  submittedById?: number | null;
  submittedAt?: Date;
  data: Record<string, unknown>;
};

/**
 * Mapea una submission vieja de Vacunación al shape de `ConsentRecord`.
 * Función pura (no toca la BD) — misma forma canónica de `base` que usa
 * `ConsentsService` para que `hashVerificacion` sea compatible con `verificar`.
 */
export function mapSubmissionToConsent(
  sub: SubmissionLike,
  entidad: Entidad,
): Partial<ConsentRecord> {
  const data = sub.data ?? {};

  const respuestas: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!MAPPED_FIELD_IDS.has(key)) respuestas[key] = value;
  }

  const base = {
    tipo: TipoConsentimiento.VACUNACION,
    entidad: entidad ?? null,
    tipoDoc: (data.pacienteTipoDoc as string | undefined) ?? null,
    numDoc: (data.pacienteNumDoc as string | undefined) ?? null,
    nombres: (data.pacienteNombre as string | undefined) ?? null,
    apellidos: null,
    ciudad: (data.ciudad as string | undefined) ?? null,
    profesional: null,
    respuestas,
    firmaPaciente: (data.firma as string | undefined) ?? null,
    firmaResponsable: (data.firmaResponsable as string | undefined) ?? null,
    foto: null,
  };

  const hashVerificacion = consentHash(base as unknown as Record<string, unknown>);

  const result = {
    ...base,
    estado: EstadoConsentimiento.FIRMADO,
    hashVerificacion,
    origenSubmissionId: sub._id != null ? String(sub._id) : null,
    createdById: sub.submittedById ?? null,
    createdAt: sub.submittedAt ?? new Date(),
  };

  return result as unknown as Partial<ConsentRecord>;
}

export interface RunMigrationOptions {
  dryRun?: boolean;
}

export interface RunMigrationResult {
  scanned: number;
  toInsert: number;
  toUpdate: number;
  upserted: number;
}

/**
 * Conecta a Mongo (misma variable de entorno que `app.module.ts`), lee las
 * submissions de los formIds de Vacunación, mapea y hace upsert idempotente
 * por `origenSubmissionId`. En `dryRun` (default) no escribe nada.
 */
export async function runMigration(
  { dryRun = true }: RunMigrationOptions = {},
): Promise<RunMigrationResult> {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/soulformsdb';
  await mongoose.connect(mongoUri);

  try {
    const SubmissionModel =
      (mongoose.models[FormSubmission.name] as mongoose.Model<FormSubmission>) ||
      model(FormSubmission.name, FormSubmissionSchema);
    const ConsentModel =
      (mongoose.models[ConsentRecord.name] as mongoose.Model<ConsentRecord>) ||
      model(ConsentRecord.name, ConsentRecordSchema);

    const formIds = Object.keys(VACCINATION_FORM_IDS);
    const submissions = await SubmissionModel.find({ formId: { $in: formIds } }).lean();

    const submissionIds = submissions.map((s: any) => String(s._id));
    const existing = await ConsentModel.find(
      { origenSubmissionId: { $in: submissionIds } },
      { origenSubmissionId: 1 },
    ).lean();
    const alreadyMigrated = new Set(existing.map((d: any) => d.origenSubmissionId));

    let toInsert = 0;
    let toUpdate = 0;
    let upserted = 0;

    for (const sub of submissions as unknown as SubmissionLike[]) {
      const entidad = VACCINATION_FORM_IDS[(sub as any).formId as string];
      const mapped = mapSubmissionToConsent(sub, entidad);
      const isUpdate = alreadyMigrated.has(mapped.origenSubmissionId as string);
      if (isUpdate) toUpdate++;
      else toInsert++;

      if (!dryRun) {
        await ConsentModel.updateOne(
          { origenSubmissionId: mapped.origenSubmissionId },
          { $set: mapped },
          { upsert: true },
        );
        upserted++;
      }
    }

    console.log(
      `\n=== Migración Vacunación → consent_records (${dryRun ? 'DRY-RUN' : 'APLICANDO'}) ===`,
    );
    console.log(`Submissions encontrados: ${submissions.length}`);
    console.log(`A insertar (nuevos): ${toInsert}`);
    console.log(`Ya migrados (se actualizarían): ${toUpdate}`);
    if (!dryRun) {
      console.log(`Upserts realizados: ${upserted}`);
    } else {
      console.log(
        '(SECO) no se escribió nada. Para aplicar: npx ts-node src/consents/migrate-vaccination.ts --apply',
      );
    }

    return { scanned: submissions.length, toInsert, toUpdate, upserted };
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  // --dry-run siempre gana (aunque también se pase --apply): por seguridad,
  // ante ambigüedad la migración con efecto sobre datos NO corre.
  const dryRun = argv.includes('--dry-run') || !argv.includes('--apply');

  runMigration({ dryRun })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('ERROR en migración:', err);
      process.exit(1);
    });
}
