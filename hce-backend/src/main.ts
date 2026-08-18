import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import { join } from 'path';
import * as fs from 'fs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['log', 'error', 'warn']
        : ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  // Asegurar que la carpeta uploads exista y servirla como estática
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // Security headers
  app.use(helmet());

  // Rate limiting. Nota: un SPA dispara varias requests por pantalla; 100/15min era
  // demasiado bajo (se agotaba al abrir pantallas con listas). Se sube a 1000/15min.
  // TODO (backlog REQ-001-INF-1.13/1.14): configurar trust proxy + keyear por usuario/tenant
  // en vez de IP (detrás de Cloudflare todas las requests comparten la IP del proxy).
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 1000,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        statusCode: 429,
        message: 'Demasiadas solicitudes. Intente nuevamente en 15 minutos.',
      },
    }),
  );

  // CORS restringido
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://app.systia.ar',
      ];
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origen no permitido: ${origin}`));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Validation Pipe global
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Exception Filter global
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger / OpenAPI
  if (
    process.env.NODE_ENV !== 'production' ||
    process.env.SWAGGER_ENABLED === 'true'
  ) {
    const config = new DocumentBuilder()
      .setTitle('DentaCloud HCE API')
      .setDescription('API REST de Historia Clínica Electrónica DentaCloud')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`HCE Backend REST API corriendo en: http://localhost:${port}`);
}
bootstrap();
