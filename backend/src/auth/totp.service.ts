import { Injectable } from '@nestjs/common';
import { OTP } from 'otplib';
import * as QRCode from 'qrcode';

const ISSUER = 'SoulForms';

/**
 * Wrapper sobre `otplib` para generar/verificar códigos TOTP (Google
 * Authenticator, Authy, Microsoft Authenticator, 1Password, etc.).
 *
 * Importamos `OTP` desde el index principal de `otplib`, NO desde el
 * subpath `'otplib/class'` — el subpath requiere `moduleResolution:
 * node16/nodenext/bundler` (exports map), pero este proyecto usa el
 * resolver clásico. El index principal re-exporta `OTP`.
 *
 * `epochTolerance: [30, 30]` da tolerancia de ±30 segundos para acomodar
 * drift entre el reloj del móvil del usuario y el del servidor.
 */
@Injectable()
export class TotpService {
  private readonly otp = new OTP({ strategy: 'totp' });

  generateSecret(): string {
    return this.otp.generateSecret();
  }

  async generateQrCodeDataUrl(email: string, secret: string): Promise<string> {
    const uri = this.otp.generateURI({ issuer: ISSUER, label: email, secret });
    return QRCode.toDataURL(uri);
  }

  async verifyToken(token: string, secret: string): Promise<boolean> {
    try {
      const result = await this.otp.verify({
        token,
        secret,
        epochTolerance: [30, 30],
      });
      return result.valid;
    } catch {
      return false;
    }
  }
}
