import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { UsersService } from '../users/users.service';
import { FormsService } from '../forms/forms.service';
import { SubmissionsService } from '../submissions/submissions.service';
import { EmailService } from '../email/email.service';
import { encryptXlsxOoxml } from './xlsx-crypto';
import { ReportDownloadsService } from './report-downloads.service';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import {
  AdminActionTargetType,
  AdminActionType,
} from '../admin-audit/admin-action.entity';

type Widget = {
  id: string;
  label: string;
  type: string;
};

const SUBMISSIONS_BATCH = 500;

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly formsService: FormsService,
    private readonly submissionsService: SubmissionsService,
    private readonly emailService: EmailService,
    private readonly reportDownloads: ReportDownloadsService,
    private readonly auditService: AdminAuditService,
  ) {}

  async exportSubmissionsAndEmail(
    userId: number,
    formId: string,
    fieldIds: string[],
  ): Promise<{ success: boolean; message: string; recipients: number }> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (!user.documentNumber?.trim()) {
      throw new ForbiddenException(
        'Debes tener un número de documento registrado para solicitar reportes. Pide a un administrador que te lo agregue.',
      );
    }
    if (!user.email?.trim()) {
      throw new BadRequestException(
        'Tu cuenta no tiene un correo válido para enviar el reporte.',
      );
    }

    const form = await this.formsService.findOne(formId);
    const schema = (form.schema as { widgets?: Widget[] } | undefined) ?? {};
    const widgets: Widget[] = Array.isArray(schema.widgets) ? schema.widgets : [];

    const requestedSet = new Set(fieldIds);
    const orderedFields = widgets.filter(
      (w) => w?.id && w.label && requestedSet.has(w.id),
    );
    if (orderedFields.length === 0) {
      throw new BadRequestException(
        'Debes seleccionar al menos un campo para exportar.',
      );
    }

    // 1) Excel en claro con exceljs
    const xlsxBuffer = await this.buildXlsxBuffer(form.name, formId, orderedFields);

    // 2) Cifrado OOXML AES-256 con la contraseña del usuario (documento)
    const encryptedBuffer = await encryptXlsxOoxml(
      xlsxBuffer,
      user.documentNumber.trim(),
    );

    const filename = `${this.sanitizeFilename(form.name)}_${this.timestamp()}.xlsx`;
    const ttlMinutes = 2;

    // 3) Guardar el blob en Mongo con TTL
    const { token, expiresAt } = await this.reportDownloads.create({
      userId,
      formId,
      formName: form.name,
      encryptedBuffer,
      filename,
      ttlMinutes,
    });

    // 4) Auditar la solicitud
    await this.auditService.log({
      actor: { id: userId, name: user.email, role: user.role },
      action: AdminActionType.REPORT_REQUESTED,
      targetType: AdminActionTargetType.FORM,
      targetId: formId,
      targetName: form.name,
      metadata: {
        fieldCount: orderedFields.length,
        tokenId: token,
        expiresAt,
      },
    });

    // 5) Enviar correo con link único
    const appBaseUrl =
      process.env.APP_BASE_URL || 'http://localhost:5173';
    const url = `${appBaseUrl.replace(/\/$/, '')}/reports/download/${token}`;

    await this.emailService.sendReportLink({
      to: user.email,
      userName: user.name,
      formName: form.name,
      url,
      expiresInMinutes: ttlMinutes,
    });

    return {
      success: true,
      message: `Enviamos el enlace a tu correo. Tienes ${ttlMinutes} minutos para descargarlo antes de que expire.`,
      recipients: 1,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async buildXlsxBuffer(
    formName: string,
    formId: string,
    fields: Widget[],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SoulForms';
    workbook.created = new Date();
    const ws = workbook.addWorksheet('Envios');

    ws.columns = fields.map((f) => ({
      header: f.label,
      key: f.id,
      width: Math.min(60, Math.max(12, f.label.length + 2)),
    }));

    // Estilo de headers
    ws.getRow(1).eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6FAF7' },
      };
      cell.alignment = { vertical: 'middle' };
    });

    // Cargamos las submissions por lotes grandes para minimizar round-trips
    // a Mongo. Para formularios muy grandes ExcelJS aguanta cientos de miles
    // de filas sin problema.
    let page = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const batch = await this.submissionsService.findByForm(
        formId,
        page,
        SUBMISSIONS_BATCH,
      );
      if (!batch.data.length) break;
      for (const sub of batch.data) {
        const row: Record<string, unknown> = {};
        for (const f of fields) {
          const raw = (sub.data as Record<string, unknown> | undefined)?.[f.id];
          row[f.id] = this.stringifyCell(raw);
        }
        ws.addRow(row);
      }
      const seen = (page - 1) * SUBMISSIONS_BATCH + batch.data.length;
      if (seen >= batch.total || batch.data.length < SUBMISSIONS_BATCH) break;
      page += 1;
    }

    this.logger.log(
      `[reports] xlsx generado formulario="${formName}" filas=${ws.rowCount - 1}`,
    );

    const arr = await workbook.xlsx.writeBuffer();
    return Buffer.from(arr as ArrayBuffer);
  }

  private stringifyCell(value: unknown): string {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean')
      return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private sanitizeFilename(name: string): string {
    return (
      name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80) ||
      'reporte'
    );
  }

  private timestamp(): string {
    return new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, 19);
  }
}
