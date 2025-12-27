import { Module } from '@nestjs/common';
import { FileStorageService } from './file-storage.service';
import { FileStorageController } from './file-storage.controller';
import { PublicFilesController } from './public-files.controller';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { R2StorageProvider } from './providers/r2-storage.provider';
import { STORAGE_PROVIDER } from './providers/storage-provider.interface';

// Use R2 in production, local storage in development
const StorageProviderClass =
  process.env.R2_ACCOUNT_ID && process.env.NODE_ENV === 'production'
    ? R2StorageProvider
    : LocalStorageProvider;

@Module({
  controllers: [FileStorageController, PublicFilesController],
  providers: [
    FileStorageService,
    {
      provide: STORAGE_PROVIDER,
      useClass: StorageProviderClass,
    },
  ],
  exports: [FileStorageService, STORAGE_PROVIDER],
})
export class FileStorageModule {}
