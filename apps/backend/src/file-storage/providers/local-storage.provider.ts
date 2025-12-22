import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  StorageProvider,
  UploadParams,
  UploadResult,
} from './storage-provider.interface';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly basePath: string;

  constructor() {
    // Base path for local file storage
    // Railway uses /app/storage with volumes
    this.basePath = process.env.STORAGE_PATH || (process.env.NODE_ENV === 'production' ? '/app/storage' : './storage');
  }

  async upload(params: UploadParams): Promise<UploadResult> {
    const { buffer, path: filePath, fileName } = params;

    // Build full path
    const fullDir = path.join(this.basePath, filePath);
    const fullPath = path.join(fullDir, fileName);

    // Ensure directory exists
    await fs.mkdir(fullDir, { recursive: true });

    // Write file
    await fs.writeFile(fullPath, buffer);

    this.logger.log(`File uploaded to: ${fullPath}`);

    // Return relative storage path
    const storagePath = path.join(filePath, fileName).replace(/\\/g, '/');

    // Build public URL for accessing the file
    // Use BASE_URL env var to generate full URL for external access (mobile apps, etc.)
    // Fallback to Railway URL if not set
    let baseUrl = process.env.BASE_URL || process.env.API_URL || '';
    if (!baseUrl && process.env.RAILWAY_PUBLIC_DOMAIN) {
      baseUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
    }
    if (!baseUrl) {
      baseUrl = 'https://monorepobackend-production.up.railway.app';
    }
    const relativePath = `/uploads/${storagePath}`;
    const publicUrl = `${baseUrl}${relativePath}`;

    this.logger.log(`Public URL: ${publicUrl} (baseUrl: ${baseUrl || 'not set'})`);

    return {
      storagePath,
      publicUrl,
    };
  }

  async getSignedUrl(storagePath: string, expiresIn?: number): Promise<string> {
    // For local storage, we don't have signed URLs
    // This would be used with S3 or similar services
    // Return a local path reference instead
    return `/api/attachments/download/${encodeURIComponent(storagePath)}`;
  }

  async delete(storagePath: string): Promise<void> {
    const fullPath = path.join(this.basePath, storagePath);

    try {
      await fs.unlink(fullPath);
      this.logger.log(`File deleted: ${fullPath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist, that's fine
    }
  }

  async getBuffer(storagePath: string): Promise<Buffer> {
    const fullPath = path.join(this.basePath, storagePath);
    return fs.readFile(fullPath);
  }

  async exists(storagePath: string): Promise<boolean> {
    const fullPath = path.join(this.basePath, storagePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}
