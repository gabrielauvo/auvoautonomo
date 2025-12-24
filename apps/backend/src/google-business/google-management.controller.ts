import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUserId } from '../auth/decorators/get-user-id.decorator';
import { GoogleManagementService, LocalPost, MediaItem, BusinessHours } from './google-management.service';

// ==========================================================================
// DTOs
// ==========================================================================

class ReplyToReviewDto {
  comment: string;
}

class CreatePostDto {
  summary: string;
  topicType?: 'STANDARD' | 'EVENT' | 'OFFER' | 'ALERT';
  callToAction?: {
    actionType: 'BOOK' | 'ORDER' | 'SHOP' | 'LEARN_MORE' | 'SIGN_UP' | 'CALL';
    url?: string;
  };
  media?: Array<{
    mediaFormat: 'PHOTO' | 'VIDEO';
    sourceUrl: string;
  }>;
  event?: {
    title: string;
    schedule: {
      startDate: { year: number; month: number; day: number };
      startTime?: { hours: number; minutes: number };
      endDate: { year: number; month: number; day: number };
      endTime?: { hours: number; minutes: number };
    };
  };
  offer?: {
    couponCode?: string;
    redeemOnlineUrl?: string;
    termsConditions?: string;
  };
}

class CreateMediaDto {
  mediaFormat: 'PHOTO' | 'VIDEO';
  sourceUrl: string;
  description?: string;
  category?: 'COVER' | 'PROFILE' | 'LOGO' | 'EXTERIOR' | 'INTERIOR' | 'PRODUCT' | 'AT_WORK' | 'FOOD_AND_DRINK' | 'MENU' | 'TEAMS' | 'ADDITIONAL';
}

class AnswerQuestionDto {
  text: string;
}

class UpdateBusinessHoursDto {
  periods: Array<{
    openDay: string;
    openTime: string;
    closeDay: string;
    closeTime: string;
  }>;
}

class UpdateBusinessDescriptionDto {
  description: string;
}

class UpdateBusinessPhoneDto {
  primaryPhone: string;
}

class UpdateBusinessWebsiteDto {
  websiteUri: string;
}

// ==========================================================================
// Controller
// ==========================================================================

@ApiTags('google-management')
@Controller('google-business/manage')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GoogleManagementController {
  constructor(private readonly managementService: GoogleManagementService) {}

  // =========================================================================
  // Reviews
  // =========================================================================

  @Get('reviews')
  @ApiOperation({ summary: 'List all reviews' })
  @ApiQuery({ name: 'pageToken', required: false })
  @ApiResponse({ status: 200, description: 'Reviews list' })
  listReviews(
    @GetUserId() userId: string,
    @Query('pageToken') pageToken?: string,
  ) {
    return this.managementService.listReviews(userId, pageToken);
  }

  @Get('reviews/:reviewId')
  @ApiOperation({ summary: 'Get a specific review' })
  @ApiParam({ name: 'reviewId', description: 'Review ID' })
  @ApiResponse({ status: 200, description: 'Review details' })
  getReview(
    @GetUserId() userId: string,
    @Param('reviewId') reviewId: string,
  ) {
    return this.managementService.getReview(userId, reviewId);
  }

  @Put('reviews/:reviewId/reply')
  @ApiOperation({ summary: 'Reply to a review' })
  @ApiParam({ name: 'reviewId', description: 'Review ID' })
  @ApiResponse({ status: 200, description: 'Reply sent' })
  replyToReview(
    @GetUserId() userId: string,
    @Param('reviewId') reviewId: string,
    @Body() dto: ReplyToReviewDto,
  ) {
    return this.managementService.replyToReview(userId, reviewId, dto.comment);
  }

  @Delete('reviews/:reviewId/reply')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a review reply' })
  @ApiParam({ name: 'reviewId', description: 'Review ID' })
  @ApiResponse({ status: 204, description: 'Reply deleted' })
  deleteReviewReply(
    @GetUserId() userId: string,
    @Param('reviewId') reviewId: string,
  ) {
    return this.managementService.deleteReviewReply(userId, reviewId);
  }

  // =========================================================================
  // Posts
  // =========================================================================

  @Get('posts')
  @ApiOperation({ summary: 'List all posts' })
  @ApiQuery({ name: 'pageToken', required: false })
  @ApiResponse({ status: 200, description: 'Posts list' })
  listPosts(
    @GetUserId() userId: string,
    @Query('pageToken') pageToken?: string,
  ) {
    return this.managementService.listPosts(userId, pageToken);
  }

  @Post('posts')
  @ApiOperation({ summary: 'Create a new post' })
  @ApiResponse({ status: 201, description: 'Post created' })
  createPost(
    @GetUserId() userId: string,
    @Body() dto: CreatePostDto,
  ) {
    return this.managementService.createPost(userId, dto);
  }

  @Patch('posts/:postName')
  @ApiOperation({ summary: 'Update a post' })
  @ApiParam({ name: 'postName', description: 'Full post resource name' })
  @ApiResponse({ status: 200, description: 'Post updated' })
  updatePost(
    @GetUserId() userId: string,
    @Param('postName') postName: string,
    @Body() dto: Partial<CreatePostDto>,
  ) {
    return this.managementService.updatePost(userId, postName, dto);
  }

  @Delete('posts/:postName')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a post' })
  @ApiParam({ name: 'postName', description: 'Full post resource name' })
  @ApiResponse({ status: 204, description: 'Post deleted' })
  deletePost(
    @GetUserId() userId: string,
    @Param('postName') postName: string,
  ) {
    return this.managementService.deletePost(userId, postName);
  }

  // =========================================================================
  // Media/Photos
  // =========================================================================

  @Get('media')
  @ApiOperation({ summary: 'List all media/photos' })
  @ApiQuery({ name: 'pageToken', required: false })
  @ApiResponse({ status: 200, description: 'Media list' })
  listMedia(
    @GetUserId() userId: string,
    @Query('pageToken') pageToken?: string,
  ) {
    return this.managementService.listMedia(userId, pageToken);
  }

  @Post('media')
  @ApiOperation({ summary: 'Upload a new photo' })
  @ApiResponse({ status: 201, description: 'Photo uploaded' })
  createMedia(
    @GetUserId() userId: string,
    @Body() dto: CreateMediaDto,
  ) {
    return this.managementService.createMedia(userId, dto);
  }

  @Delete('media/:mediaName')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a photo' })
  @ApiParam({ name: 'mediaName', description: 'Full media resource name' })
  @ApiResponse({ status: 204, description: 'Photo deleted' })
  deleteMedia(
    @GetUserId() userId: string,
    @Param('mediaName') mediaName: string,
  ) {
    return this.managementService.deleteMedia(userId, mediaName);
  }

  // =========================================================================
  // Q&A
  // =========================================================================

  @Get('questions')
  @ApiOperation({ summary: 'List all questions' })
  @ApiQuery({ name: 'pageToken', required: false })
  @ApiResponse({ status: 200, description: 'Questions list' })
  listQuestions(
    @GetUserId() userId: string,
    @Query('pageToken') pageToken?: string,
  ) {
    return this.managementService.listQuestions(userId, pageToken);
  }

  @Post('questions/:questionName/answer')
  @ApiOperation({ summary: 'Answer a question' })
  @ApiParam({ name: 'questionName', description: 'Full question resource name' })
  @ApiResponse({ status: 200, description: 'Answer posted' })
  answerQuestion(
    @GetUserId() userId: string,
    @Param('questionName') questionName: string,
    @Body() dto: AnswerQuestionDto,
  ) {
    return this.managementService.answerQuestion(userId, questionName, dto.text);
  }

  @Delete('answers/:answerName')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an answer' })
  @ApiParam({ name: 'answerName', description: 'Full answer resource name' })
  @ApiResponse({ status: 204, description: 'Answer deleted' })
  deleteAnswer(
    @GetUserId() userId: string,
    @Param('answerName') answerName: string,
  ) {
    return this.managementService.deleteAnswer(userId, answerName);
  }

  // =========================================================================
  // Business Information
  // =========================================================================

  @Get('business-info')
  @ApiOperation({ summary: 'Get business information' })
  @ApiResponse({ status: 200, description: 'Business information' })
  getBusinessInfo(@GetUserId() userId: string) {
    return this.managementService.getBusinessInfo(userId);
  }

  @Patch('business-info/hours')
  @ApiOperation({ summary: 'Update business hours' })
  @ApiResponse({ status: 200, description: 'Hours updated' })
  updateBusinessHours(
    @GetUserId() userId: string,
    @Body() dto: UpdateBusinessHoursDto,
  ) {
    return this.managementService.updateBusinessHours(userId, dto);
  }

  @Patch('business-info/description')
  @ApiOperation({ summary: 'Update business description' })
  @ApiResponse({ status: 200, description: 'Description updated' })
  updateBusinessDescription(
    @GetUserId() userId: string,
    @Body() dto: UpdateBusinessDescriptionDto,
  ) {
    return this.managementService.updateBusinessDescription(userId, dto.description);
  }

  @Patch('business-info/phone')
  @ApiOperation({ summary: 'Update business phone number' })
  @ApiResponse({ status: 200, description: 'Phone updated' })
  updateBusinessPhone(
    @GetUserId() userId: string,
    @Body() dto: UpdateBusinessPhoneDto,
  ) {
    return this.managementService.updateBusinessPhone(userId, dto.primaryPhone);
  }

  @Patch('business-info/website')
  @ApiOperation({ summary: 'Update business website' })
  @ApiResponse({ status: 200, description: 'Website updated' })
  updateBusinessWebsite(
    @GetUserId() userId: string,
    @Body() dto: UpdateBusinessWebsiteDto,
  ) {
    return this.managementService.updateBusinessWebsite(userId, dto.websiteUri);
  }
}
