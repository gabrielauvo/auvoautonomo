import { Module } from '@nestjs/common';
import { FileStorageService } from './file-storage.service';
import { FileStorageController } from './file-storage.controller';
import { PublicFilesController } from './public-files.controller';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { STORAGE_PROVIDER } from './providers/storage-provider.interface';

@Module({
  controllers: [FileStorageController, PublicFilesController],
  providers: [
    FileStorageService,
    {
      provide: STORAGE_PROVIDER,
      useClass: LocalStorageProvider,
    },
  ],
  exports: [FileStorageService, STORAGE_PROVIDER],
})
export class FileStorageModule {}
