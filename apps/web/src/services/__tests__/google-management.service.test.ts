import {
  googleManagementService,
} from '../google-management.service';
import api from '../api';

// Mock the api module
jest.mock('../api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
  getErrorMessage: jest.fn((error) => {
    if (error?.response?.data?.message) return error.response.data.message;
    if (error?.message) return error.message;
    return 'Unknown error';
  }),
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe('GoogleManagementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Reviews Tests
  // ==========================================================================

  describe('Reviews', () => {
    describe('listReviews', () => {
      const mockReviewsResponse = {
        reviews: [
          {
            reviewId: 'review-1',
            reviewer: { displayName: 'João Silva' },
            starRating: 'FIVE',
            comment: 'Ótimo serviço!',
            createTime: '2024-01-15T10:00:00Z',
          },
          {
            reviewId: 'review-2',
            reviewer: { displayName: 'Maria Santos' },
            starRating: 'FOUR',
            comment: 'Muito bom',
            createTime: '2024-01-14T15:00:00Z',
          },
        ],
        averageRating: 4.5,
        totalReviewCount: 2,
        nextPageToken: 'next-token',
      };

      it('should list reviews successfully', async () => {
        mockedApi.get.mockResolvedValue({ data: mockReviewsResponse });

        const result = await googleManagementService.listReviews();

        expect(result.reviews).toHaveLength(2);
        expect(result.averageRating).toBe(4.5);
        expect(api.get).toHaveBeenCalledWith('/google-business/manage/reviews', {
          params: undefined,
        });
      });

      it('should pass pageToken when provided', async () => {
        mockedApi.get.mockResolvedValue({ data: mockReviewsResponse });

        await googleManagementService.listReviews('page-token-123');

        expect(api.get).toHaveBeenCalledWith('/google-business/manage/reviews', {
          params: { pageToken: 'page-token-123' },
        });
      });
    });

    describe('getReview', () => {
      it('should get a specific review', async () => {
        const mockReview = {
          reviewId: 'review-1',
          reviewer: { displayName: 'João Silva' },
          starRating: 'FIVE',
          comment: 'Ótimo!',
        };
        mockedApi.get.mockResolvedValue({ data: mockReview });

        const result = await googleManagementService.getReview('review-1');

        expect(result.reviewId).toBe('review-1');
        expect(api.get).toHaveBeenCalledWith('/google-business/manage/reviews/review-1');
      });

      it('should reject when review not found', async () => {
        const error = { response: { data: { message: 'Review not found' } } };
        mockedApi.get.mockRejectedValue(error);

        await expect(googleManagementService.getReview('invalid')).rejects.toEqual(error);
      });
    });

    describe('replyToReview', () => {
      it('should reply to a review', async () => {
        mockedApi.put.mockResolvedValue({ data: {} });

        await googleManagementService.replyToReview('review-1', 'Obrigado pelo feedback!');

        expect(api.put).toHaveBeenCalledWith('/google-business/manage/reviews/review-1/reply', {
          comment: 'Obrigado pelo feedback!',
        });
      });

      it('should reject on failure', async () => {
        const error = { response: { data: { message: 'Failed to reply' } } };
        mockedApi.put.mockRejectedValue(error);

        await expect(
          googleManagementService.replyToReview('review-1', 'Reply'),
        ).rejects.toEqual(error);
      });
    });

    describe('deleteReviewReply', () => {
      it('should delete a review reply', async () => {
        mockedApi.delete.mockResolvedValue({ data: {} });

        await googleManagementService.deleteReviewReply('review-1');

        expect(api.delete).toHaveBeenCalledWith('/google-business/manage/reviews/review-1/reply');
      });
    });
  });

  // ==========================================================================
  // Posts Tests
  // ==========================================================================

  describe('Posts', () => {
    describe('listPosts', () => {
      const mockPostsResponse = {
        localPosts: [
          {
            name: 'post-1',
            summary: 'Novidades da semana!',
            topicType: 'STANDARD',
            state: 'LIVE',
          },
        ],
        nextPageToken: undefined,
      };

      it('should list posts successfully', async () => {
        mockedApi.get.mockResolvedValue({ data: mockPostsResponse });

        const result = await googleManagementService.listPosts();

        expect(result.localPosts).toHaveLength(1);
        expect(api.get).toHaveBeenCalledWith('/google-business/manage/posts', {
          params: undefined,
        });
      });
    });

    describe('createPost', () => {
      const newPost = {
        summary: 'Confira nossa promoção!',
        topicType: 'OFFER' as const,
        offer: {
          couponCode: 'PROMO20',
        },
      };

      it('should create a post successfully', async () => {
        const createdPost = { ...newPost, name: 'post-new' };
        mockedApi.post.mockResolvedValue({ data: createdPost });

        const result = await googleManagementService.createPost(newPost);

        expect(result.name).toBe('post-new');
        expect(api.post).toHaveBeenCalledWith('/google-business/manage/posts', newPost);
      });

      it('should reject on failure', async () => {
        const error = { response: { data: { message: 'Invalid post content' } } };
        mockedApi.post.mockRejectedValue(error);

        await expect(googleManagementService.createPost(newPost)).rejects.toEqual(error);
      });
    });

    describe('updatePost', () => {
      it('should update a post successfully', async () => {
        const updates = { summary: 'Conteúdo atualizado' };
        mockedApi.patch.mockResolvedValue({ data: { ...updates, name: 'post-1' } });

        const result = await googleManagementService.updatePost('post-1', updates);

        expect(result.summary).toBe('Conteúdo atualizado');
        expect(api.patch).toHaveBeenCalledWith('/google-business/manage/posts/post-1', updates);
      });
    });

    describe('deletePost', () => {
      it('should delete a post successfully', async () => {
        mockedApi.delete.mockResolvedValue({ data: {} });

        await googleManagementService.deletePost('post-1');

        expect(api.delete).toHaveBeenCalledWith('/google-business/manage/posts/post-1');
      });
    });
  });

  // ==========================================================================
  // Media Tests
  // ==========================================================================

  describe('Media', () => {
    describe('listMedia', () => {
      const mockMediaResponse = {
        mediaItems: [
          {
            name: 'media-1',
            mediaFormat: 'PHOTO',
            sourceUrl: 'https://example.com/photo.jpg',
            googleUrl: 'https://lh3.google.com/...',
          },
        ],
        totalMediaItemCount: 1,
      };

      it('should list media successfully', async () => {
        mockedApi.get.mockResolvedValue({ data: mockMediaResponse });

        const result = await googleManagementService.listMedia();

        expect(result.mediaItems).toHaveLength(1);
        expect(result.totalMediaItemCount).toBe(1);
      });
    });

    describe('uploadMedia', () => {
      const newMedia = {
        sourceUrl: 'https://example.com/new-photo.jpg',
        mediaFormat: 'PHOTO' as const,
        category: 'INTERIOR' as const,
      };

      it('should upload media successfully', async () => {
        const uploadedMedia = { ...newMedia, name: 'media-new' };
        mockedApi.post.mockResolvedValue({ data: uploadedMedia });

        const result = await googleManagementService.uploadMedia(newMedia);

        expect(result.name).toBe('media-new');
        expect(api.post).toHaveBeenCalledWith('/google-business/manage/media', newMedia);
      });
    });

    describe('deleteMedia', () => {
      it('should delete media successfully', async () => {
        mockedApi.delete.mockResolvedValue({ data: {} });

        await googleManagementService.deleteMedia('media-1');

        expect(api.delete).toHaveBeenCalledWith('/google-business/manage/media/media-1');
      });
    });
  });

  // ==========================================================================
  // Q&A Tests
  // ==========================================================================

  describe('Q&A', () => {
    describe('listQuestions', () => {
      const mockQuestionsResponse = {
        questions: [
          {
            name: 'question-1',
            author: { displayName: 'Cliente', type: 'REGULAR_USER' },
            text: 'Vocês fazem entrega?',
            createTime: '2024-01-15T10:00:00Z',
            upvoteCount: 5,
            totalAnswerCount: 1,
            topAnswers: [
              {
                name: 'answer-1',
                author: { displayName: 'Proprietário', type: 'MERCHANT' },
                text: 'Sim, fazemos entrega gratuita!',
              },
            ],
          },
        ],
        totalSize: 1,
      };

      it('should list questions successfully', async () => {
        mockedApi.get.mockResolvedValue({ data: mockQuestionsResponse });

        const result = await googleManagementService.listQuestions();

        expect(result.questions).toHaveLength(1);
        expect(result.questions[0].totalAnswerCount).toBe(1);
      });
    });

    describe('answerQuestion', () => {
      it('should answer a question successfully', async () => {
        const answer = {
          name: 'answer-new',
          text: 'Sim, trabalhamos aos sábados!',
        };
        mockedApi.post.mockResolvedValue({ data: answer });

        const result = await googleManagementService.answerQuestion(
          'question-1',
          'Sim, trabalhamos aos sábados!',
        );

        expect(result.text).toBe('Sim, trabalhamos aos sábados!');
        expect(api.post).toHaveBeenCalledWith(
          '/google-business/manage/questions/question-1/answer',
          { text: 'Sim, trabalhamos aos sábados!' },
        );
      });
    });

    describe('deleteAnswer', () => {
      it('should delete an answer successfully', async () => {
        mockedApi.delete.mockResolvedValue({ data: {} });

        await googleManagementService.deleteAnswer('answer-1');

        expect(api.delete).toHaveBeenCalledWith('/google-business/manage/answers/answer-1');
      });
    });
  });

  // ==========================================================================
  // Business Info Tests
  // ==========================================================================

  describe('Business Info', () => {
    describe('getBusinessInfo', () => {
      const mockBusinessInfo = {
        name: 'locations/123456',
        title: 'Oficina do João',
        phoneNumbers: { primaryPhone: '+5511999999999' },
        websiteUri: 'https://oficinajoa.com.br',
        profile: { description: 'A melhor oficina da cidade!' },
        regularHours: {
          periods: [
            { openDay: 'MONDAY', openTime: '08:00', closeDay: 'MONDAY', closeTime: '18:00' },
          ],
        },
      };

      it('should get business info successfully', async () => {
        mockedApi.get.mockResolvedValue({ data: mockBusinessInfo });

        const result = await googleManagementService.getBusinessInfo();

        expect(result.title).toBe('Oficina do João');
        expect(result.phoneNumbers?.primaryPhone).toBe('+5511999999999');
        expect(api.get).toHaveBeenCalledWith('/google-business/manage/business-info');
      });
    });

    describe('updateBusinessHours', () => {
      const newHours = {
        periods: [
          { openDay: 'MONDAY', openTime: '09:00', closeDay: 'MONDAY', closeTime: '19:00' },
          { openDay: 'TUESDAY', openTime: '09:00', closeDay: 'TUESDAY', closeTime: '19:00' },
        ],
      };

      it('should update business hours successfully', async () => {
        mockedApi.patch.mockResolvedValue({ data: { regularHours: newHours } });

        const result = await googleManagementService.updateBusinessHours(newHours);

        expect(api.patch).toHaveBeenCalledWith(
          '/google-business/manage/business-info/hours',
          newHours,
        );
      });
    });

    describe('updateBusinessDescription', () => {
      it('should update business description successfully', async () => {
        const newDescription = 'Nova descrição do negócio';
        mockedApi.patch.mockResolvedValue({ data: { profile: { description: newDescription } } });

        await googleManagementService.updateBusinessDescription(newDescription);

        expect(api.patch).toHaveBeenCalledWith(
          '/google-business/manage/business-info/description',
          { description: newDescription },
        );
      });
    });

    describe('updateBusinessPhone', () => {
      it('should update business phone successfully', async () => {
        const newPhone = '+5511888888888';
        mockedApi.patch.mockResolvedValue({ data: { phoneNumbers: { primaryPhone: newPhone } } });

        await googleManagementService.updateBusinessPhone(newPhone);

        expect(api.patch).toHaveBeenCalledWith(
          '/google-business/manage/business-info/phone',
          { primaryPhone: newPhone },
        );
      });
    });

    describe('updateBusinessWebsite', () => {
      it('should update business website successfully', async () => {
        const newWebsite = 'https://novosite.com.br';
        mockedApi.patch.mockResolvedValue({ data: { websiteUri: newWebsite } });

        await googleManagementService.updateBusinessWebsite(newWebsite);

        expect(api.patch).toHaveBeenCalledWith(
          '/google-business/manage/business-info/website',
          { websiteUri: newWebsite },
        );
      });
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should reject with 401 unauthorized', async () => {
      const error = { response: { status: 401, data: { message: 'Unauthorized' } } };
      mockedApi.get.mockRejectedValue(error);

      await expect(googleManagementService.listReviews()).rejects.toEqual(error);
    });

    it('should reject with 403 forbidden', async () => {
      const error = { response: { status: 403, data: { message: 'Google account not connected' } } };
      mockedApi.get.mockRejectedValue(error);

      await expect(googleManagementService.getBusinessInfo()).rejects.toEqual(error);
    });

    it('should reject with 404 not found', async () => {
      const error = { response: { status: 404, data: { message: 'Review not found' } } };
      mockedApi.get.mockRejectedValue(error);

      await expect(googleManagementService.getReview('invalid-id')).rejects.toEqual(error);
    });

    it('should reject with 400 bad request', async () => {
      const error = { response: { status: 400, data: { message: 'Invalid post content' } } };
      mockedApi.post.mockRejectedValue(error);

      await expect(
        googleManagementService.createPost({ summary: '' }),
      ).rejects.toEqual(error);
    });

    it('should reject with network errors', async () => {
      const error = { message: 'Network Error' };
      mockedApi.get.mockRejectedValue(error);

      await expect(googleManagementService.listPosts()).rejects.toEqual(error);
    });

    it('should reject with timeout errors', async () => {
      const error = { code: 'ECONNABORTED', message: 'timeout exceeded' };
      mockedApi.get.mockRejectedValue(error);

      await expect(googleManagementService.listMedia()).rejects.toEqual(error);
    });
  });

  // ==========================================================================
  // Service Export Tests
  // ==========================================================================

  describe('Service export', () => {
    it('should have all review methods', () => {
      expect(typeof googleManagementService.listReviews).toBe('function');
      expect(typeof googleManagementService.getReview).toBe('function');
      expect(typeof googleManagementService.replyToReview).toBe('function');
      expect(typeof googleManagementService.deleteReviewReply).toBe('function');
    });

    it('should have all post methods', () => {
      expect(typeof googleManagementService.listPosts).toBe('function');
      expect(typeof googleManagementService.createPost).toBe('function');
      expect(typeof googleManagementService.updatePost).toBe('function');
      expect(typeof googleManagementService.deletePost).toBe('function');
    });

    it('should have all media methods', () => {
      expect(typeof googleManagementService.listMedia).toBe('function');
      expect(typeof googleManagementService.uploadMedia).toBe('function');
      expect(typeof googleManagementService.deleteMedia).toBe('function');
    });

    it('should have all Q&A methods', () => {
      expect(typeof googleManagementService.listQuestions).toBe('function');
      expect(typeof googleManagementService.answerQuestion).toBe('function');
      expect(typeof googleManagementService.deleteAnswer).toBe('function');
    });

    it('should have all business info methods', () => {
      expect(typeof googleManagementService.getBusinessInfo).toBe('function');
      expect(typeof googleManagementService.updateBusinessHours).toBe('function');
      expect(typeof googleManagementService.updateBusinessDescription).toBe('function');
      expect(typeof googleManagementService.updateBusinessPhone).toBe('function');
      expect(typeof googleManagementService.updateBusinessWebsite).toBe('function');
    });
  });
});
