// Polyfill for crypto.randomUUID (required for uuid v13+ on Node 18)
// Deploy trigger: 2024-12-22
import { webcrypto } from 'crypto';
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as Crypto;
}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: true,
    logger: process.env.NODE_ENV === 'production'
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Trust proxy - importante para rate limiting e logging correto em produção
  // Quando rodando atrás de load balancers (AWS, GCP, Azure, etc)
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // Helmet - Security headers
  // Protege contra ataques comuns: XSS, clickjacking, etc
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // Permite carregar recursos de outras origens (necessário para imagens no frontend)
    }),
  );

  // Compression - Comprime respostas HTTP (gzip)
  // Reduz bandwidth em ~70%, essencial para 1M+ usuários
  app.use(
    compression({
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      threshold: 1024, // Só comprime respostas > 1KB
      level: 6, // Balance entre compressão e CPU (0-9)
    }),
  );

  // Aumentar limite do body parser para aceitar uploads base64 maiores
  app.useBodyParser('json', { limit: '50mb' });
  app.useBodyParser('urlencoded', { limit: '50mb', extended: true });

  // Serve static files from storage directory
  // Railway uses /app/storage with volumes
  const storagePath = process.env.STORAGE_PATH || (process.env.NODE_ENV === 'production' ? '/app/storage' : './storage');
  app.useStaticAssets(storagePath.startsWith('/') ? storagePath : join(process.cwd(), storagePath), {
    prefix: '/uploads/',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // Evita ataques de payload massivo
      forbidUnknownValues: true,
    }),
  );

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('FieldFlow API')
    .setDescription('API documentation for FieldFlow - Field Service Management System')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('auth', 'Authentication endpoints')
    .addTag('plans', 'Plans and usage management')
    .addTag('clients', 'Client management')
    .addTag('items', 'Items management (products and services)')
    .addTag('Equipments', 'Equipment management (client equipment)')
    .addTag('Quotes', 'Quotes and budget management')
    .addTag('Work Orders', 'Work orders and field service management')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Swagger apenas em desenvolvimento
  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('api', app, document);
  }

  // CORS restritivo - apenas domínios permitidos
  const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:8081', // Expo
    'https://auvoautonomo-web-7duo.vercel.app', // Vercel production
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Permite requests sem origin (mobile apps, Postman, etc)
      if (!origin) {
        return callback(null, true);
      }

      // Verifica se origin está na lista permitida
      if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-User-Id'],
    exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
    maxAge: 86400, // Cache preflight por 24h
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);

  logger.log(`Backend running on http://localhost:${port}`);
  logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  if (process.env.NODE_ENV !== 'production') {
    logger.log(`Swagger docs available at http://localhost:${port}/api`);
  }

  // Graceful shutdown - fecha conexões corretamente
  // Importante para K8s, Docker, e deploys sem downtime
  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, starting graceful shutdown...`);

    try {
      await app.close();
      logger.log('Application closed successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Trata erros não capturados
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    shutdown('uncaughtException');
  });
}
bootstrap();
