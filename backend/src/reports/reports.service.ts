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
import { SecureDownloadsService } from './secure-downloads.service';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import {
  AdminActionTargetType,
  AdminActionType,
} from '../admin-audit/admin-action.entity';
import {
  buildReportColumns,
  countSubformEntries,
  getSubformInnerFields,
  type ReportWidget,
} from './report-columns';

type Widget = ReportWidget;

const SUBMISSIONS_BATCH = 500;

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly formsService: FormsService,
    private readonly submissionsService: SubmissionsService,
    private readonly emailService: EmailService,
    private readonly secureDownloads: SecureDownloadsService,
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
    const { token, expiresAt } = await this.secureDownloads.create({
      userId,
      kind: 'excel',
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

  /**
   * Igual que exportSubmissionsAndEmail pero acotado a los registros de UNA
   * tarea (por taskId). Si no se pasan fieldIds, exporta TODOS los campos del
   * formulario (la pestaña de tareas no tiene selector de columnas).
   */
  async exportTaskSubmissionsAndEmail(
    userId: number,
    formId: string,
    taskId: string,
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

    // Sin fieldIds → todas las columnas con label. Con fieldIds → las pedidas.
    const requestedSet = new Set(fieldIds);
    const orderedFields = widgets.filter(
      (w) =>
        w?.id &&
        w.label &&
        (requestedSet.size === 0 || requestedSet.has(w.id)),
    );
    if (orderedFields.length === 0) {
      throw new BadRequestException('El formulario no tiene campos para exportar.');
    }

    const xlsxBuffer = await this.buildXlsxBuffer(
      form.name,
      formId,
      orderedFields,
      taskId,
    );
    const encryptedBuffer = await encryptXlsxOoxml(
      xlsxBuffer,
      user.documentNumber.trim(),
    );
    const filename = `${this.sanitizeFilename(form.name)}_tarea_${this.timestamp()}.xlsx`;
    const ttlMinutes = 2;

    const { token, expiresAt } = await this.secureDownloads.create({
      userId,
      kind: 'excel',
      formId,
      formName: form.name,
      encryptedBuffer,
      filename,
      ttlMinutes,
    });

    await this.auditService.log({
      actor: { id: userId, name: user.email, role: user.role },
      action: AdminActionType.REPORT_REQUESTED,
      targetType: AdminActionTargetType.FORM,
      targetId: formId,
      targetName: form.name,
      metadata: { taskId, fieldCount: orderedFields.length, tokenId: token, expiresAt },
    });

    const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
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

  /**
   * Itera las submissions a exportar. Si `taskId` viene, solo las de esa tarea
   * (una sola carga; volumen bajo). Si no, todo el formulario paginado.
   */
  private async *iterSubmissions(
    formId: string,
    taskId?: string,
  ): AsyncGenerator<Array<{ data?: unknown }>> {
    if (taskId) {
      const docs = await this.submissionsService.findByTaskId(taskId);
      if (docs.length) yield docs as Array<{ data?: unknown }>;
      return;
    }
    let page = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const batch = await this.submissionsService.findByForm(
        formId,
        page,
        SUBMISSIONS_BATCH,
      );
      if (!batch.data.length) return;
      yield batch.data as Array<{ data?: unknown }>;
      const seen = (page - 1) * SUBMISSIONS_BATCH + batch.data.length;
      if (seen >= batch.total || batch.data.length < SUBMISSIONS_BATCH) return;
      page += 1;
    }
  }

  private async buildXlsxBuffer(
    formName: string,
    formId: string,
    fields: Widget[],
    taskId?: string,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SoulForms';
    workbook.created = new Date();
    const ws = workbook.addWorksheet('Envios');

    // Los subformularios se despliegan en columnas: cada campo interno se
    // convierte en su propia columna. Como un envío puede tener varias
    // entradas, primero recorremos las submissions para saber el máximo de
    // entradas por subformulario y así generar las columnas necesarias.
    const subformFields = fields.filter(
      (f) => f.type === 'subform' && getSubformInnerFields(f).length > 0,
    );
    const maxEntriesByWidget = subformFields.length
      ? await this.computeMaxSubformEntries(formId, subformFields, taskId)
      : {};

    const columns = buildReportColumns(fields, maxEntriesByWidget);

    ws.columns = columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: Math.min(60, Math.max(12, c.header.length + 2)),
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
    // de filas sin problema. Con taskId, solo las de esa tarea.
    // Precomputar las keys de columnas que necesitan wrapText — así solo
    // iteramos esas celdas por fila en vez de mapear todas.
    const wrapKeys = columns.filter((c) => c.wrapText).map((c) => c.key);

    for await (const batch of this.iterSubmissions(formId, taskId)) {
      for (const sub of batch) {
        const data = sub.data as Record<string, unknown> | undefined;
        const row: Record<string, unknown> = {};
        for (const col of columns) {
          row[col.key] = col.value(data);
        }
        const excelRow = ws.addRow(row);
        // Aplicar wrapText a las celdas de widgets textarea para que
        // los \n se pinten como saltos reales dentro de la celda.
        for (const key of wrapKeys) {
          excelRow.getCell(key).alignment = { wrapText: true, vertical: 'top' };
        }
      }
    }

    this.logger.log(
      `[reports] xlsx generado formulario="${formName}" filas=${ws.rowCount - 1}`,
    );

    const arr = await workbook.xlsx.writeBuffer();
    return Buffer.from(arr as ArrayBuffer);
  }

  /**
   * Primera pasada sobre las submissions: calcula, por cada subformulario, el
   * número máximo de entradas registrado para saber cuántas columnas generar.
   */
  private async computeMaxSubformEntries(
    formId: string,
    subformFields: Widget[],
    taskId?: string,
  ): Promise<Record<string, number>> {
    const max: Record<string, number> = {};
    for (const f of subformFields) max[f.id] = 0;

    for await (const batch of this.iterSubmissions(formId, taskId)) {
      for (const sub of batch) {
        const data = sub.data as Record<string, unknown> | undefined;
        for (const f of subformFields) {
          const n = countSubformEntries(data?.[f.id]);
          if (n > max[f.id]) max[f.id] = n;
        }
      }
    }

    return max;
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
