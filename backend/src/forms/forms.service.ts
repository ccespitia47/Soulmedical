import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  OnModuleInit,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import type { SubmissionsService } from '../submissions/submissions.service';
import { AssignmentHistoryService } from '../audit-history/assignment-history.service';
import { Form, FormDocument } from './form.schema';
import {
  UserFormAssignment,
  UserFormAssignmentDocument,
} from './user-form-assignment.schema';
import {
  PublicFormOtp,
  PublicFormOtpDocument,
} from './public-form-otp.schema';
import { Folder, FolderDocument } from '../folders/folder.schema';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';
import type { EmailRecipient } from '../email/email.types';
import { rebuildAssignmentIndexes } from './user-form-assignment-indexes';
import { resolveAccessibleFormIds } from './assignment-resolver';
import type { AssignmentRow } from './assignment-resolver';

// Vida del OTP de acceso a formularios públicos (decisión del producto).
const OTP_TTL_MINUTES = 2;
const OTP_MAX_ATTEMPTS = 3;
// Vida del JWT que el frontend usa para hacer el submit tras verificar OTP.
// Mayor que el TTL del OTP para que el usuario tenga tiempo de llenar.
const PUBLIC_FORM_ACCESS_TTL = '30m';
const GENERIC_OTP_RESPONSE =
  'Si tu correo está autorizado, recibirás un código en breve.';

@Injectable()
export class FormsService implements OnModuleInit {
  private readonly logger = new Logger(FormsService.name);

  constructor(
    @InjectModel(Form.name) private readonly formModel: Model<FormDocument>,
    @InjectModel(UserFormAssignment.name)
    private readonly assignmentModel: Model<UserFormAssignmentDocument>,
    @InjectModel(PublicFormOtp.name)
    private readonly otpModel: Model<PublicFormOtpDocument>,
    @InjectModel(Folder.name)
    private readonly folderModel: Model<FolderDocument>,
    private readonly emailService: EmailService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    // ModuleRef en vez de inyectar SubmissionsService directo: SubmissionsModule
    // importa FormsModule para FormsService, así que inyectarlo de vuelta arma un
    // ciclo real que forwardRef no puede resolver (Nest lanza UndefinedModuleException
    // en bootstrap). ModuleRef nos deja resolver el servicio en runtime cuando ya
    // está listo — usado desde submitPublic() para persistir el submit del enlace
    // público, que antes solo enviaba emails.
    private readonly moduleRef: ModuleRef,
    // AuditHistoryModule es @Global(), así que se inyecta directo. Se usa
    // para archivar cada asignación antes de borrarla (conserva historia).
    private readonly assignmentHistory: AssignmentHistoryService,
  ) {}

  async onModuleInit(): Promise<void> {
    await rebuildAssignmentIndexes(this.assignmentModel);
  }

  async create(dto: CreateFormDto, userId: number): Promise<FormDocument> {
    const form = new this.formModel({
      name: dto.name,
      folderId: dto.folderId,
      schema: dto.schema ?? { widgets: [] },
      emailTemplate: dto.emailTemplate ?? null,
      createdById: userId,
    });
    return form.save();
  }

  async findByFolder(
    folderId: string,
    userId?: number,
    role?: string,
  ): Promise<FormDocument[]> {
    if (role === 'user' && userId) {
      const accessibleFormIds = await this.getAccessibleFormIds(userId);
      return (this.formModel as any)
        .find({
          folderId,
          isActive: true,
          _id: { $in: [...accessibleFormIds] },
        })
        .sort({ createdAt: 1 });
    }
    return this.formModel.find({ folderId, isActive: true }).sort({ createdAt: 1 });
  }

  async findAssignedToUser(userId: number): Promise<FormDocument[]> {
    const accessibleFormIds = await this.getAccessibleFormIds(userId);
    return (this.formModel as any)
      .find({ _id: { $in: [...accessibleFormIds] }, isActive: true })
      .sort({ createdAt: 1 });
  }

  /**
   * Resuelve el set de formIds accesibles para un usuario considerando
   * asignaciones directas, por carpeta y por proyecto, restando las
   * exclusiones (ver `resolveAccessibleFormIds`).
   *
   * IMPORTANTE: traemos TODOS los assignments del user (positivos +
   * exclusiones) — no filtramos `excluded: false` aquí porque las
   * exclusiones son necesarias para restar acceso heredado.
   */
  private async getAccessibleFormIds(userId: number): Promise<Set<string>> {
    const [assignments, forms, folders] = await Promise.all([
      this.assignmentModel.find({ userId }),
      this.formModel.find({}, { folderId: 1 }),
      this.folderModel.find({}, { projectId: 1 }),
    ]);

    const projectByFolder = new Map<string, string>(
      folders.map((f) => [f._id as string, f.projectId]),
    );

    const assignmentRows: AssignmentRow[] = assignments.map((a) => ({
      formId: a.formId,
      folderId: a.folderId,
      projectId: a.projectId,
      excluded: a.excluded,
    }));

    const allForms = forms.map((f) => ({
      id: f._id as string,
      folderId: f.folderId,
      projectId: projectByFolder.get(f.folderId) ?? '',
    }));

    return resolveAccessibleFormIds(assignmentRows, allForms);
  }

  async findOne(id: string): Promise<FormDocument> {
    const form = await this.formModel.findById(id);
    if (!form || !form.isActive)
      throw new NotFoundException(`Formulario ${id} no encontrado`);
    return form;
  }

  // Para reporting/export (Power BI): incluye formularios archivados
  // (isActive=false). Los envíos históricos deben poder reportarse aunque
  // el formulario se haya archivado en la app. 404 solo si no existe.
  async findOneForExport(id: string): Promise<FormDocument> {
    const form = await this.formModel.findById(id);
    if (!form) throw new NotFoundException(`Formulario ${id} no encontrado`);
    return form;
  }

  // ── Acceso público ────────────────────────────────────────────────────────

  async findPublic(
    id: string,
    accessToken?: string,
  ): Promise<{
    id: string;
    name: string;
    widgets: unknown[];
    rules: unknown[];
    isPublic: boolean;
    sendConfirmationEmail: boolean;
    requiresEmailVerification: boolean;
    /** true cuando el frontend ya verificó OTP y trae el accessToken válido. */
    verified: boolean;
  }> {
    const form = await this.formModel.findById(id);
    if (!form || !form.isActive)
      throw new NotFoundException('Formulario no encontrado');
    if (!form.isPublic)
      throw new ForbiddenException('Este formulario no está disponible públicamente');

    const requiresEmailVerification = form.requiresEmailVerification ?? false;
    const verified =
      !requiresEmailVerification ||
      this.isValidPublicFormAccessToken(accessToken, id);

    const schema = (form.schema as any) ?? {};
    return {
      id: form._id as string,
      name: form.name,
      // Si requiere verificación y aún no se verificó, NO entregamos el schema:
      // así el atacante no puede leer la estructura del formulario sin pasar OTP.
      widgets: verified ? (schema.widgets ?? []) : [],
      rules: verified ? (schema.rules ?? []) : [],
      isPublic: form.isPublic,
      sendConfirmationEmail: form.sendConfirmationEmail ?? true,
      requiresEmailVerification,
      verified,
    };
  }

  // ── 2FA por email para formularios públicos ────────────────────────────────

  /**
   * Genera un OTP de 6 dígitos y lo manda al correo SOLO si ese correo está
   * registrado como usuario activo. La respuesta es siempre genérica para
   * evitar enumeración (un atacante no puede saber si un email existe).
   */
  async requestPublicFormOtp(
    formId: string,
    rawEmail: string,
  ): Promise<{ message: string }> {
    const form = await this.formModel.findById(formId);
    if (!form || !form.isActive)
      throw new NotFoundException('Formulario no encontrado');
    if (!form.isPublic)
      throw new ForbiddenException('Este formulario no está disponible públicamente');
    if (!form.requiresEmailVerification) {
      // Si el form no requiere verificación, no tiene sentido pedir OTP.
      return { message: 'Este formulario no requiere verificación' };
    }

    const email = (rawEmail ?? '').trim().toLowerCase();
    const validFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    // Respuesta genérica en TODOS los casos donde no enviamos código:
    // formato inválido, usuario inexistente o usuario inactivo.
    if (!validFormat) return { message: GENERIC_OTP_RESPONSE };

    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive) {
      this.logger.warn(
        `OTP rechazado: ${email} no es un usuario autorizado para form ${formId}`,
      );
      return { message: GENERIC_OTP_RESPONSE };
    }

    // Generamos código criptográficamente seguro (no Math.random).
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    // Invalidamos OTPs anteriores del mismo par (form, email) para que solo
    // el último código emitido sea válido.
    await this.otpModel.deleteMany({ formId, email });
    await this.otpModel.create({ formId, email, codeHash, expiresAt });

    try {
      await this.emailService.sendPublicFormOtp({
        to: email,
        formName: form.name,
        code,
        ttlMinutes: OTP_TTL_MINUTES,
      });
    } catch (err) {
      this.logger.error('[requestPublicFormOtp] Error enviando OTP:', err);
      // No filtramos el error: respuesta genérica igualmente.
    }

    return { message: GENERIC_OTP_RESPONSE };
  }

  /**
   * Verifica el código OTP. Si es correcto, emite un JWT corto que el
   * frontend usará como Bearer token al cargar el schema y al hacer submit.
   *
   * Lleva contador de intentos en el documento OTP: al 3er intento fallido
   * lo borra y el usuario debe solicitar uno nuevo.
   */
  async verifyPublicFormOtp(
    formId: string,
    rawEmail: string,
    code: string,
  ): Promise<{ accessToken: string; expiresInMinutes: number }> {
    const form = await this.formModel.findById(formId);
    if (!form || !form.isActive)
      throw new NotFoundException('Formulario no encontrado');
    if (!form.isPublic)
      throw new ForbiddenException('Este formulario no está disponible públicamente');

    const email = (rawEmail ?? '').trim().toLowerCase();
    const cleanCode = (code ?? '').replace(/\s+/g, '');
    if (!email || cleanCode.length !== 6) {
      throw new UnauthorizedException('Código inválido.');
    }

    const otp = await this.otpModel.findOne({ formId, email });
    if (!otp || otp.expiresAt.getTime() < Date.now()) {
      if (otp) await this.otpModel.deleteOne({ _id: otp._id });
      throw new UnauthorizedException(
        'El código expiró. Solicita uno nuevo.',
      );
    }

    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      await this.otpModel.deleteOne({ _id: otp._id });
      throw new UnauthorizedException(
        'Demasiados intentos fallidos. Solicita un código nuevo.',
      );
    }

    const codeHash = crypto.createHash('sha256').update(cleanCode).digest('hex');
    if (codeHash !== otp.codeHash) {
      await this.otpModel.updateOne(
        { _id: otp._id },
        { $inc: { attempts: 1 } },
      );
      throw new UnauthorizedException('Código incorrecto.');
    }

    // OTP correcto → consumirlo (un solo uso) y emitir access token.
    await this.otpModel.deleteOne({ _id: otp._id });
    const accessToken = this.jwtService.sign(
      { scope: 'public_form', formId, email },
      { expiresIn: PUBLIC_FORM_ACCESS_TTL },
    );
    return { accessToken, expiresInMinutes: 30 };
  }

  /** Devuelve true si el token es válido para el formId dado. */
  private isValidPublicFormAccessToken(
    rawToken: string | undefined,
    formId: string,
  ): boolean {
    if (!rawToken) return false;
    const token = rawToken.replace(/^Bearer\s+/i, '').trim();
    try {
      const payload = this.jwtService.verify<{
        scope?: string;
        formId?: string;
        email?: string;
      }>(token);
      return payload.scope === 'public_form' && payload.formId === formId;
    } catch {
      return false;
    }
  }

  async submitPublic(
    id: string,
    body: Record<string, unknown>,
    accessToken?: string,
  ): Promise<{ success: boolean; message: string }> {
    const form = await this.formModel.findById(id);
    if (!form || !form.isActive)
      throw new NotFoundException('Formulario no encontrado');
    if (!form.isPublic)
      throw new ForbiddenException('Este formulario no está disponible públicamente');

    // Si el form exige verificación por correo, el submit DEBE traer el
    // accessToken que se obtuvo en /verify-otp. Sin token o con uno inválido
    // se rechaza.
    if (form.requiresEmailVerification) {
      if (!this.isValidPublicFormAccessToken(accessToken, id)) {
        throw new UnauthorizedException(
          'Acceso no autorizado. Verifica tu correo primero.',
        );
      }
    }

    const formData = (body.data as Record<string, string>) ?? {};
    const userEmail = (body.email as string) ?? '';
    // Lookups externos (chips tipo 'lookup' en el template de email) los
    // resuelve el navegador — nos manda el mapa `{recipientId: email}`.
    // Lo propagamos al emailService.
    const resolvedRecipients =
      (body.resolvedRecipients as Record<string, string>) ?? {};

    // Persiste la submission en Mongo — sin esto los envíos del enlace
    // público NUNCA aparecían en el reporte "Registros y PDFs" ni en el
    // Excel. Resolvemos SubmissionsService via ModuleRef (lazy) para
    // evitar ciclo con SubmissionsModule; strict:false porque vive en
    // otro módulo del árbol. userId=undefined porque el submitter es
    // anónimo.
    //
    // Política: PROPAGAR errores. Sara pidió que "nada se pierda". Si el
    // guardado falla, el cliente recibe 500 y reintenta; NO enviamos email
    // ni respondemos success con datos perdidos.
    const { SubmissionsService } = await import('../submissions/submissions.service');
    const submissionsService = this.moduleRef.get<SubmissionsService>(
      SubmissionsService,
      { strict: false },
    );
    let submissionDoc;
    try {
      submissionDoc = await submissionsService.submit(id, { data: formData }, undefined);
    } catch (err) {
      this.logger.error(
        `[submitPublic] FALLO guardando submission del form ${id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
        err instanceof Error ? err.stack : undefined,
      );
      throw new InternalServerErrorException(
        'No pudimos guardar tu envío. Por favor intenta de nuevo en unos segundos.',
      );
    }

    // PDF + emails van en fire-and-forget: la submission ya está guardada
    // en Mongo (lo hicimos arriba, propagando errores), así que no hay
    // riesgo de perder datos. Puppeteer para generar el PDF puede tardar
    // 2-5s la primera vez — si esperamos aquí, el usuario ve la página
    // pegada "enviando…" varios segundos. Con fire-and-forget respondemos
    // al usuario en ~50ms y los emails llegan a los pocos segundos.
    //
    // Si el envío del email falla, queda en el log del backend. No hay
    // riesgo de perder la submission (ya persistida) — solo del email.
    void this.dispatchSubmitPublicEmails({
      form,
      submissionDoc,
      formData,
      userEmail,
      resolvedRecipients,
    }).catch((err) => {
      this.logger.error(
        `[submitPublic] Fallo async enviando emails del form ${id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
        err instanceof Error ? err.stack : undefined,
      );
    });

    return { success: true, message: 'Formulario enviado correctamente' };
  }

  /**
   * Genera el PDF y envía los emails del submitPublic. Se ejecuta en
   * background (fire-and-forget) para no bloquear la respuesta HTTP al
   * usuario final. Cualquier error queda en el log — la submission ya
   * está guardada en Mongo antes de llamar acá.
   */
  private async dispatchSubmitPublicEmails(input: {
    form: FormDocument;
    submissionDoc: { templateSnapshot: string | null; data: Record<string, unknown> };
    formData: Record<string, string>;
    userEmail: string;
    resolvedRecipients?: Record<string, string>;
  }): Promise<void> {
    const { form, submissionDoc, formData, userEmail, resolvedRecipients } = input;

    const pdfAttachment = await this.tryBuildSubmissionPdf(form, submissionDoc);

    // formData con keys normalizadas por label (mismo shape que espera la
    // interpolación de ${placeholders} en subject/emailBody). Sin esto los
    // asuntos como "Nueva asistencia de ${nombrecompleto}" salían con el
    // texto literal ${nombrecompleto} en vez del nombre.
    const widgets = (form.schema as { widgets?: Array<{ id: string; label?: string }> })
      .widgets ?? [];
    // Normalizadores: `toCamelKey` es la nueva key canónica que el admin
    // ve en los chips. `normalizeKey` es la vieja (lowercase sin espacios)
    // y la emitimos en paralelo para que plantillas creadas antes de este
    // cambio sigan resolviendo sus `${placeholders}`. Ambas espejan
    // src/utils/placeholders.ts del frontend.
    const normalizeKey = (label: string): string =>
      (label ?? '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/gi, '');
    const toCamelKey = (label: string): string => {
      const cleaned = (label ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
      const tokens = cleaned.split(/[^a-zA-Z0-9]+|(?<=[a-z])(?=[A-Z])/).filter(Boolean);
      if (tokens.length === 0) return '';
      const [first, ...rest] = tokens;
      return (
        first.toLowerCase() +
        rest.map((t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()).join('')
      );
    };
    const labeledFormData: Record<string, string> = { ...formData };
    const used = new Map<string, number>();
    const usedLegacy = new Map<string, number>();
    const assignKey = (base: string, counter: Map<string, number>) => {
      const current = counter.get(base) ?? 0;
      counter.set(base, current + 1);
      return current === 0 ? base : `${base}${current}`;
    };
    const putDual = (camel: string, legacy: string, value: string) => {
      labeledFormData[camel] = value;
      if (legacy && legacy !== camel) labeledFormData[legacy] = value;
    };
    type SearchCol = { key: string; label?: string };
    const widgetsExt = widgets as Array<{
      id: string;
      type?: string;
      label?: string;
      placeholder?: string;
      config?: { displayColumns?: SearchCol[]; sheetColumns?: string[] };
    }>;
    for (const w of widgetsExt) {
      if (!w.id) continue;
      const manual = (w.placeholder ?? '').trim();
      const camelBase = manual ? toCamelKey(manual) : toCamelKey(w.label ?? '');
      const legacyBase = manual ? normalizeKey(manual) : normalizeKey(w.label ?? '');
      if (!camelBase) continue;
      const camelKey = assignKey(camelBase, used);
      const legacyKey = legacyBase ? assignKey(legacyBase, usedLegacy) : '';
      const raw = submissionDoc.data?.[w.id];
      if (raw != null) putDual(camelKey, legacyKey, String(raw));

      // Widgets `search`: expone cada columna de la fila seleccionada
      // bajo `${key}.col`. Fuente de columnas: `sheetColumns` (importadas
      // auto al pegar la URL) > fallback `displayColumns` para widgets
      // creados antes de que ese campo existiera. Espeja la lógica de
      // src/utils/placeholders.ts.
      if (w.type === 'search') {
        const sheetCols = w.config?.sheetColumns ?? [];
        const displayCols = w.config?.displayColumns ?? [];
        const sources: string[] =
          sheetCols.length > 0
            ? sheetCols
            : displayCols.map((c) => c.key).filter(Boolean);
        if (sources.length > 0) {
          const rowRaw = submissionDoc.data?.[`${w.id}__row`];
          let row: Record<string, unknown> = {};
          if (typeof rowRaw === 'string' && rowRaw) {
            try {
              const parsed = JSON.parse(rowRaw);
              if (parsed && typeof parsed === 'object') {
                row = parsed as Record<string, unknown>;
              }
            } catch { /* fila mal formada: columnas vacías */ }
          }
          const seen = new Set<string>();
          for (const sourceKey of sources) {
            if (!sourceKey || seen.has(sourceKey)) continue;
            seen.add(sourceKey);
            const colCamel = toCamelKey(sourceKey);
            const colLegacy = normalizeKey(sourceKey);
            if (!colCamel) continue;
            const v = row[sourceKey];
            const vs = v == null ? '' : typeof v === 'string' ? v : String(v);
            putDual(
              `${camelKey}.${colCamel}`,
              legacyKey && colLegacy ? `${legacyKey}.${colLegacy}` : '',
              vs,
            );
          }
        }
      }
    }
    const interpolate = (text: string): string =>
      text.replace(/\$\{([^}]+)\}/g, (_, k) => labeledFormData[k] ?? '');

    // Email de notificación al completarse el formulario público.
    //
    // Fuente de verdad: el array `form.emailTemplates`. Si está vacío pero
    // existe un `form.emailTemplate` singular (form viejo, no migrado), lo
    // envolvemos en array con una entry para no cambiar el comportamiento
    // histórico. Cada entry habilitada dispara UN email independiente —
    // así Sara puede tener "Operaciones" con PDF A y "Aseguradora" con
    // PDF B saliendo del mismo submit.
    //
    // El toggle rápido `form.sendConfirmationEmail` del modal Share actúa
    // como atajo: fuerza el envío de la primera entry habilitada (o la
    // primera a secas si todas vienen con enabled=false).
    type Tpl = {
      id?: string;
      enabled?: boolean;
      subject?: string;
      emailBody?: string;
      toRecipients?: EmailRecipient[];
      ccRecipients?: EmailRecipient[];
      bccRecipients?: EmailRecipient[];
      senderName?: string;
      // Metadata de PDF por template. Si cualquiera de estos está presente
      // generamos el PDF específico de esta notificación.
      pdfBase64?: string;
      pdfMappings?: Array<{ placeholder: string; x: number; y: number; page: number; fontSize?: number }>;
      excelBase64?: string;
      excelMappings?: Array<{ coord: string; placeholder: string }>;
      excelLogoBase64?: string;
      excelFilename?: string;
      attachPDF?: boolean;
      pdfTemplate?: string;
      pdfFilename?: string;
    };

    const arrayField = (form as unknown as { emailTemplates?: Tpl[] }).emailTemplates;
    const singular = (form.emailTemplate ?? null) as Tpl | null;
    const rawTemplates: Tpl[] =
      arrayField && arrayField.length > 0 ? arrayField : singular ? [singular] : [];

    // Elegimos qué configs disparar. Reglas:
    //  - Si al menos una tiene `enabled:true`, se disparan sólo esas.
    //  - Si ninguna la tiene pero `sendConfirmationEmail` está activo
    //    (shortcut del modal Share), disparamos la primera config a secas
    //    para preservar la UX histórica.
    const enabledOnes = rawTemplates.filter((t) => t.enabled === true);
    const shortcutFirstOnly =
      enabledOnes.length === 0 &&
      form.sendConfirmationEmail === true &&
      rawTemplates.length > 0
        ? [rawTemplates[0]]
        : [];
    const configsToDispatch =
      enabledOnes.length > 0 ? enabledOnes : shortcutFirstOnly;

    // Cachear el PDF del submitPublic para la config "legacy" (la que
    // usa el pdfTemplate del form). Lo pre-construimos una vez y se
    // reutiliza para evitar renderizar Puppeteer N veces si no cambia.
    for (const t of configsToDispatch) {
      const hasRecipients = (t.toRecipients?.length ?? 0) > 0;
      if (!hasRecipients) {
        this.logger.warn(
          `[submitPublic] Form ${form._id} config "${t.id ?? 'legacy'}" sin toRecipients — email omitido.`,
        );
        continue;
      }

      // Attachment por template: si la config tiene pdfBase64/excelBase64/
      // pdfTemplate propios, armamos UN PDF específico para ella. Si no,
      // caemos al PDF genérico del form (pdfAttachment ya construido arriba
      // sobre form.emailTemplate singular) para no romper el flujo legacy.
      const hasOwnPdfSource =
        !!(t.excelBase64 && (t.excelMappings?.length ?? 0) > 0) ||
        !!(t.pdfBase64 && (t.pdfMappings?.length ?? 0) > 0) ||
        !!(t.attachPDF && t.pdfTemplate && t.pdfTemplate.trim().length > 0);

      let attachmentForThis: import('../email/email.types').EmailAttachment | null = pdfAttachment;
      if (hasOwnPdfSource) {
        try {
          attachmentForThis = await this.tryBuildSubmissionPdfForTemplate(
            form,
            submissionDoc,
            t,
          );
        } catch (err) {
          this.logger.error(
            `[submitPublic] Error armando PDF de la config "${t.id ?? 'legacy'}": ${err instanceof Error ? err.message : err}`,
          );
          attachmentForThis = null;
        }
      }

      try {
        await this.emailService.sendEmail({
          subject: interpolate(t.subject || `Nuevo envío: ${form.name}`),
          emailBody: interpolate(
            t.emailBody ||
              `<p>Nuevo envío del formulario <strong>${form.name}</strong></p>`,
          ),
          toRecipients: (t.toRecipients ?? []) as EmailRecipient[],
          ccRecipients: (t.ccRecipients ?? []) as EmailRecipient[],
          bccRecipients: (t.bccRecipients ?? []) as EmailRecipient[],
          senderName: t.senderName,
          formData: labeledFormData,
          attachments: attachmentForThis ? [attachmentForThis] : [],
          resolvedRecipients,
        });
      } catch (err) {
        this.logger.error(
          `[submitPublic] Error enviando email de la config "${t.id ?? 'legacy'}": ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    // `userEmail` queda sin uso en este flow — se conserva el parámetro por
    // compat de tipos pero no se lee. Si el día de mañana Sara quiere volver
    // a habilitar un email "al usuario final" separado, este es el lugar.
    void userEmail;
  }

  /**
   * Construye el PDF de una submission recién guardada para adjuntarlo a
   * los emails del submitPublic. Elige el mejor motor según el shape del
   * emailTemplate del form:
   *
   *   1. Excel + mappings → LibreOffice (fillXlsx + convertBufferToPdf).
   *      Pixel-perfect del Excel original: mismo motor que ya usa el
   *      Preview del mapper y la descarga desde el panel admin.
   *   2. PDF + mappings → pdf-lib (fillPdf). Overlay de texto en las
   *      coordenadas mapeadas.
   *   3. HTML template (fallback) → Puppeteer (htmlToPdfBuffer). Renderiza
   *      un HTML minimalista con los placeholders sustituidos.
   *
   * Sin el path (1), los forms basados en Excel salían con las celdas
   * "aplastadas" en líneas horizontales porque Puppeteer renderiza el
   * HTML de generateExcelTemplateHtml literal (no reproduce el layout de
   * bordes/celdas del Excel).
   *
   * Devuelve null si no hay nada que renderizar o si el render falla —
   * los emails se envían igual sin adjunto para no bloquear el flujo.
   */
  /**
   * Variante de tryBuildSubmissionPdf parametrizada por template. El flujo
   * multi-notificación la usa para generar UN PDF específico por cada
   * configuración de email del form.
   *
   * - Las fuentes de PDF (excelBase64, pdfBase64, pdfTemplate) se leen del
   *   `template` argumento, no de form.emailTemplate singular.
   * - Para Path 3 (HTML + Puppeteer) se usa `template.pdfTemplate` como
   *   snapshot in-memory; si está vacío cae al `submissionDoc.templateSnapshot`
   *   histórico (el del form.emailTemplate singular) para preservar compat.
   */
  private async tryBuildSubmissionPdfForTemplate(
    form: FormDocument,
    submissionDoc: { templateSnapshot: string | null; data: Record<string, unknown> },
    tpl: Record<string, unknown>,
  ): Promise<import('../email/email.types').EmailAttachment | null> {
    const synthetic = {
      templateSnapshot:
        (tpl.pdfTemplate as string | undefined)?.trim() ||
        submissionDoc.templateSnapshot,
      data: submissionDoc.data,
    };
    return this.tryBuildSubmissionPdf(form, synthetic, tpl);
  }

  private async tryBuildSubmissionPdf(
    form: FormDocument,
    submissionDoc: { templateSnapshot: string | null; data: Record<string, unknown> },
    overrideTemplate?: Record<string, unknown>,
  ): Promise<import('../email/email.types').EmailAttachment | null> {
    const template = (overrideTemplate ?? form.emailTemplate ?? {}) as {
      excelBase64?: string;
      excelMappings?: Array<{ coord: string; placeholder: string }>;
      excelLogoBase64?: string;
      pdfBase64?: string;
      pdfMappings?: Array<{
        placeholder: string;
        x: number;
        y: number;
        page: number;
        fontSize?: number;
      }>;
      pdfFilename?: string;
    };
    // Los "values" mapean placeholder → valor. IMPORTANTE: los mappings
    // se guardan con placeholders derivados del LABEL del widget
    // (normalizeKey del frontend: lowercase + sin espacios + solo a-z0-9),
    // NO con el widget.id UUID. Enviar solo widget.id como clave dejaba
    // el PDF vacío porque ninguna celda mapeada encontraba su valor.
    //
    // Espejamos exactamente la función normalizeKey de src/utils/placeholders.ts.
    // Si esa función cambia, hay que sincronizar aquí también.
    type SearchCol = { key: string; label?: string };
    const widgets = (form.schema as {
      widgets?: Array<{
        id: string;
        type?: string;
        label?: string;
        placeholder?: string;
        config?: { displayColumns?: SearchCol[]; sheetColumns?: string[] };
      }>;
    }).widgets ?? [];
    // Dos normalizadores en paralelo (espejan src/utils/placeholders.ts):
    //   - toCamelKey: la nueva canónica que ve el admin en los chips.
    //   - normalizeKey: la vieja (lowercase), que seguimos emitiendo para
    //     que plantillas creadas antes del cambio sigan resolviendo.
    const normalizeKey = (label: string): string =>
      (label ?? '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/gi, '');
    const toCamelKey = (label: string): string => {
      const cleaned = (label ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
      const tokens = cleaned.split(/[^a-zA-Z0-9]+|(?<=[a-z])(?=[A-Z])/).filter(Boolean);
      if (tokens.length === 0) return '';
      const [first, ...rest] = tokens;
      return (
        first.toLowerCase() +
        rest.map((t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()).join('')
      );
    };
    // Mapa widgetId → { camelKey, legacyKey }: usa `widget.placeholder`
    // manual si existe, sino el label normalizado con sufijo numérico
    // determinístico para desambiguar labels duplicados.
    const keyById = new Map<string, { camel: string; legacy: string }>();
    // Mapa widgetId → columnas fuente (si es search): sheetColumns > displayColumns.
    const searchColsById = new Map<string, string[]>();
    {
      const used = new Map<string, number>();
      const usedLegacy = new Map<string, number>();
      const assign = (base: string, counter: Map<string, number>) => {
        const current = counter.get(base) ?? 0;
        counter.set(base, current + 1);
        return current === 0 ? base : `${base}${current}`;
      };
      for (const w of widgets) {
        if (!w.id) continue;
        const manual = (w.placeholder ?? '').trim();
        const camelBase = manual ? toCamelKey(manual) : toCamelKey(w.label ?? '');
        const legacyBase = manual ? normalizeKey(manual) : normalizeKey(w.label ?? '');
        if (!camelBase) continue;
        keyById.set(w.id, {
          camel: assign(camelBase, used),
          legacy: legacyBase ? assign(legacyBase, usedLegacy) : '',
        });
        if (w.type === 'search') {
          const sheetCols = w.config?.sheetColumns ?? [];
          const displayCols = w.config?.displayColumns ?? [];
          const sources = sheetCols.length > 0
            ? sheetCols
            : displayCols.map((c) => c.key).filter(Boolean);
          if (sources.length > 0) searchColsById.set(w.id, sources);
        }
      }
    }

    const values: Record<string, string> = {};
    const labeledValues: Record<string, string> = {};
    const putDual = (camelKey: string, legacyKey: string, value: string) => {
      values[camelKey] = value;
      values[`\${${camelKey}}`] = value;
      labeledValues[camelKey] = value;
      if (legacyKey && legacyKey !== camelKey) {
        values[legacyKey] = value;
        values[`\${${legacyKey}}`] = value;
        labeledValues[legacyKey] = value;
      }
    };
    for (const [widgetId, rawVal] of Object.entries(submissionDoc.data ?? {})) {
      const str = rawVal == null ? '' : String(rawVal);
      // Compat con quien ya usa widget.id directamente como key:
      values[widgetId] = str;
      values[`\${${widgetId}}`] = str;
      const keys = keyById.get(widgetId);
      if (keys) putDual(keys.camel, keys.legacy, str);
    }

    // Expone cada columna de un widget `search` como `${widgetKey.col}`
    // (camelCase + legacy lowercase). La fila completa viaja en
    // data[`${widgetId}__row`] serializada como JSON. Espeja la lógica
    // de src/utils/placeholders.ts.
    for (const [widgetId, sources] of searchColsById) {
      const keys = keyById.get(widgetId);
      if (!keys) continue;
      const rowRaw = submissionDoc.data?.[`${widgetId}__row`];
      let row: Record<string, unknown> = {};
      if (typeof rowRaw === 'string' && rowRaw) {
        try {
          const parsed = JSON.parse(rowRaw);
          if (parsed && typeof parsed === 'object') {
            row = parsed as Record<string, unknown>;
          }
        } catch { /* fila mal formada: columnas vacías */ }
      }
      const seen = new Set<string>();
      for (const sourceKey of sources) {
        if (!sourceKey || seen.has(sourceKey)) continue;
        seen.add(sourceKey);
        const colCamel = toCamelKey(sourceKey);
        const colLegacy = normalizeKey(sourceKey);
        if (!colCamel) continue;
        const v = row[sourceKey];
        const vs = v == null ? '' : typeof v === 'string' ? v : String(v);
        putDual(
          `${keys.camel}.${colCamel}`,
          keys.legacy && colLegacy ? `${keys.legacy}.${colLegacy}` : '',
          vs,
        );
      }
    }

    // Nombre del PDF adjunto: usa el pdfFilename configurado (con placeholders
    // interpolados) para que llegue con el mismo formato que Sara configuró en
    // Config → Email. Multi-templates: cada config puede traer su propio
    // pdfFilename; si no, caemos al del template efectivo.
    const configuredName = (template.pdfFilename ?? '').trim();
    const renderedName = configuredName
      ? configuredName.replace(/\$\{([^}]+)\}/g, (_, k) => labeledValues[k] ?? '')
      : `${form.name}.pdf`;
    const safeName = renderedName
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200)
      .replace(/\.pdf?$/i, '') + '.pdf';

    // Diagnóstico: qué opciones tiene este form para generar PDF
    this.logger.log(
      `[tryBuildSubmissionPdf] form=${form._id} name="${form.name}" ` +
        `excelBase64=${!!template.excelBase64} excelMappings=${
          template.excelMappings?.length ?? 0
        } pdfBase64=${!!template.pdfBase64} pdfMappings=${
          template.pdfMappings?.length ?? 0
        } templateSnapshot=${!!submissionDoc.templateSnapshot}`,
    );

    // Path 1: Excel + mappings → LibreOffice
    if (
      template.excelBase64 &&
      Array.isArray(template.excelMappings) &&
      template.excelMappings.length > 0
    ) {
      this.logger.log(
        `[tryBuildSubmissionPdf] ⇒ PATH 1 (Excel + LibreOffice) — ${template.excelMappings.length} mappings`,
      );
      try {
        const { ExcelPreviewService } = await import('./excel-preview.service');
        const { FilesService } = await import('../files/files.service');
        const excel = this.moduleRef.get(ExcelPreviewService, { strict: false });
        const filesService = this.moduleRef.get(FilesService, { strict: false });
        const buf = Buffer.from(
          template.excelBase64.includes(',')
            ? template.excelBase64.split(',')[1]
            : template.excelBase64,
          'base64',
        );

        // Resolver valores gridfs:xxx (firmas/fotos) a buffers de imagen,
        // agrupados por coord de la celda mapeada. fillXlsx los anclará
        // como imágenes en la celda en vez de escribir el gridfs id como
        // texto (que era el bug del "6b59a22108" en la línea de firma).
        const imagesByCoord = new Map<
          string,
          { buffer: Buffer; extension: 'png' | 'jpeg' | 'gif' }
        >();
        for (const m of template.excelMappings) {
          const key = m.placeholder.replace(/^\$\{/, '').replace(/\}$/, '');
          const val = values[key];
          if (typeof val !== 'string') continue;
          if (!val.startsWith('gridfs:')) continue;
          const fileId = val.slice('gridfs:'.length);
          try {
            const { buffer: imgBuf, contentType } = await filesService.download(fileId);
            const ct = (contentType ?? '').toLowerCase();
            const extension: 'png' | 'jpeg' | 'gif' = ct.includes('gif')
              ? 'gif'
              : ct.includes('jpeg') || ct.includes('jpg')
                ? 'jpeg'
                : 'png';
            imagesByCoord.set(m.coord, { buffer: imgBuf, extension });
          } catch (err) {
            this.logger.warn(
              `[submitPublic] No se pudo descargar gridfs ${fileId} para ${m.coord}: ${
                err instanceof Error ? err.message : err
              }`,
            );
          }
        }

        const filled = await excel.fillXlsx(
          buf,
          template.excelMappings,
          values,
          template.excelLogoBase64,
          imagesByCoord,
        );
        const pdf = await excel.convertBufferToPdf(filled);
        this.logger.log(
          `[tryBuildSubmissionPdf] ✅ PATH 1 completado — PDF ${Math.round(pdf.length / 1024)}KB, imagenes anclas=${imagesByCoord.size}`,
        );
        return {
          name: safeName,
          contentType: 'application/pdf',
          contentBytes: Buffer.from(pdf).toString('base64'),
        };
      } catch (err) {
        this.logger.warn(
          `[submitPublic] Excel→PDF (LibreOffice) falló, cayendo a HTML: ${
            err instanceof Error ? err.message : err
          }`,
        );
      }
    }

    // Path 2: PDF + mappings → pdf-lib
    if (
      template.pdfBase64 &&
      Array.isArray(template.pdfMappings) &&
      template.pdfMappings.length > 0
    ) {
      try {
        const { PdfFillService } = await import('./pdf-fill.service');
        const filler = this.moduleRef.get(PdfFillService, { strict: false });
        const buf = Buffer.from(
          template.pdfBase64.includes(',')
            ? template.pdfBase64.split(',')[1]
            : template.pdfBase64,
          'base64',
        );
        const filled = await filler.fillPdf(buf, template.pdfMappings, values);
        return {
          name: safeName,
          contentType: 'application/pdf',
          contentBytes: Buffer.from(filled).toString('base64'),
        };
      } catch (err) {
        this.logger.warn(
          `[submitPublic] PDF fill (pdf-lib) falló, cayendo a HTML: ${
            err instanceof Error ? err.message : err
          }`,
        );
      }
    }

    // Path 3: HTML template → Puppeteer (fallback)
    if (!submissionDoc.templateSnapshot) {
      this.logger.warn(
        `[tryBuildSubmissionPdf] ⇒ NINGÚN PATH aplicable — no hay excelBase64+mappings, no hay pdfBase64+mappings, no hay templateSnapshot. PDF NO se generará.`,
      );
      return null;
    }
    this.logger.warn(
      `[tryBuildSubmissionPdf] ⇒ PATH 3 (HTML + Puppeteer fallback). Si esperabas Path 1 (Excel), revisá que el emailTemplate tenga excelBase64+excelMappings.`,
    );
    try {
      const { PdfRendererService } = await import('../submissions/pdf-renderer.service');
      const { FilesService } = await import('../files/files.service');
      const { interpolatePdfTemplate } = await import('../submissions/pdf-interpolator');
      const pdfRenderer = this.moduleRef.get(PdfRendererService, { strict: false });
      const filesService = this.moduleRef.get(FilesService, { strict: false });
      const html = await interpolatePdfTemplate({
        template: submissionDoc.templateSnapshot,
        data: submissionDoc.data,
        widgets:
          (form.schema as { widgets?: Array<{ id: string; type: string; label?: string }> })
            .widgets ?? [],
        filesService,
      });
      const buffer = await pdfRenderer.htmlToPdfBuffer(html);
      return {
        name: safeName,
        contentType: 'application/pdf',
        contentBytes: buffer.toString('base64'),
      };
    } catch (err) {
      this.logger.warn(
        `[submitPublic] No se pudo generar PDF adjunto: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }

  async togglePublic(
    id: string,
    isPublic: boolean,
    sendConfirmationEmail?: boolean,
    requiresEmailVerification?: boolean,
  ): Promise<FormDocument> {
    const form = await this.findOne(id);
    form.isPublic = isPublic;
    if (sendConfirmationEmail !== undefined) {
      form.sendConfirmationEmail = sendConfirmationEmail;
    }
    if (requiresEmailVerification !== undefined) {
      form.requiresEmailVerification = requiresEmailVerification;
    }
    return form.save();
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateFormDto): Promise<FormDocument> {
    const form = await this.findOne(id);
    if (dto.name !== undefined) form.name = dto.name;
    if (dto.emailTemplate !== undefined)
      form.emailTemplate = dto.emailTemplate as Record<string, unknown>;
    if (dto.emailTemplates !== undefined) {
      // Guarda el array nuevo. Si viene vacío lo persistimos igual (es la
      // forma del admin de decir "sin notificaciones"); el dispatch luego
      // ve 0 configs habilitadas y no manda nada. `markModified` es
      // defensivo: con tipos Mixed (`[Object]`) Mongoose no siempre
      // detecta el reassign si la referencia nueva tiene la misma shape
      // que la vieja (típicamente seguro, pero no documentado como
      // garantía), y el costo del markModified es cero.
      form.emailTemplates = dto.emailTemplates as Record<string, unknown>[];
      form.markModified('emailTemplates');
    }
    if (dto.schema !== undefined) {
      (form as any).schema = dto.schema;
      form.version += 1;
    }
    return form.save();
  }

  async remove(id: string): Promise<void> {
    const form = await this.findOne(id);
    form.isActive = false;
    await form.save();
  }

  async assignUser(formId: string, userId: number): Promise<UserFormAssignmentDocument> {
    // excluded:false filtra las filas de exclusión creadas por el árbol de
    // asignaciones (PUT /assignments/tree) — sin este filtro, una fila
    // {formId, userId, excluded:true} se ve como asignación positiva y
    // dispara un ConflictException falso al intentar asignar de verdad.
    const exists = await this.assignmentModel.findOne({ formId, userId, excluded: false });
    if (exists)
      throw new ConflictException('El usuario ya está asignado a este formulario');
    const assignment = new this.assignmentModel({ formId, userId });
    return assignment.save();
  }

  async unassignUser(formId: string, userId: number): Promise<void> {
    // Igual que en assignUser: no borrar la fila de exclusión, solo la
    // asignación positiva legacy. Antes de borrarla la archivamos en
    // assignments_history para conservar el registro histórico de quién
    // estuvo asignado.
    const doc = await this.assignmentModel
      .findOne({ formId, userId, excluded: false })
      .lean();
    if (!doc) return;
    await this.assignmentHistory.archive({
      type: 'user_form_direct_assignment',
      originalDocument: doc as unknown as Record<string, unknown>,
      metadata: { reason: 'manual_unassign', formId, userId },
    });
    await this.assignmentModel.deleteOne({ formId, userId, excluded: false });
  }

  async getAssignedUsers(formId: string): Promise<UserFormAssignmentDocument[]> {
    return this.assignmentModel.find({ formId, excluded: false });
  }
}