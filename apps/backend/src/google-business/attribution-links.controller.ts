import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUserId } from '../auth/decorators/get-user-id.decorator';
import { AttributionLinksService } from './attribution-links.service';
import {
  CreateAttributionLinkDto,
  UpdateAttributionLinkDto,
  AttributionLinkDto,
  TrackClickQueryDto,
  AttributionLinkStatsDto,
} from './dto/attribution-link.dto';

@ApiTags('attribution-links')
@Controller('attribution-links')
export class AttributionLinksController {
  constructor(private readonly service: AttributionLinksService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new attribution link' })
  @ApiResponse({ status: 201, type: AttributionLinkDto })
  create(
    @GetUserId() userId: string,
    @Body() dto: CreateAttributionLinkDto,
  ): Promise<AttributionLinkDto> {
    return this.service.create(userId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all attribution links' })
  @ApiResponse({ status: 200, type: [AttributionLinkDto] })
  findAll(@GetUserId() userId: string): Promise<AttributionLinkDto[]> {
    return this.service.findAll(userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get an attribution link by ID' })
  @ApiResponse({ status: 200, type: AttributionLinkDto })
  findOne(
    @GetUserId() userId: string,
    @Param('id') id: string,
  ): Promise<AttributionLinkDto> {
    return this.service.findOne(userId, id);
  }

  @Get(':id/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get click statistics for an attribution link' })
  @ApiResponse({ status: 200, type: AttributionLinkStatsDto })
  getStats(
    @GetUserId() userId: string,
    @Param('id') id: string,
  ): Promise<AttributionLinkStatsDto> {
    return this.service.getStats(userId, id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an attribution link' })
  @ApiResponse({ status: 200, type: AttributionLinkDto })
  update(
    @GetUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAttributionLinkDto,
  ): Promise<AttributionLinkDto> {
    return this.service.update(userId, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an attribution link' })
  @ApiResponse({ status: 204 })
  delete(
    @GetUserId() userId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.service.delete(userId, id);
  }
}

/**
 * Public controller for tracking redirects
 * Mounted at /t/:slug
 */
@ApiTags('tracking')
@Controller('t')
export class TrackingRedirectController {
  constructor(private readonly service: AttributionLinksService) {}

  @Get(':slug')
  @ApiOperation({ summary: 'Track click and redirect to target URL' })
  @ApiParam({ name: 'slug', description: 'Attribution link slug' })
  @ApiResponse({ status: 302, description: 'Redirects to target URL' })
  @ApiResponse({ status: 404, description: 'Link not found' })
  async trackAndRedirect(
    @Param('slug') slug: string,
    @Query() query: TrackClickQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const { targetUrl } = await this.service.trackClick(slug, {
      source: query.utm_source,
      medium: query.utm_medium,
      campaign: query.utm_campaign,
    });

    res.redirect(targetUrl);
  }
}
