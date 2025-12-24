/**
 * Google Business Management Hooks
 *
 * React Query hooks para gestão do Google Meu Negócio
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import {
  googleManagementService,
  CreatePostInput,
  CreateMediaInput,
  BusinessHours,
} from '@/services/google-management.service';

// =============================================================================
// Query Keys
// =============================================================================

export const GOOGLE_MANAGEMENT_KEYS = {
  all: ['google-management'] as const,
  reviews: () => [...GOOGLE_MANAGEMENT_KEYS.all, 'reviews'] as const,
  reviewsList: () => [...GOOGLE_MANAGEMENT_KEYS.reviews(), 'list'] as const,
  review: (id: string) => [...GOOGLE_MANAGEMENT_KEYS.reviews(), id] as const,
  posts: () => [...GOOGLE_MANAGEMENT_KEYS.all, 'posts'] as const,
  postsList: () => [...GOOGLE_MANAGEMENT_KEYS.posts(), 'list'] as const,
  media: () => [...GOOGLE_MANAGEMENT_KEYS.all, 'media'] as const,
  mediaList: () => [...GOOGLE_MANAGEMENT_KEYS.media(), 'list'] as const,
  questions: () => [...GOOGLE_MANAGEMENT_KEYS.all, 'questions'] as const,
  questionsList: () => [...GOOGLE_MANAGEMENT_KEYS.questions(), 'list'] as const,
  businessInfo: () => [...GOOGLE_MANAGEMENT_KEYS.all, 'business-info'] as const,
};

// =============================================================================
// Reviews Hooks
// =============================================================================

export function useReviews() {
  return useInfiniteQuery({
    queryKey: GOOGLE_MANAGEMENT_KEYS.reviewsList(),
    queryFn: ({ pageParam }) => googleManagementService.listReviews(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextPageToken,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useReview(reviewId: string, enabled = true) {
  return useQuery({
    queryKey: GOOGLE_MANAGEMENT_KEYS.review(reviewId),
    queryFn: () => googleManagementService.getReview(reviewId),
    enabled: enabled && !!reviewId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useReplyToReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reviewId, comment }: { reviewId: string; comment: string }) =>
      googleManagementService.replyToReview(reviewId, comment),
    onSuccess: (_, { reviewId }) => {
      queryClient.invalidateQueries({ queryKey: GOOGLE_MANAGEMENT_KEYS.reviewsList() });
      queryClient.invalidateQueries({ queryKey: GOOGLE_MANAGEMENT_KEYS.review(reviewId) });
    },
  });
}

export function useDeleteReviewReply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reviewId: string) => googleManagementService.deleteReviewReply(reviewId),
    onSuccess: (_, reviewId) => {
      queryClient.invalidateQueries({ queryKey: GOOGLE_MANAGEMENT_KEYS.reviewsList() });
      queryClient.invalidateQueries({ queryKey: GOOGLE_MANAGEMENT_KEYS.review(reviewId) });
    },
  });
}

// =============================================================================
// Posts Hooks
// =============================================================================

export function usePosts() {
  return useInfiniteQuery({
    queryKey: GOOGLE_MANAGEMENT_KEYS.postsList(),
    queryFn: ({ pageParam }) => googleManagementService.listPosts(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextPageToken,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (post: CreatePostInput) => googleManagementService.createPost(post),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOOGLE_MANAGEMENT_KEYS.postsList() });
    },
  });
}

export function useUpdatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postName, post }: { postName: string; post: Partial<CreatePostInput> }) =>
      googleManagementService.updatePost(postName, post),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOOGLE_MANAGEMENT_KEYS.postsList() });
    },
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postName: string) => googleManagementService.deletePost(postName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOOGLE_MANAGEMENT_KEYS.postsList() });
    },
  });
}

// =============================================================================
// Media Hooks
// =============================================================================

export function useMedia() {
  return useInfiniteQuery({
    queryKey: GOOGLE_MANAGEMENT_KEYS.mediaList(),
    queryFn: ({ pageParam }) => googleManagementService.listMedia(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextPageToken,
    staleTime: 1000 * 60 * 5,
  });
}

export function useUploadMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (media: CreateMediaInput) => googleManagementService.uploadMedia(media),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOOGLE_MANAGEMENT_KEYS.mediaList() });
    },
  });
}

export function useDeleteMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mediaName: string) => googleManagementService.deleteMedia(mediaName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOOGLE_MANAGEMENT_KEYS.mediaList() });
    },
  });
}

// =============================================================================
// Q&A Hooks
// =============================================================================

export function useQuestions() {
  return useInfiniteQuery({
    queryKey: GOOGLE_MANAGEMENT_KEYS.questionsList(),
    queryFn: ({ pageParam }) => googleManagementService.listQuestions(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextPageToken,
    staleTime: 1000 * 60 * 5,
  });
}

export function useAnswerQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ questionName, text }: { questionName: string; text: string }) =>
      googleManagementService.answerQuestion(questionName, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOOGLE_MANAGEMENT_KEYS.questionsList() });
    },
  });
}

export function useDeleteAnswer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (answerName: string) => googleManagementService.deleteAnswer(answerName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOOGLE_MANAGEMENT_KEYS.questionsList() });
    },
  });
}

// =============================================================================
// Business Info Hooks
// =============================================================================

export function useBusinessInfo(enabled = true) {
  return useQuery({
    queryKey: GOOGLE_MANAGEMENT_KEYS.businessInfo(),
    queryFn: () => googleManagementService.getBusinessInfo(),
    enabled,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function useUpdateBusinessHours() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (hours: BusinessHours) => googleManagementService.updateBusinessHours(hours),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOOGLE_MANAGEMENT_KEYS.businessInfo() });
    },
  });
}

export function useUpdateBusinessDescription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (description: string) => googleManagementService.updateBusinessDescription(description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOOGLE_MANAGEMENT_KEYS.businessInfo() });
    },
  });
}

export function useUpdateBusinessPhone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (phone: string) => googleManagementService.updateBusinessPhone(phone),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOOGLE_MANAGEMENT_KEYS.businessInfo() });
    },
  });
}

export function useUpdateBusinessWebsite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (website: string) => googleManagementService.updateBusinessWebsite(website),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOOGLE_MANAGEMENT_KEYS.businessInfo() });
    },
  });
}
