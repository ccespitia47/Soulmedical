import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { GraphTokenService } from './graph-token.service';
import type {
  EmailAttachment,
  EmailRecipient,
  EmailUserRef,
  SendEmailPayload,
  SendEmailResult,
  SendPasswordResetPayload,
  SendPublicFormOtpPayload,
  SendTwoFactorResetNoticePayload,
  SendReportEmailPayload,
  SendReportLinkPayload,
} from './email.types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly tokens: GraphTokenService) {}

  async sendEmail(payload: SendEmailPayload): Promise<SendEmailResult> {
    if (!payload.subject?.trim()) {
      throw new BadRequestException('El asunto es obligatorio');
    }
    if (!payload.emailBody?.trim()) {
      throw new BadRequestException('El cuerpo del email es obligatorio');
    }

    const users = payload.users ?? [];
    const currentUserEmail = payload.currentUserEmail ?? null;
    const formData = payload.formData ?? {};

    const toList = this.resolveRecipients(
      payload.toRecipients,
      users,
      currentUserEmail,
      formData,
    );
    const ccList = this.resolveRecipients(
      payload.ccRecipients ?? [],
      users,
      currentUserEmail,
      formData,
    );
    const bccList = this.resolveRecipients(
      payload.bccRecipients ?? [],
      users,
      currentUserEmail,
      formData,
    );

    if (toList.length === 0) {
      throw new BadRequestException('No hay destinatarios válidos en el campo Para (To)');
    }

    // Los attachments vienen ya listos desde el cliente (PDFs generados con
    // html2canvas + jsPDF). El backend solo reenvía.
    const attachments: EmailAttachment[] = payload.attachments ?? [];

    this.logger.log(
      `[sendEmail] to=${toList.length} cc=${ccList.length} bcc=${bccList.length} attachments=${attachments.length}`,
    );

    await this.sendViaGraph({
      subject: payload.subject,
      htmlBody: payload.emailBody,
      toList,
      ccList,
      bccList,
      senderName: payload.senderName,
      replyTo: payload.replyTo,
      attachments,
    });

    return {
      success: true,
      message: `Email enviado a ${toList.length} destinatario(s)`,
      recipients: toList.length,
    };
  }

  async sendPasswordReset(payload: SendPasswordResetPayload): Promise<SendEmailResult> {
    if (!payload.to?.trim() || !EMAIL_REGEX.test(payload.to.trim())) {
      throw new BadRequestException('El destinatario no es un email válido');
    }
    if (!payload.resetUrl?.trim()) {
      throw new BadRequestException('Falta resetUrl');
    }

    const safeName = (payload.name ?? '').trim() || 'usuario';
    const html = this.buildResetPasswordHtml(safeName, payload.resetUrl);

    await this.sendViaGraph({
      subject: 'Restablece tu contraseña de SoulForms',
      htmlBody: html,
      toList: [{ emailAddress: { address: payload.to.trim().toLowerCase() } }],
      ccList: [],
      bccList: [],
      attachments: [],
    });

    this.logger.log(`Email de reset enviado a ${payload.to}`);
    return { success: true, message: 'Email de reset enviado', recipients: 1 };
  }

  /**
   * Envía el código OTP de 6 dígitos para acceso a un formulario público
   * con verificación por correo. El código es generado por FormsService;
   * aquí solo se entrega el mensaje al usuario.
   */
  async sendPublicFormOtp(
    payload: SendPublicFormOtpPayload,
  ): Promise<SendEmailResult> {
    if (!payload.to?.trim() || !EMAIL_REGEX.test(payload.to.trim())) {
      throw new BadRequestException('El destinatario no es un email válido');
    }
    const html = this.buildPublicFormOtpHtml(
      payload.formName,
      payload.code,
      payload.ttlMinutes,
    );

    await this.sendViaGraph({
      subject: `Tu código de acceso: ${payload.code}`,
      htmlBody: html,
      toList: [{ emailAddress: { address: payload.to.trim().toLowerCase() } }],
      ccList: [],
      bccList: [],
      attachments: [],
    });

    this.logger.log(`OTP enviado a ${payload.to} para formulario "${payload.formName}"`);
    return { success: true, message: 'Código enviado', recipients: 1 };
  }

  /**
   * Notifica al usuario que un administrador reinició su doble factor.
   * Es un aviso de seguridad: si el usuario no esperaba esto, sabe que debe
   * cambiar su contraseña / contactar soporte.
   */
  async sendTwoFactorResetNotice(
    payload: SendTwoFactorResetNoticePayload,
  ): Promise<SendEmailResult> {
    if (!payload.to?.trim() || !EMAIL_REGEX.test(payload.to.trim())) {
      throw new BadRequestException('El destinatario no es un email válido');
    }
    const html = this.buildTwoFactorResetNoticeHtml(
      payload.userName,
      payload.actorName,
    );

    await this.sendViaGraph({
      subject: 'Tu doble factor fue reiniciado',
      htmlBody: html,
      toList: [{ emailAddress: { address: payload.to.trim().toLowerCase() } }],
      ccList: [],
      bccList: [],
      attachments: [],
    });

    this.logger.log(
      `Aviso de reset 2FA enviado a ${payload.to} (actor: ${payload.actorName ?? 'admin'})`,
    );
    return { success: true, message: 'Aviso de reset enviado', recipients: 1 };
  }

  /**
   * Envía el reporte de envíos de un formulario como adjunto ZIP cifrado.
   * El ZIP viene ya empaquetado desde ReportsService; aquí solo lo reenviamos.
   */
  async sendReportEmail(
    payload: SendReportEmailPayload,
  ): Promise<SendEmailResult> {
    if (!payload.to?.trim() || !EMAIL_REGEX.test(payload.to.trim())) {
      throw new BadRequestException('El destinatario no es un email válido');
    }
    const html = this.buildReportEmailHtml(payload.userName, payload.formName);

    await this.sendViaGraph({
      subject: `Reporte del formulario: ${payload.formName}`,
      htmlBody: html,
      toList: [{ emailAddress: { address: payload.to.trim().toLowerCase() } }],
      ccList: [],
      bccList: [],
      attachments: [payload.attachment],
    });

    this.logger.log(
      `Reporte enviado a ${payload.to} formulario="${payload.formName}"`,
    );
    return { success: true, message: 'Reporte enviado', recipients: 1 };
  }

  /**
   * Envía el correo con el link único de descarga del reporte. NO adjunta
   * el archivo — el .xlsx cifrado vive en `report_downloads` y se entrega
   * cuando el usuario clic el link, autentica con 2FA y consume el token.
   */
  async sendReportLink(
    payload: SendReportLinkPayload,
  ): Promise<SendEmailResult> {
    if (!payload.to?.trim() || !EMAIL_REGEX.test(payload.to.trim())) {
      throw new BadRequestException('El destinatario no es un email válido');
    }
    const html = this.buildReportLinkHtml(
      payload.userName,
      payload.formName,
      payload.url,
      payload.expiresInMinutes,
    );

    await this.sendViaGraph({
      subject: `Descarga de reporte: ${payload.formName}`,
      htmlBody: html,
      toList: [{ emailAddress: { address: payload.to.trim().toLowerCase() } }],
      ccList: [],
      bccList: [],
      attachments: [],
    });

    this.logger.log(
      `Link de reporte enviado a ${payload.to} formulario="${payload.formName}"`,
    );
    return { success: true, message: 'Link de reporte enviado', recipients: 1 };
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  private resolveRecipients(
    recipients: EmailRecipient[],
    users: EmailUserRef[],
    currentUserEmail: string | null,
    formData: Record<string, string>,
  ): { emailAddress: { address: string } }[] {
    const emails = new Set<string>();

    for (const r of recipients) {
      if (r.type === 'static' && r.email) {
        emails.add(r.email.trim().toLowerCase());
      } else if (r.type === 'group' && r.group) {
        if (r.group === 'current_user') {
          const formEmail = this.findEmailInFormData(formData);
          if (formEmail) emails.add(formEmail.trim().toLowerCase());
          else if (currentUserEmail) emails.add(currentUserEmail.trim().toLowerCase());
        } else if (r.group === 'me') {
          if (currentUserEmail) emails.add(currentUserEmail.trim().toLowerCase());
        } else {
          for (const u of users) {
            if (u.role === r.group && u.active && u.email) {
              emails.add(u.email.trim().toLowerCase());
            }
          }
        }
      }
    }

    return [...emails].map((email) => ({ emailAddress: { address: email } }));
  }

  private findEmailInFormData(formData: Record<string, string>): string | null {
    for (const value of Object.values(formData)) {
      if (typeof value === 'string' && EMAIL_REGEX.test(value.trim())) {
        return value.trim();
      }
    }
    return null;
  }

  private async sendViaGraph(args: {
    subject: string;
    htmlBody: string;
    toList: { emailAddress: { address: string } }[];
    ccList: { emailAddress: { address: string } }[];
    bccList: { emailAddress: { address: string } }[];
    senderName?: string;
    replyTo?: string;
    attachments: EmailAttachment[];
  }): Promise<void> {
    const senderEmail = process.env.SENDER_EMAIL;
    if (!senderEmail) {
      throw new InternalServerErrorException('Falta SENDER_EMAIL en el entorno');
    }

    const token = await this.tokens.getAccessToken();

    type GraphMessage = {
      subject: string;
      body: { contentType: 'HTML'; content: string };
      toRecipients: { emailAddress: { address: string } }[];
      ccRecipients: { emailAddress: { address: string } }[];
      bccRecipients: { emailAddress: { address: string } }[];
      from?: { emailAddress: { name?: string; address: string } };
      replyTo?: { emailAddress: { address: string } }[];
      attachments?: {
        '@odata.type': string;
        name: string;
        contentType: string;
        contentBytes: string;
      }[];
    };

    const message: GraphMessage = {
      subject: args.subject,
      body: { contentType: 'HTML', content: args.htmlBody },
      toRecipients: args.toList,
      ccRecipients: args.ccList,
      bccRecipients: args.bccList,
    };

    if (args.senderName?.trim()) {
      message.from = {
        emailAddress: { name: args.senderName.trim(), address: senderEmail },
      };
    }
    if (args.replyTo?.trim()) {
      message.replyTo = [{ emailAddress: { address: args.replyTo.trim() } }];
    }
    if (args.attachments.length > 0) {
      message.attachments = args.attachments.map((att) => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: att.name,
        contentType: att.contentType,
        contentBytes: att.contentBytes,
      }));
    }

    const graphUrl = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`;
    const res = await fetch(graphUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, saveToSentItems: true }),
    });

    if (res.status !== 202) {
      const errBody = await res.text();
      this.logger.error(`[graph] ${res.status}: ${errBody}`);
      throw new InternalServerErrorException(`Error al enviar email: ${res.status}`);
    }
  }

  private buildPublicFormOtpHtml(
    formName: string,
    code: string,
    ttlMinutes: number,
  ): string {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background:#f0f4f8; padding:20px;">
  <div style="max-width:520px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#00c2a8,#0891b2); padding:22px; text-align:center; color:#fff;">
      <h1 style="margin:0; font-size:20px;">Código de acceso</h1>
    </div>
    <div style="padding:28px; color:#374151; line-height:1.6; font-size:14px;">
      <p>Para acceder al formulario <strong>${formName}</strong> usa el siguiente código:</p>
      <div style="text-align:center; margin:24px 0;">
        <div style="display:inline-block; padding:14px 28px; background:#f1f5f9; border:2px solid #00c2a8; border-radius:10px; font-family:'Courier New',monospace; font-size:32px; font-weight:700; letter-spacing:8px; color:#0f766e;">${code}</div>
      </div>
      <p style="font-size:13px; color:#6b7280;">El código expira en <strong>${ttlMinutes} minuto${ttlMinutes === 1 ? '' : 's'}</strong>. Tienes hasta 3 intentos.</p>
      <p style="font-size:12px; color:#9ca3af; margin-top:24px;">Si no solicitaste este código, ignora este correo.</p>
    </div>
  </div>
</body>
</html>`;
  }

  private buildReportEmailHtml(userName: string, formName: string): string {
    const safeUser = (userName ?? '').trim() || 'usuario';
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background:#f0f4f8; padding:20px;">
  <div style="max-width:560px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#00c2a8,#0891b2); padding:22px; text-align:center; color:#fff;">
      <h1 style="margin:0; font-size:20px;">📊 Tu reporte está listo</h1>
    </div>
    <div style="padding:28px; color:#374151; line-height:1.6; font-size:14px;">
      <p>Hola ${safeUser},</p>
      <p>Adjunto encontrarás el reporte de envíos del formulario <strong>${formName}</strong> que solicitaste.</p>
      <div style="background:#eff6ff; border-left:4px solid #0891b2; padding:12px 14px; margin:18px 0; border-radius:0 6px 6px 0;">
        <strong>🔐 Archivo protegido con contraseña</strong><br>
        El adjunto es un archivo <strong>.zip</strong>. Al descomprimirlo (doble click en Windows/Mac) el sistema te pedirá una contraseña: ingresa tu <strong>número de documento</strong>, el mismo que tienes registrado en tu perfil.
      </div>
      <p style="font-size:12px; color:#6b7280;">Si la contraseña no coincide, el archivo no se podrá extraer. Si tu documento cambió, pide a un administrador que lo actualice y solicita el reporte de nuevo.</p>
      <p style="font-size:12px; color:#9ca3af; margin-top:24px;">Este es un envío automático. No respondas a este correo.</p>
    </div>
  </div>
</body>
</html>`;
  }

  private buildTwoFactorResetNoticeHtml(
    userName: string,
    actorName?: string,
  ): string {
    const safeUser = (userName ?? '').trim() || 'usuario';
    const actor = actorName?.trim()
      ? `por <strong>${actorName.trim()}</strong>`
      : 'por un administrador';
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background:#f0f4f8; padding:20px;">
  <div style="max-width:560px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#f59e0b,#dc2626); padding:22px; text-align:center; color:#fff;">
      <h1 style="margin:0; font-size:20px;">⚠ Tu doble factor fue reiniciado</h1>
    </div>
    <div style="padding:28px; color:#374151; line-height:1.6; font-size:14px;">
      <p>Hola ${safeUser},</p>
      <p>Te informamos que tu <strong>doble factor de autenticación (2FA)</strong> de SoulForms fue reiniciado ${actor}.</p>
      <p>En tu próximo inicio de sesión deberás configurar 2FA otra vez escaneando un código QR nuevo desde tu app authenticator (Google Authenticator, Authy, Microsoft Authenticator, 1Password…).</p>
      <div style="background:#fef3c7; border-left:4px solid #f59e0b; padding:12px 14px; margin:18px 0; border-radius:0 6px 6px 0;">
        <strong>¿No esperabas este cambio?</strong><br>
        Contacta inmediatamente a un administrador y cambia tu contraseña — alguien podría haber accedido a tu cuenta.
      </div>
      <p style="font-size:12px; color:#9ca3af; margin-top:24px;">Este es un aviso automático de seguridad. No respondas a este correo.</p>
    </div>
  </div>
</body>
</html>`;
  }

  private buildResetPasswordHtml(name: string, resetUrl: string): string {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background:#f0f4f8; padding:20px;">
  <div style="max-width:560px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#00c2a8,#0891b2); padding:24px; text-align:center; color:#fff;">
      <h1 style="margin:0; font-size:22px;">Restablecer contraseña</h1>
    </div>
    <div style="padding:28px; color:#374151; line-height:1.6; font-size:14px;">
      <p>Hola ${name},</p>
      <p>Solicitaste restablecer tu contraseña de SoulForms. Haz clic en el botón para crear una nueva. El enlace expira en 30 minutos.</p>
      <p style="text-align:center; margin:28px 0;">
        <a href="${resetUrl}" style="display:inline-block; padding:12px 28px; background:#00c2a8; color:#fff; text-decoration:none; border-radius:8px; font-weight:600;">Restablecer contraseña</a>
      </p>
      <p style="font-size:12px; color:#9ca3af;">Si no solicitaste esto, ignora este correo.</p>
    </div>
  </div>
</body>
</html>`;
  }

  private buildReportLinkHtml(
    userName: string,
    formName: string,
    url: string,
    expiresInMinutes: number,
  ): string {
    const safeUser = (userName ?? '').trim() || 'usuario';
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background:#f0f4f8; padding:20px;">
  <div style="max-width:560px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#00c2a8,#0891b2); padding:22px; text-align:center; color:#fff;">
      <h1 style="margin:0; font-size:20px;">📊 Tu reporte está listo</h1>
    </div>
    <div style="padding:28px; color:#374151; line-height:1.6; font-size:14px;">
      <p>Hola ${safeUser},</p>
      <p>Ya está disponible tu reporte del formulario <strong>${formName}</strong>. Para descargarlo haz click en el botón:</p>
      <p style="text-align:center; margin:24px 0;">
        <a href="${url}" style="display:inline-block; padding:14px 32px; background:#00c2a8; color:#fff; text-decoration:none; border-radius:10px; font-weight:700; font-size:15px;">Descargar reporte</a>
      </p>
      <div style="background:#fef3c7; border-left:4px solid #f59e0b; padding:12px 14px; margin:18px 0; border-radius:0 6px 6px 0;">
        <strong>⏱ Tienes ${expiresInMinutes} minuto${expiresInMinutes === 1 ? '' : 's'}</strong><br>
        El link expira automáticamente y solo funciona una vez. Si el tiempo pasa, solicita el reporte de nuevo desde la app.
      </div>
      <div style="background:#eff6ff; border-left:4px solid #0891b2; padding:12px 14px; margin:18px 0; border-radius:0 6px 6px 0;">
        <strong>🔐 Verificación al descargar</strong><br>
        Al clic en el link, la app te pedirá el código de 6 dígitos de tu app authenticator (2FA). Luego se descargará un archivo Excel cifrado. Para abrirlo, Excel te pedirá tu <strong>número de documento</strong> como contraseña.
      </div>
      <p style="font-size:12px; color:#9ca3af; margin-top:24px;">Este es un envío automático. No respondas a este correo.</p>
    </div>
  </div>
</body>
</html>`;
  }
}
