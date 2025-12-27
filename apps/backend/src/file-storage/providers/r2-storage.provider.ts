import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  StorageProvider,
  UploadParams,
  UploadResult,
} from './storage-provider.interface';

@Injectable()
export class R2StorageProvider implements StorageProvider {
  private readonly logger = new Logger(R2StorageProvider.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly publicUrl: string;

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    this.bucketName = process.env.R2_BUCKET_NAME || 'auvoflow';
    this.publicUrl = process.env.R2_PUBLIC_URL || '';

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'R2 credentials not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY',
      );
    }

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.logger.log(`R2 Storage initialized for bucket: ${this.bucketName}`);
  }

  async upload(params: UploadParams): Promise<UploadResult> {
    const { buffer, mimeType, path: filePath, fileName } = params;

    // Build the full key (path in bucket)
    const key = `${filePath}/${fileName}`.replace(/^\/+/, '');

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
        }),
      );

      this.logger.log(`File uploaded to R2: ${key}`);

      // Build public URL
      const publicUrl = this.publicUrl
        ? `${this.publicUrl}/${key}`
        : undefined;

      return {
        storagePath: key,
        publicUrl,
      };
    } catch (error) {
      this.logger.error(`Failed to upload to R2: ${error}`);
      throw error;
    }
  }

  async getSignedUrl(storagePath: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: storagePath,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async delete(storagePath: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: storagePath,
        }),
      );

      this.logger.log(`File deleted from R2: ${storagePath}`);
    } catch (error) {
      this.logger.error(`Failed to delete from R2: ${error}`);
      throw error;
    }
  }

  async getBuffer(storagePath: string): Promise<Buffer> {
    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: storagePath,
        }),
      );

      // Convert readable stream to buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }

      return Buffer.concat(chunks);
    } catch (error) {
      this.logger.error(`Failed to get file from R2: ${error}`);
      throw error;
    }
  }

  async exists(storagePath: string): Promise<boolean> {
    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: storagePath,
        }),
      );
      return true;
    } catch (error) {
      if ((error as any).name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }
}
