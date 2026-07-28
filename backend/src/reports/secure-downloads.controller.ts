import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TotpService } from '../auth/totp.service';
import { UsersService } from '../users/users.service';
import { SecureDownloadsService } from './secure-downloads.service';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import {
  AdminActionTargetType,
  AdminActionType,
} from '../admin-audit/admin-action.entity';

@UseGuards(JwtAuthGuard)
@Controller('secure-downloads')
export class SecureDownloadsController {
  constructor(
    private readonly downloads: SecureDownloadsService,
    private readonly totpService: TotpService,
    private readonly usersService: UsersService,
    private readonly auditService: AdminAuditService,
  ) {}

  // Devuelve solo metadata; sirve para que el frontend arme la pantalla
  // de verificación 2FA (mostrar nombre del form + timer).
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get(':token/meta')
  async meta(
    @Param('token') token: string,
    @Req() req: { user: { id: number } },
  ) {
    return this.downloads.getMeta(token, Number(req.user.id));
  }

  /**
   * Verifica el código TOTP del usuario y, si es correcto, consume el token
   * y envía el buffer cifrado como archivo adjunto. En cualquier error
   * registramos REPORT_DOWNLOAD_FAILED con la causa; en éxito, DOWNLOADED.
   */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':token')
  async download(
    @Param('token') token: string,
    @Body() body: { code: string },
    @Req() req: { user: { id: number } },
    @Res() res: Response,
  ) {
    const userId = Number(req.user.id);
    const user = await this.usersService.findById(userId);

    const failLog = (reason: string) =>
      this.auditService.log({
        actor: {
          id: userId,
          name: user?.email ?? `user#${userId}`,
          role: user?.role ?? 'user',
        },
        action: AdminActionType.REPORT_DOWNLOAD_FAILED,
        targetType: AdminActionTargetType.FORM,
        targetId: token,
        targetName: null,
        metadata: { reason },
      });

    if (!user || !user.totpEnabled || !user.totpSecret) {
      await failLog('2fa_not_active');
      throw new UnauthorizedException(
        'Debes tener 2FA activo para descargar reportes.',
      );
    }
    const cleaned = (body?.code ?? '').replace(/\s+/g, '');
    if (cleaned.length !== 6) {
      await failLog('invalid_totp');
      throw new UnauthorizedException('Código incorrecto.');
    }
    const valid = await this.totpService.verifyToken(cleaned, user.totpSecret);
    if (!valid) {
      const attempts = await this.downloads.incrementTotpAttempts(
        token,
        userId,
      );
      await failLog(attempts >= 3 ? 'exhausted' : 'invalid_totp');
      throw new UnauthorizedException('Código incorrecto.');
    }

    let out;
    try {
      out = await this.downloads.consume(token, userId);
    } catch (err) {
      // 410 Gone o 403; en ambos casos registramos.
      const reason =
        (err as { status?: number })?.status === 403
          ? 'wrong_user'
          : 'expired';
      await failLog(reason);
      throw err;
    }

    await this.auditService.log({
      actor: { id: userId, name: user.email, role: user.role },
      action: AdminActionType.REPORT_DOWNLOADED,
      targetType: AdminActionTargetType.FORM,
      targetId: token,
      targetName: out.filename,
      metadata: { bytesServed: out.buffer.length, kind: out.kind },
    });

    const contentType =
      out.kind === 'bulk-pdf'
        ? 'application/zip'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    // RFC 5987 filename*=UTF-8''<pct-encoded> por si el nombre trae acentos.
    const encoded = encodeURIComponent(out.filename);
    res
      .status(200)
      .setHeader('Content-Type', contentType)
      .setHeader(
        'Content-Disposition',
        `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`,
      )
      .setHeader('Content-Length', out.buffer.length.toString())
      .end(out.buffer);
  }
}
