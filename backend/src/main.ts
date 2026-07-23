import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Helmet: agrega headers HTTP de seguridad (HSTS, X-DNS-Prefetch-Control,
  // X-Frame-Options, Permitted-Cross-Domain-Policies, etc.). CSP la
  // dejamos OFF porque la API no sirve HTML.
  app.use(helmet({ contentSecurityPolicy: false }));

  // Aumentar el límite del body parser (default 100kb es muy bajo).
  // Las plantillas con Excel/PDF base64 pueden pesar varios MB.
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // Prefijo global para todas las rutas: /api/...
  app.setGlobalPrefix('api');

  // Soporta múltiples orígenes separados por coma en FRONTEND_ORIGIN.
  // Además permite cualquier localhost/127.0.0.1/IP privada (10.x, 192.168.x, 172.16-31.x) en el puerto de Vite.
  const configuredOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const lanOriginRegex = /^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+):\d+$/;

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      if (configuredOrigins.includes(origin) || lanOriginRegex.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} no permitido por CORS`), false);
    },
    credentials: true,
  });

  // Logging de requests para diagnóstico.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      console.log(`[REQ] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
    });
    next();
  });

  // Seguridad HTTP básica y evitar cacheado de páginas protegidas.
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
    next();
  });

  // Validación automática de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`SoulForms Backend corriendo en http://localhost:${port}`);
}
bootstrap();
