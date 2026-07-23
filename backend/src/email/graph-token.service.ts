import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';

/**
 * Cache del token de Microsoft Graph (client_credentials flow).
 * Reusa el token hasta 2 min antes de expirar.
 */
@Injectable()
export class GraphTokenService {
  private readonly logger = new Logger(GraphTokenService.name);
  private cachedToken: string | null = null;
  private expiresAt = 0;

  async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.expiresAt - 120_000) {
      return this.cachedToken;
    }

    const tenantId = process.env.TENANT_ID;
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    if (!tenantId || !clientId || !clientSecret) {
      throw new InternalServerErrorException(
        'Falta TENANT_ID, CLIENT_ID o CLIENT_SECRET en el entorno',
      );
    }

    const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Error obteniendo token de Graph: ${err}`);
      throw new InternalServerErrorException(`Error obteniendo token: ${res.status}`);
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.cachedToken = data.access_token;
    this.expiresAt = Date.now() + data.expires_in * 1000;
    return this.cachedToken;
  }
}
