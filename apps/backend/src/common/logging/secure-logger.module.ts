import { Module, Global } from '@nestjs/common';
import { SecureLoggerService } from './secure-logger.service';

/**
 * SecureLoggerModule - Módulo global para logging seguro
 *
 * Este módulo é marcado como @Global() para que possa ser usado
 * em qualquer lugar da aplicação sem precisar importar em cada módulo
 */
@Global()
@Module({
  providers: [SecureLoggerService],
  exports: [SecureLoggerService],
})
export class SecureLoggerModule {}
