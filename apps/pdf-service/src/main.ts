import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('PdfService');

  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();

  const port = process.env.PDF_SERVICE_PORT || 3002;
  await app.listen(port);

  logger.log(`PDF Service rodando na porta ${port}`);
}

bootstrap();
