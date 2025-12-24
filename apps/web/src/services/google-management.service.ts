/**
 * Google Business Management Service
 *
 * Serviço para gestão completa do Google Meu Negócio:
 * - Avaliações (ler, responder, deletar resposta)
 * - Posts (criar, listar, editar, deletar)
 * - Fotos (upload, listar, deletar)
 * - Perguntas e Respostas
 * - Informações do negócio
 */

import api, { getErrorMessage } from './api';

// =============================================================================
// Types - Reviews
// =============================================================================

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

// =============================================================================
// Types - Posts
// =============================================================================

export type LocalPostTopicType = 'STANDARD' | 'EVENT' | 'OFFER' | 'ALERT';
export type LocalPostState = 'LOCAL_POST_STATE_UNSPECIFIED' | 'REJECTED' | 'LIVE' | 'PROCESSING';
export type CallToActionType = 'BOOK' | 'ORDER' | 'SHOP' | 'LEARN_MORE' | 'SIGN_UP' | 'CALL';

export interface LocalPost {
  name?: string;
  languageCode?: string;
  summary: string;
  callToAction?: {
    actionType: CallToActionType;
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

export interface CreatePostInput {
  summary: string;
  topicType?: LocalPostTopicType;
  callToAction?: {
    actionType: CallToActionType;
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

// =============================================================================
// Types - Media/Photos
// =============================================================================

export type MediaFormat = 'PHOTO' | 'VIDEO';
export type MediaCategory =
  | 'COVER'
  | 'PROFILE'
  | 'LOGO'
  | 'EXTERIOR'
  | 'INTERIOR'
  | 'PRODUCT'
  | 'AT_WORK'
  | 'FOOD_AND_DRINK'
  | 'MENU'
  | 'TEAMS'
  | 'ADDITIONAL';

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

export interface CreateMediaInput {
  mediaFormat: MediaFormat;
  sourceUrl: string;
  description?: string;
  category?: MediaCategory;
}

// =============================================================================
// Types - Q&A
// =============================================================================

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

// =============================================================================
// Types - Business Information
// =============================================================================

export interface BusinessHoursPeriod {
  openDay: string;
  openTime: string;
  closeDay: string;
  closeTime: string;
}

export interface BusinessHours {
  periods: BusinessHoursPeriod[];
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
  profile?: {
    description?: string;
  };
  openInfo?: {
    status: 'OPEN' | 'CLOSED_PERMANENTLY' | 'CLOSED_TEMPORARILY';
  };
  metadata?: {
    mapsUri?: string;
    newReviewUri?: string;
  };
}

// =============================================================================
// Reviews API
// =============================================================================

export async function listReviews(pageToken?: string): Promise<ReviewsListResponse> {
  const params = pageToken ? { pageToken } : undefined;
  const response = await api.get('/google-business/manage/reviews', { params });
  return response.data;
}

export async function getReview(reviewId: string): Promise<GoogleReview> {
  const response = await api.get(`/google-business/manage/reviews/${reviewId}`);
  return response.data;
}

export async function replyToReview(reviewId: string, comment: string): Promise<void> {
  await api.put(`/google-business/manage/reviews/${reviewId}/reply`, { comment });
}

export async function deleteReviewReply(reviewId: string): Promise<void> {
  await api.delete(`/google-business/manage/reviews/${reviewId}/reply`);
}

// =============================================================================
// Posts API
// =============================================================================

export async function listPosts(pageToken?: string): Promise<PostsListResponse> {
  const params = pageToken ? { pageToken } : undefined;
  const response = await api.get('/google-business/manage/posts', { params });
  return response.data;
}

export async function createPost(post: CreatePostInput): Promise<LocalPost> {
  const response = await api.post('/google-business/manage/posts', post);
  return response.data;
}

export async function updatePost(postName: string, post: Partial<CreatePostInput>): Promise<LocalPost> {
  const response = await api.patch(`/google-business/manage/posts/${encodeURIComponent(postName)}`, post);
  return response.data;
}

export async function deletePost(postName: string): Promise<void> {
  await api.delete(`/google-business/manage/posts/${encodeURIComponent(postName)}`);
}

// =============================================================================
// Media/Photos API
// =============================================================================

export async function listMedia(pageToken?: string): Promise<MediaListResponse> {
  const params = pageToken ? { pageToken } : undefined;
  const response = await api.get('/google-business/manage/media', { params });
  return response.data;
}

export async function uploadMedia(media: CreateMediaInput): Promise<MediaItem> {
  const response = await api.post('/google-business/manage/media', media);
  return response.data;
}

export async function deleteMedia(mediaName: string): Promise<void> {
  await api.delete(`/google-business/manage/media/${encodeURIComponent(mediaName)}`);
}

// =============================================================================
// Q&A API
// =============================================================================

export async function listQuestions(pageToken?: string): Promise<QuestionsListResponse> {
  const params = pageToken ? { pageToken } : undefined;
  const response = await api.get('/google-business/manage/questions', { params });
  return response.data;
}

export async function answerQuestion(questionName: string, text: string): Promise<Answer> {
  const response = await api.post(
    `/google-business/manage/questions/${encodeURIComponent(questionName)}/answer`,
    { text }
  );
  return response.data;
}

export async function deleteAnswer(answerName: string): Promise<void> {
  await api.delete(`/google-business/manage/answers/${encodeURIComponent(answerName)}`);
}

// =============================================================================
// Business Information API
// =============================================================================

export async function getBusinessInfo(): Promise<BusinessInfo> {
  const response = await api.get('/google-business/manage/business-info');
  return response.data;
}

export async function updateBusinessHours(hours: BusinessHours): Promise<BusinessInfo> {
  const response = await api.patch('/google-business/manage/business-info/hours', hours);
  return response.data;
}

export async function updateBusinessDescription(description: string): Promise<BusinessInfo> {
  const response = await api.patch('/google-business/manage/business-info/description', { description });
  return response.data;
}

export async function updateBusinessPhone(primaryPhone: string): Promise<BusinessInfo> {
  const response = await api.patch('/google-business/manage/business-info/phone', { primaryPhone });
  return response.data;
}

export async function updateBusinessWebsite(websiteUri: string): Promise<BusinessInfo> {
  const response = await api.patch('/google-business/manage/business-info/website', { websiteUri });
  return response.data;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert star rating string to number
 */
export function starRatingToNumber(rating: GoogleReview['starRating']): number {
  const map: Record<string, number> = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
  };
  return map[rating] || 0;
}

/**
 * Format relative date
 */
export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `${diffDays} dias atrás`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} semanas atrás`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} meses atrás`;
  return `${Math.floor(diffDays / 365)} anos atrás`;
}

// =============================================================================
// Export as service object
// =============================================================================

export const googleManagementService = {
  // Reviews
  listReviews,
  getReview,
  replyToReview,
  deleteReviewReply,
  // Posts
  listPosts,
  createPost,
  updatePost,
  deletePost,
  // Media
  listMedia,
  uploadMedia,
  deleteMedia,
  // Q&A
  listQuestions,
  answerQuestion,
  deleteAnswer,
  // Business Info
  getBusinessInfo,
  updateBusinessHours,
  updateBusinessDescription,
  updateBusinessPhone,
  updateBusinessWebsite,
  // Helpers
  starRatingToNumber,
  formatRelativeDate,
};

export default googleManagementService;
