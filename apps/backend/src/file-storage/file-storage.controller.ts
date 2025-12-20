import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FileStorageService } from './file-storage.service';
import { UploadFileDto, CreatePublicLinkDto } from './dto/upload-file.dto';

@Controller('attachments')
@UseGuards(JwtAuthGuard)
export class FileStorageController {
  constructor(private readonly fileStorageService: FileStorageService) {}

  /**
   * Upload a file
   * POST /attachments
   */
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
  ) {
    return this.fileStorageService.upload(userId, file, dto);
  }

  /**
   * Upload a file from base64 (for mobile app)
   * POST /attachments/base64
   */
  @Post('base64')
  uploadBase64(
    @CurrentUser('id') userId: string,
    @Body() body: { data: string } & UploadFileDto,
  ) {
    const { data, ...dto } = body;
    return this.fileStorageService.uploadFromBase64(userId, data, dto);
  }

  /**
   * Get attachment by ID
   * GET /attachments/:id
   */
  @Get(':id')
  findOne(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.fileStorageService.findOne(userId, id);
  }

  /**
   * List attachments by quote
   * GET /attachments/by-quote/:quoteId
   */
  @Get('by-quote/:quoteId')
  findByQuote(
    @CurrentUser('id') userId: string,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
  ) {
    return this.fileStorageService.findByQuote(userId, quoteId);
  }

  /**
   * List attachments by work order
   * GET /attachments/by-work-order/:workOrderId
   */
  @Get('by-work-order/:workOrderId')
  findByWorkOrder(
    @CurrentUser('id') userId: string,
    @Param('workOrderId', ParseUUIDPipe) workOrderId: string,
  ) {
    return this.fileStorageService.findByWorkOrder(userId, workOrderId);
  }

  /**
   * List attachments by client
   * GET /attachments/by-client/:clientId
   */
  @Get('by-client/:clientId')
  findByClient(
    @CurrentUser('id') userId: string,
    @Param('clientId', ParseUUIDPipe) clientId: string,
  ) {
    return this.fileStorageService.findByClient(userId, clientId);
  }

  /**
   * Download attachment
   * GET /attachments/:id/download
   */
  @Get(':id/download')
  async download(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, mimeType, fileName } = await this.fileStorageService.getFileBuffer(userId, id);

    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
    });

    return new StreamableFile(buffer);
  }

  /**
   * Delete attachment
   * DELETE /attachments/:id
   */
  @Delete(':id')
  remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.fileStorageService.remove(userId, id);
  }

  /**
   * Create public link for attachment
   * POST /attachments/:id/public-link
   */
  @Post(':id/public-link')
  createPublicLink(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePublicLinkDto,
  ) {
    return this.fileStorageService.createPublicLink(userId, id, dto);
  }

  /**
   * Revoke public link
   * DELETE /attachments/public-links/:linkId
   */
  @Delete('public-links/:linkId')
  revokePublicLink(
    @CurrentUser('id') userId: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ) {
    return this.fileStorageService.revokePublicLink(userId, linkId);
  }
}
