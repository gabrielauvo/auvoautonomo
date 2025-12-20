import {
  Controller,
  Get,
  Param,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { FileStorageService } from './file-storage.service';

/**
 * Public controller for accessing files via token
 * No authentication required - security is based on the token
 */
@Controller('public/files')
export class PublicFilesController {
  constructor(private readonly fileStorageService: FileStorageService) {}

  /**
   * Access file via public token
   * GET /public/files/:token
   */
  @Get(':token')
  async getFile(
    @Param('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, mimeType, fileName } = await this.fileStorageService.getFileByToken(token);

    // For PDFs, display inline; for others, download
    const disposition = mimeType === 'application/pdf' ? 'inline' : 'attachment';

    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `${disposition}; filename="${encodeURIComponent(fileName)}"`,
      'Cache-Control': 'private, max-age=3600',
    });

    return new StreamableFile(buffer);
  }
}
