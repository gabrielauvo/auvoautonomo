export interface UploadParams {
  buffer: Buffer;
  mimeType: string;
  path: string;
  fileName: string;
}

export interface UploadResult {
  storagePath: string;
  publicUrl?: string;
}

export interface StorageProvider {
  upload(params: UploadParams): Promise<UploadResult>;
  getSignedUrl?(storagePath: string, expiresIn?: number): Promise<string>;
  delete?(storagePath: string): Promise<void>;
  getBuffer(storagePath: string): Promise<Buffer>;
  exists(storagePath: string): Promise<boolean>;
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
