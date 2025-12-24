import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GoogleManagementService } from './google-management.service';
import { GoogleOAuthService } from './google-oauth.service';
import { PrismaService } from '../prisma/prisma.service';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('GoogleManagementService', () => {
  let service: GoogleManagementService;
  let prismaService: PrismaService;
  let googleOAuthService: GoogleOAuthService;

  const mockUserId = 'user-123';
  const mockAccessToken = 'mock-access-token';
  const mockLocationId = 'accounts/123456/locations/789012';

  const mockIntegration = {
    id: 'integration-123',
    userId: mockUserId,
    googleAccountId: 'account-123',
    googleLocationId: mockLocationId,
    googleLocationName: 'My Business',
    status: 'CONNECTED',
  };

  const mockPrismaService = {
    googleIntegration: {
      findUnique: jest.fn(),
    },
  };

  const mockGoogleOAuthService = {
    getValidAccessToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleManagementService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: GoogleOAuthService,
          useValue: mockGoogleOAuthService,
        },
      ],
    }).compile();

    service = module.get<GoogleManagementService>(GoogleManagementService);
    prismaService = module.get<PrismaService>(PrismaService);
    googleOAuthService = module.get<GoogleOAuthService>(GoogleOAuthService);

    // Default mocks
    mockGoogleOAuthService.getValidAccessToken.mockResolvedValue(mockAccessToken);
    mockPrismaService.googleIntegration.findUnique.mockResolvedValue(mockIntegration);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Reviews Tests
  // ==========================================================================

  describe('listReviews', () => {
    const mockReviewsResponse = {
      reviews: [
        {
          reviewId: 'review-1',
          reviewer: { displayName: 'John Doe' },
          starRating: 'FIVE',
          comment: 'Great service!',
          createTime: '2024-01-15T10:00:00Z',
        },
        {
          reviewId: 'review-2',
          reviewer: { displayName: 'Jane Smith' },
          starRating: 'FOUR',
          comment: 'Good experience',
          createTime: '2024-01-14T15:00:00Z',
        },
      ],
      averageRating: 4.5,
      totalReviewCount: 2,
    };

    it('should list reviews successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockReviewsResponse),
      });

      const result = await service.listReviews(mockUserId);

      expect(result.reviews).toHaveLength(2);
      expect(result.averageRating).toBe(4.5);
      expect(result.totalReviewCount).toBe(2);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/reviews'),
        expect.objectContaining({
          headers: { Authorization: `Bearer ${mockAccessToken}` },
        }),
      );
    });

    it('should pass pageToken when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockReviewsResponse, nextPageToken: 'next-token' }),
      });

      await service.listReviews(mockUserId, 'page-token');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('pageToken=page-token'),
        expect.any(Object),
      );
    });

    it('should throw BadRequestException when API fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('API Error'),
      });

      await expect(service.listReviews(mockUserId)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when location not configured', async () => {
      mockPrismaService.googleIntegration.findUnique.mockResolvedValueOnce(null);

      await expect(service.listReviews(mockUserId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getReview', () => {
    const mockReview = {
      reviewId: 'review-1',
      reviewer: { displayName: 'John Doe' },
      starRating: 'FIVE',
      comment: 'Great!',
    };

    it('should get a specific review', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockReview),
      });

      const result = await service.getReview(mockUserId, 'review-1');

      expect(result.reviewId).toBe('review-1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/reviews/review-1'),
        expect.any(Object),
      );
    });

    it('should throw NotFoundException when review not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('Not found'),
      });

      await expect(service.getReview(mockUserId, 'invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('replyToReview', () => {
    it('should reply to a review successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await service.replyToReview(mockUserId, 'review-1', 'Thank you for your feedback!');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/reviews/review-1/reply'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ comment: 'Thank you for your feedback!' }),
        }),
      );
    });

    it('should throw BadRequestException on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('Error'),
      });

      await expect(
        service.replyToReview(mockUserId, 'review-1', 'Reply'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteReviewReply', () => {
    it('should delete a review reply successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      await service.deleteReviewReply(mockUserId, 'review-1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/reviews/review-1/reply'),
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });
  });

  // ==========================================================================
  // Posts Tests
  // ==========================================================================

  describe('listPosts', () => {
    const mockPostsResponse = {
      localPosts: [
        {
          name: 'accounts/123/locations/456/localPosts/post-1',
          summary: 'Check out our new products!',
          topicType: 'STANDARD',
          state: 'LIVE',
        },
      ],
    };

    it('should list posts successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPostsResponse),
      });

      const result = await service.listPosts(mockUserId);

      expect(result.localPosts).toHaveLength(1);
      expect(result.localPosts[0].summary).toBe('Check out our new products!');
    });

    it('should return empty array when no posts', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await service.listPosts(mockUserId);

      expect(result.localPosts).toEqual([]);
    });
  });

  describe('createPost', () => {
    const newPost = {
      summary: 'New post content',
      topicType: 'STANDARD' as const,
    };

    it('should create a post successfully', async () => {
      const createdPost = { ...newPost, name: 'posts/new-post-id' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createdPost),
      });

      const result = await service.createPost(mockUserId, newPost);

      expect(result.name).toBe('posts/new-post-id');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/localPosts'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(newPost),
        }),
      );
    });

    it('should throw BadRequestException on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('Error creating post'),
      });

      await expect(service.createPost(mockUserId, newPost)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updatePost', () => {
    it('should update a post successfully', async () => {
      const updates = { summary: 'Updated content' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...updates, name: 'post-1' }),
      });

      const result = await service.updatePost(mockUserId, 'post-1', updates);

      expect(result.summary).toBe('Updated content');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('post-1'),
        expect.objectContaining({
          method: 'PATCH',
        }),
      );
    });
  });

  describe('deletePost', () => {
    it('should delete a post successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      await service.deletePost(mockUserId, 'post-1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('post-1'),
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });
  });

  // ==========================================================================
  // Media Tests
  // ==========================================================================

  describe('listMedia', () => {
    const mockMediaResponse = {
      mediaItems: [
        {
          name: 'media-1',
          mediaFormat: 'PHOTO',
          sourceUrl: 'https://example.com/photo.jpg',
        },
      ],
      totalMediaItemCount: 1,
    };

    it('should list media successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMediaResponse),
      });

      const result = await service.listMedia(mockUserId);

      expect(result.mediaItems).toHaveLength(1);
      expect(result.totalMediaItemCount).toBe(1);
    });
  });

  describe('createMedia', () => {
    const newMedia = {
      mediaFormat: 'PHOTO' as const,
      sourceUrl: 'https://example.com/new-photo.jpg',
    };

    it('should upload media successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...newMedia, name: 'media/new-id' }),
      });

      const result = await service.createMedia(mockUserId, newMedia);

      expect(result.name).toBe('media/new-id');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/media'),
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });
  });

  describe('deleteMedia', () => {
    it('should delete media successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      await service.deleteMedia(mockUserId, 'media-1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('media-1'),
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });
  });

  // ==========================================================================
  // Q&A Tests
  // ==========================================================================

  describe('listQuestions', () => {
    const mockQuestionsResponse = {
      questions: [
        {
          name: 'question-1',
          author: { displayName: 'Customer' },
          text: 'Do you offer delivery?',
          createTime: '2024-01-15T10:00:00Z',
          upvoteCount: 5,
          totalAnswerCount: 1,
        },
      ],
      totalSize: 1,
    };

    it('should list questions successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockQuestionsResponse),
      });

      const result = await service.listQuestions(mockUserId);

      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].text).toBe('Do you offer delivery?');
    });
  });

  describe('answerQuestion', () => {
    it('should answer a question successfully', async () => {
      const answer = {
        name: 'answer-1',
        text: 'Yes, we offer free delivery!',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(answer),
      });

      const result = await service.answerQuestion(
        mockUserId,
        'question-1',
        'Yes, we offer free delivery!',
      );

      expect(result.text).toBe('Yes, we offer free delivery!');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/answers:upsert'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ text: 'Yes, we offer free delivery!' }),
        }),
      );
    });
  });

  describe('deleteAnswer', () => {
    it('should delete an answer successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      await service.deleteAnswer(mockUserId, 'answer-1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('answer-1'),
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });
  });

  // ==========================================================================
  // Business Info Tests
  // ==========================================================================

  describe('getBusinessInfo', () => {
    const mockBusinessInfo = {
      name: mockLocationId,
      title: 'My Business',
      phoneNumbers: { primaryPhone: '+5511999999999' },
      websiteUri: 'https://mybusiness.com',
      profile: { description: 'A great business' },
    };

    it('should get business info successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBusinessInfo),
      });

      const result = await service.getBusinessInfo(mockUserId);

      expect(result.title).toBe('My Business');
      expect(result.phoneNumbers?.primaryPhone).toBe('+5511999999999');
    });

    it('should throw BadRequestException on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('Error'),
      });

      await expect(service.getBusinessInfo(mockUserId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateBusinessHours', () => {
    const hours = {
      periods: [
        { openDay: 'MONDAY', openTime: '09:00', closeDay: 'MONDAY', closeTime: '18:00' },
      ],
    };

    it('should update business hours successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ regularHours: hours }),
      });

      const result = await service.updateBusinessHours(mockUserId, hours);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('updateMask=regularHours'),
        expect.objectContaining({
          method: 'PATCH',
        }),
      );
    });
  });

  describe('updateBusinessDescription', () => {
    it('should update business description successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ profile: { description: 'New description' } }),
      });

      await service.updateBusinessDescription(mockUserId, 'New description');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('profile.description'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ profile: { description: 'New description' } }),
        }),
      );
    });
  });

  describe('updateBusinessPhone', () => {
    it('should update business phone successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ phoneNumbers: { primaryPhone: '+5511888888888' } }),
      });

      await service.updateBusinessPhone(mockUserId, '+5511888888888');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('phoneNumbers.primaryPhone'),
        expect.any(Object),
      );
    });
  });

  describe('updateBusinessWebsite', () => {
    it('should update business website successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ websiteUri: 'https://newsite.com' }),
      });

      await service.updateBusinessWebsite(mockUserId, 'https://newsite.com');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('websiteUri'),
        expect.objectContaining({
          body: JSON.stringify({ websiteUri: 'https://newsite.com' }),
        }),
      );
    });
  });
});
