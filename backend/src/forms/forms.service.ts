import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
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

    // Enviar email de notificación usando el emailTemplate del formulario
    if (form.emailTemplate) {
      try {
        const template = form.emailTemplate as any;
        if (template.enabled && (template.toRecipients?.length ?? 0) > 0) {
          await this.emailService.sendEmail({
            subject: template.subject || `Nuevo envío: ${form.name}`,
            emailBody: template.emailBody || `<p>Nuevo envío del formulario <strong>${form.name}</strong></p>`,
            toRecipients: (template.toRecipients ?? []) as EmailRecipient[],
            ccRecipients: (template.ccRecipients ?? []) as EmailRecipient[],
            bccRecipients: (template.bccRecipients ?? []) as EmailRecipient[],
            senderName: template.senderName,
            formData,
          });
        }
      } catch (err) {
        console.error('[FormsService] Error enviando email de notificación:', err);
      }
    }

    // Email de confirmación al usuario
    if (form.sendConfirmationEmail && userEmail) {
      try {
        await this.emailService.sendEmail({
          subject: `✅ Recibimos tu formulario: ${form.name}`,
          emailBody: `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
              <h2 style="color:#00c2a8;">¡Formulario recibido!</h2>
              <p>Hemos recibido tu respuesta al formulario <strong>${form.name}</strong>.</p>
              <p style="color:#6b7280;font-size:13px;">Si tienes preguntas puedes responder a este correo.</p>
            </div>
          `,
          toRecipients: [{ type: 'static', email: userEmail }],
          senderName: 'SoulForms',
        });
      } catch (err) {
        console.error('[FormsService] Error enviando confirmación:', err);
      }
    }

    return { success: true, message: 'Formulario enviado correctamente' };
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
    const exists = await this.assignmentModel.findOne({ formId, userId });
    if (exists)
      throw new ConflictException('El usuario ya está asignado a este formulario');
    const assignment = new this.assignmentModel({ formId, userId });
    return assignment.save();
  }

  async unassignUser(formId: string, userId: number): Promise<void> {
    await this.assignmentModel.deleteOne({ formId, userId });
  }

  async getAssignedUsers(formId: string): Promise<UserFormAssignmentDocument[]> {
    return this.assignmentModel.find({ formId });
  }
}