import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  FormSubmission,
  FormSubmissionDocument,
} from './form-submission.schema';

/**
 * Widget que, dentro del formulario de Cumplimiento, referencia actividades
 * que fueron planeadas por el usuario en un formulario de Planeación
 * previo. Al enviar el Cumplimiento, el array de llaves seleccionadas en
 * este widget se guarda en `submission.completesActivities` y el índice
 * único de la colección bloquea que dos envíos cierren la misma actividad.
 */
export const PENDING_ACTIVITY_WIDGET = 'pending_activity';

/**
 * Tope máximo de planeaciones revisadas por consulta de pendientes. Si un
 * usuario tiene más de este número, se usan las más recientes — el resto
 * ya debería haberse cumplido (o archivado). 500 es un colchón amplio
 * sobre uso real (un usuario típico planea ~20 actividades por semana).
 */
const MAX_PLANNING_SUBMISSIONS = 500;

/**
 * Formato de la llave de una actividad: `<submissionId>:<índice>`. El
 * índice es la posición de la fila dentro del subformulario de la
 * planeación. La regex es estricta: cualquier valor fuera de ese shape
 * se descarta en `toKeys` para no corromper el índice único del schema.
 */
const ACTIVITY_KEY = /^[^:]+:\d+$/;

export type PendingActivity = {
  key: string;
  submissionId: string;
  index: number;
  plannedAt: Date;
  /** Campos de la actividad (fila del subformulario). */
  fields: Record<string, unknown>;
  /** Campos generales de la planeación (fuera del subformulario). */
  context: Record<string, unknown>;
};

type SchemaWidget = { id: string; type: string };

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function toEntries(value: unknown): Record<string, unknown>[] {
  const v = parseJson(value);
  if (!Array.isArray(v)) return [];
  return v.filter(
    (e): e is Record<string, unknown> => !!e && typeof e === 'object',
  );
}

function toKeys(value: unknown): string[] {
  const v = parseJson(value);
  if (!Array.isArray(v)) return [];
  return v.filter(
    (k): k is string => typeof k === 'string' && ACTIVITY_KEY.test(k),
  );
}

@Injectable()
export class PlanningService {
  constructor(
    @InjectModel(FormSubmission.name)
    private readonly submissionModel: Model<FormSubmissionDocument>,
  ) {}

  /**
   * Devuelve las actividades que el usuario planeó y que todavía NO
   * tienen un Cumplimiento registrado. Se filtran las planeaciones
   * eliminadas vía soft delete (`deletedAt: null`) para que una
   * planeación borrada no siga apareciendo como actividad pendiente.
   */
  async findPending(
    userId: number,
    planningFormId: string,
    subformWidgetId: string,
  ): Promise<PendingActivity[]> {
    const plannings = await this.submissionModel
      .find({
        formId: planningFormId,
        submittedById: userId,
        deletedAt: null,
      })
      .sort({ submittedAt: -1 })
      .limit(MAX_PLANNING_SUBMISSIONS)
      .select('data submittedAt')
      .lean();

    const activities: PendingActivity[] = [];
    for (const p of plannings) {
      const data = (p.data ?? {}) as Record<string, unknown>;
      const { [subformWidgetId]: rawEntries, ...context } = data;
      toEntries(rawEntries).forEach((fields, index) => {
        activities.push({
          key: `${p._id}:${index}`,
          submissionId: String(p._id),
          index,
          plannedAt: p.submittedAt,
          fields,
          context,
        });
      });
    }
    if (activities.length === 0) return [];

    // distinct() colapsa el array `completesActivities` de cada
    // documento en un set plano — eficiente incluso con cientos de
    // cumplimientos. Solo mira los que tocan nuestras actividades.
    const completed = new Set(
      (await this.submissionModel.distinct('completesActivities', {
        completesActivities: { $in: activities.map((a) => a.key) },
        deletedAt: null,
      })) as string[],
    );
    return activities.filter((a) => !completed.has(a.key));
  }

  /**
   * Extrae del `data` del envío entrante las llaves de actividades que
   * este envío declara cumplir. Lee de todos los widgets de tipo
   * `pending_activity` del form; deduplica para que el índice único de
   * Mongo no rechace un envío que accidentalmente repitió una llave.
   */
  extractActivityKeys(
    schema: Record<string, unknown> | undefined,
    data: Record<string, unknown>,
  ): string[] {
    const widgets = ((schema?.widgets ?? []) as SchemaWidget[]).filter(
      (w) => w?.type === PENDING_ACTIVITY_WIDGET,
    );
    const keys = widgets.flatMap((w) => toKeys(data[w.id]));
    return [...new Set(keys)];
  }

  /**
   * Rechaza el envío ANTES de guardarlo si:
   *   (a) alguna actividad ya tiene cumplimiento registrado, o
   *   (b) alguna planeación no pertenece al usuario que envía.
   *
   * La condición (a) también está reforzada por el índice único del
   * schema — este check es la vía amable (error claro vs. 500), el
   * índice es la defensa en profundidad contra condiciones de carrera.
   */
  async assertCanComplete(
    keys: string[],
    userId: number | null,
  ): Promise<void> {
    if (keys.length === 0) return;

    const already = (await this.submissionModel.distinct(
      'completesActivities',
      {
        completesActivities: { $in: keys },
        deletedAt: null,
      },
    )) as string[];
    if (already.length > 0) {
      throw new ConflictException(
        `${already.length} de las actividades seleccionadas ya tienen cumplimiento. Recarga el formulario.`,
      );
    }

    const ids = [...new Set(keys.map((k) => k.split(':')[0]))];
    // `as any` como en submissions.service.ts (exportByForm): el _id del
    // schema es string (UUID v4 generado en @Prop), pero Mongoose infiere
    // ObjectId y rechaza el filter string sin el cast.
    const owners = await this.submissionModel
      .find({ _id: { $in: ids } } as any)
      .select('submittedById')
      .lean();
    const ownsAll =
      owners.length === ids.length &&
      owners.every(
        (o) => userId !== null && Number(o.submittedById) === Number(userId),
      );
    if (!ownsAll) {
      throw new ForbiddenException(
        'Solo puedes dar cumplimiento a tus propias planeaciones.',
      );
    }
  }
}
