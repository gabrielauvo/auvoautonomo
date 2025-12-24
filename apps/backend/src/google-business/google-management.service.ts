import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleOAuthService } from './google-oauth.service';

// Google My Business API v4 URL (legacy but still works for reviews/posts)
const GOOGLE_MY_BUSINESS_API_V4 = 'https://mybusiness.googleapis.com/v4';

// Google Business Profile API v1 (newer)
const GOOGLE_BUSINESS_API_V1 = 'https://mybusinessbusinessinformation.googleapis.com/v1';

// ============================================================================
// Types - Reviews
// ============================================================================

export interface GoogleReview {
  reviewId: string;
  reviewer: {
    displayName: string;
    profilePhotoUrl?: string;
    isAnonymous: boolean;
  };
  starRating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE';
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: {
    comment: string;
    updateTime: string;
  };
}

export interface ReviewsListResponse {
  reviews: GoogleReview[];
  averageRating: number;
  totalReviewCount: number;
  nextPageToken?: string;
}

// ============================================================================
// Types - Posts
// ============================================================================

export type LocalPostTopicType = 'STANDARD' | 'EVENT' | 'OFFER' | 'ALERT';
export type LocalPostState = 'LOCAL_POST_STATE_UNSPECIFIED' | 'REJECTED' | 'LIVE' | 'PROCESSING';

export interface LocalPost {
  name?: string;
  languageCode?: string;
  summary: string;
  callToAction?: {
    actionType: 'ACTION_TYPE_UNSPECIFIED' | 'BOOK' | 'ORDER' | 'SHOP' | 'LEARN_MORE' | 'SIGN_UP' | 'CALL';
    url?: string;
  };
  media?: Array<{
    mediaFormat: 'PHOTO' | 'VIDEO';
    sourceUrl: string;
  }>;
  topicType?: LocalPostTopicType;
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
  state?: LocalPostState;
  createTime?: string;
  updateTime?: string;
  searchUrl?: string;
}

export interface PostsListResponse {
  localPosts: LocalPost[];
  nextPageToken?: string;
}

// ============================================================================
// Types - Media/Photos
// ============================================================================

export type MediaFormat = 'PHOTO' | 'VIDEO';
export type MediaCategory = 'CATEGORY_UNSPECIFIED' | 'COVER' | 'PROFILE' | 'LOGO' | 'EXTERIOR' | 'INTERIOR' | 'PRODUCT' | 'AT_WORK' | 'FOOD_AND_DRINK' | 'MENU' | 'COMMON_AREA' | 'ROOMS' | 'TEAMS' | 'ADDITIONAL';

export interface MediaItem {
  name?: string;
  mediaFormat: MediaFormat;
  sourceUrl: string;
  description?: string;
  category?: MediaCategory;
  googleUrl?: string;
  thumbnailUrl?: string;
  createTime?: string;
  dimensions?: {
    widthPixels: number;
    heightPixels: number;
  };
  insights?: {
    viewCount: string;
  };
}

export interface MediaListResponse {
  mediaItems: MediaItem[];
  totalMediaItemCount: number;
  nextPageToken?: string;
}

// ============================================================================
// Types - Q&A
// ============================================================================

export interface Question {
  name?: string;
  author: {
    displayName: string;
    profilePhotoUrl?: string;
    type: 'AUTHOR_TYPE_UNSPECIFIED' | 'REGULAR_USER' | 'LOCAL_GUIDE' | 'MERCHANT';
  };
  text: string;
  createTime: string;
  updateTime: string;
  upvoteCount: number;
  totalAnswerCount: number;
  topAnswers?: Answer[];
}

export interface Answer {
  name?: string;
  author: {
    displayName: string;
    profilePhotoUrl?: string;
    type: 'AUTHOR_TYPE_UNSPECIFIED' | 'REGULAR_USER' | 'LOCAL_GUIDE' | 'MERCHANT';
  };
  text: string;
  createTime: string;
  updateTime: string;
  upvoteCount: number;
}

export interface QuestionsListResponse {
  questions: Question[];
  totalSize: number;
  nextPageToken?: string;
}

// ============================================================================
// Types - Business Information
// ============================================================================

export interface BusinessHours {
  periods: Array<{
    openDay: string;
    openTime: string;
    closeDay: string;
    closeTime: string;
  }>;
}

export interface BusinessInfo {
  name: string;
  title: string;
  phoneNumbers?: {
    primaryPhone?: string;
    additionalPhones?: string[];
  };
  categories?: {
    primaryCategory?: {
      displayName: string;
      categoryId: string;
    };
    additionalCategories?: Array<{
      displayName: string;
      categoryId: string;
    }>;
  };
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
    regionCode?: string;
  };
  websiteUri?: string;
  regularHours?: BusinessHours;
  specialHours?: {
    specialHourPeriods: Array<{
      startDate: { year: number; month: number; day: number };
      openTime?: string;
      closeTime?: string;
      isClosed?: boolean;
    }>;
  };
  profile?: {
    description?: string;
  };
  openInfo?: {
    status: 'OPEN' | 'CLOSED_PERMANENTLY' | 'CLOSED_TEMPORARILY';
    canReopen?: boolean;
    openingDate?: { year: number; month: number; day: number };
  };
  metadata?: {
    mapsUri?: string;
    newReviewUri?: string;
  };
}

// ============================================================================
// Service
// ============================================================================

@Injectable()
export class GoogleManagementService {
  private readonly logger = new Logger(GoogleManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleOAuthService: GoogleOAuthService,
  ) {}

  /**
   * Get the account name and location ID for API calls
   */
  private async getLocationInfo(userId: string): Promise<{ accountName: string; locationName: string }> {
    const integration = await this.prisma.googleIntegration.findUnique({
      where: { userId },
    });

    if (!integration?.googleLocationId) {
      throw new NotFoundException('Google location not configured');
    }

    // The locationId stored is the full resource name like "accounts/123/locations/456"
    const locationName = integration.googleLocationId;
    const accountName = locationName.split('/locations/')[0];

    return { accountName, locationName };
  }

  // ==========================================================================
  // Reviews Management
  // ==========================================================================

  /**
   * List all reviews for the location
   */
  async listReviews(userId: string, pageToken?: string): Promise<ReviewsListResponse> {
    const accessToken = await this.googleOAuthService.getValidAccessToken(userId);
    const { accountName, locationName } = await this.getLocationInfo(userId);

    const params = new URLSearchParams();
    if (pageToken) params.set('pageToken', pageToken);
    params.set('pageSize', '50');

    const response = await fetch(
      `${GOOGLE_MY_BUSINESS_API_V4}/${locationName}/reviews?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Failed to list reviews: ${error}`);
      throw new BadRequestException('Failed to list reviews');
    }

    const data = await response.json();

    return {
      reviews: data.reviews || [],
      averageRating: data.averageRating || 0,
      totalReviewCount: data.totalReviewCount || 0,
      nextPageToken: data.nextPageToken,
    };
  }

  /**
   * Get a specific review
   */
  async getReview(userId: string, reviewId: string): Promise<GoogleReview> {
    const accessToken = await this.googleOAuthService.getValidAccessToken(userId);
    const { locationName } = await this.getLocationInfo(userId);

    const response = await fetch(
      `${GOOGLE_MY_BUSINESS_API_V4}/${locationName}/reviews/${reviewId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Failed to get review: ${error}`);
      throw new NotFoundException('Review not found');
    }

    return response.json();
  }

  /**
   * Reply to a review
   */
  async replyToReview(userId: string, reviewId: string, comment: string): Promise<void> {
    const accessToken = await this.googleOAuthService.getValidAccessToken(userId);
    const { locationName } = await this.getLocationInfo(userId);

    const response = await fetch(
      `${GOOGLE_MY_BUSINESS_API_V4}/${locationName}/reviews/${reviewId}/reply`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comment }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Failed to reply to review: ${error}`);
      throw new BadRequestException('Failed to reply to review');
    }

    this.logger.log(`Replied to review ${reviewId} for user ${userId}`);
  }

  /**
   * Delete a review reply
   */
  async deleteReviewReply(userId: string, reviewId: string): Promise<void> {
    const accessToken = await this.googleOAuthService.getValidAccessToken(userId);
    const { locationName } = await this.getLocationInfo(userId);

    const response = await fetch(
      `${GOOGLE_MY_BUSINESS_API_V4}/${locationName}/reviews/${reviewId}/reply`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Failed to delete review reply: ${error}`);
      throw new BadRequestException('Failed to delete review reply');
    }

    this.logger.log(`Deleted reply for review ${reviewId} for user ${userId}`);
  }

  // ==========================================================================
  // Posts Management
  // ==========================================================================

  /**
   * List all posts for the location
   */
  async listPosts(userId: string, pageToken?: string): Promise<PostsListResponse> {
    const accessToken = await this.googleOAuthService.getValidAccessToken(userId);
    const { locationName } = await this.getLocationInfo(userId);

    const params = new URLSearchParams();
    if (pageToken) params.set('pageToken', pageToken);
    params.set('pageSize', '50');

    const response = await fetch(
      `${GOOGLE_MY_BUSINESS_API_V4}/${locationName}/localPosts?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Failed to list posts: ${error}`);
      throw new BadRequestException('Failed to list posts');
    }

    const data = await response.json();

    return {
      localPosts: data.localPosts || [],
      nextPageToken: data.nextPageToken,
    };
  }

  /**
   * Create a new post
   */
  async createPost(userId: string, post: Partial<LocalPost>): Promise<LocalPost> {
    const accessToken = await this.googleOAuthService.getValidAccessToken(userId);
    const { locationName } = await this.getLocationInfo(userId);

    const response = await fetch(
      `${GOOGLE_MY_BUSINESS_API_V4}/${locationName}/localPosts`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(post),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Failed to create post: ${error}`);
      throw new BadRequestException('Failed to create post');
    }

    const createdPost = await response.json();
    this.logger.log(`Created post for user ${userId}`);
    return createdPost;
  }

  /**
   * Update an existing post
   */
  async updatePost(userId: string, postName: string, post: Partial<LocalPost>): Promise<LocalPost> {
    const accessToken = await this.googleOAuthService.getValidAccessToken(userId);

    const response = await fetch(
      `${GOOGLE_MY_BUSINESS_API_V4}/${postName}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(post),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Failed to update post: ${error}`);
      throw new BadRequestException('Failed to update post');
    }

    const updatedPost = await response.json();
    this.logger.log(`Updated post ${postName} for user ${userId}`);
    return updatedPost;
  }

  /**
   * Delete a post
   */
  async deletePost(userId: string, postName: string): Promise<void> {
    const accessToken = await this.googleOAuthService.getValidAccessToken(userId);

    const response = await fetch(
      `${GOOGLE_MY_BUSINESS_API_V4}/${postName}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Failed to delete post: ${error}`);
      throw new BadRequestException('Failed to delete post');
    }

    this.logger.log(`Deleted post ${postName} for user ${userId}`);
  }

  // ==========================================================================
  // Media/Photos Management
  // ==========================================================================

  /**
   * List all media items for the location
   */
  async listMedia(userId: string, pageToken?: string): Promise<MediaListResponse> {
    const accessToken = await this.googleOAuthService.getValidAccessToken(userId);
    const { locationName } = await this.getLocationInfo(userId);

    const params = new URLSearchParams();
    if (pageToken) params.set('pageToken', pageToken);
    params.set('pageSize', '50');

    const response = await fetch(
      `${GOOGLE_MY_BUSINESS_API_V4}/${locationName}/media?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Failed to list media: ${error}`);
      throw new BadRequestException('Failed to list media');
    }

    const data = await response.json();

    return {
      mediaItems: data.mediaItems || [],
      totalMediaItemCount: data.totalMediaItemCount || 0,
      nextPageToken: data.nextPageToken,
    };
  }

  /**
   * Upload a new photo
   */
  async createMedia(userId: string, media: Partial<MediaItem>): Promise<MediaItem> {
    const accessToken = await this.googleOAuthService.getValidAccessToken(userId);
    const { locationName } = await this.getLocationInfo(userId);

    const response = await fetch(
      `${GOOGLE_MY_BUSINESS_API_V4}/${locationName}/media`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(media),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Failed to create media: ${error}`);
      throw new BadRequestException('Failed to upload photo');
    }

    const createdMedia = await response.json();
    this.logger.log(`Uploaded media for user ${userId}`);
    return createdMedia;
  }

  /**
   * Delete a media item
   */
  async deleteMedia(userId: string, mediaName: string): Promise<void> {
    const accessToken = await this.googleOAuthService.getValidAccessToken(userId);

    const response = await fetch(
      `${GOOGLE_MY_BUSINESS_API_V4}/${mediaName}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Failed to delete media: ${error}`);
      throw new BadRequestException('Failed to delete photo');
    }

    this.logger.log(`Deleted media ${mediaName} for user ${userId}`);
  }

  // ==========================================================================
  // Q&A Management
  // ==========================================================================

  /**
   * List all questions for the location
   */
  async listQuestions(userId: string, pageToken?: string): Promise<QuestionsListResponse> {
    const accessToken = await this.googleOAuthService.getValidAccessToken(userId);
    const { locationName } = await this.getLocationInfo(userId);

    const params = new URLSearchParams();
    if (pageToken) params.set('pageToken', pageToken);
    params.set('pageSize', '50');
    params.set('answersPerQuestion', '5');

    const response = await fetch(
      `${GOOGLE_MY_BUSINESS_API_V4}/${locationName}/questions?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Failed to list questions: ${error}`);
      throw new BadRequestException('Failed to list questions');
    }

    const data = await response.json();

    return {
      questions: data.questions || [],
      totalSize: data.totalSize || 0,
      nextPageToken: data.nextPageToken,
    };
  }

  /**
   * Answer a question
   */
  async answerQuestion(userId: string, questionName: string, answerText: string): Promise<Answer> {
    const accessToken = await this.googleOAuthService.getValidAccessToken(userId);

    const response = await fetch(
      `${GOOGLE_MY_BUSINESS_API_V4}/${questionName}/answers:upsert`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: answerText }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Failed to answer question: ${error}`);
      throw new BadRequestException('Failed to answer question');
    }

    const answer = await response.json();
    this.logger.log(`Answered question ${questionName} for user ${userId}`);
    return answer;
  }

  /**
   * Delete an answer
   */
  async deleteAnswer(userId: string, answerName: string): Promise<void> {
    const accessToken = await this.googleOAuthService.getValidAccessToken(userId);

    const response = await fetch(
      `${GOOGLE_MY_BUSINESS_API_V4}/${answerName}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Failed to delete answer: ${error}`);
      throw new BadRequestException('Failed to delete answer');
    }

    this.logger.log(`Deleted answer ${answerName} for user ${userId}`);
  }

  // ==========================================================================
  // Business Information Management
  // ==========================================================================

  /**
   * Get business information
   */
  async getBusinessInfo(userId: string): Promise<BusinessInfo> {
    const accessToken = await this.googleOAuthService.getValidAccessToken(userId);
    const { locationName } = await this.getLocationInfo(userId);

    // Use the v1 API for business info
    const response = await fetch(
      `${GOOGLE_BUSINESS_API_V1}/${locationName}?readMask=*`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Failed to get business info: ${error}`);
      throw new BadRequestException('Failed to get business information');
    }

    return response.json();
  }

  /**
   * Update business information
   */
  async updateBusinessInfo(
    userId: string,
    updates: Partial<BusinessInfo>,
    updateMask: string[],
  ): Promise<BusinessInfo> {
    const accessToken = await this.googleOAuthService.getValidAccessToken(userId);
    const { locationName } = await this.getLocationInfo(userId);

    const response = await fetch(
      `${GOOGLE_BUSINESS_API_V1}/${locationName}?updateMask=${updateMask.join(',')}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Failed to update business info: ${error}`);
      throw new BadRequestException('Failed to update business information');
    }

    const updatedInfo = await response.json();
    this.logger.log(`Updated business info for user ${userId}`);
    return updatedInfo;
  }

  /**
   * Update business hours
   */
  async updateBusinessHours(userId: string, hours: BusinessHours): Promise<BusinessInfo> {
    return this.updateBusinessInfo(userId, { regularHours: hours }, ['regularHours']);
  }

  /**
   * Update business description
   */
  async updateBusinessDescription(userId: string, description: string): Promise<BusinessInfo> {
    return this.updateBusinessInfo(userId, { profile: { description } }, ['profile.description']);
  }

  /**
   * Update business phone number
   */
  async updateBusinessPhone(userId: string, primaryPhone: string): Promise<BusinessInfo> {
    return this.updateBusinessInfo(
      userId,
      { phoneNumbers: { primaryPhone } },
      ['phoneNumbers.primaryPhone'],
    );
  }

  /**
   * Update business website
   */
  async updateBusinessWebsite(userId: string, websiteUri: string): Promise<BusinessInfo> {
    return this.updateBusinessInfo(userId, { websiteUri }, ['websiteUri']);
  }
}
