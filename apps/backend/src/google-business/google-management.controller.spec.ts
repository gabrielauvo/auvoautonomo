import { Test, TestingModule } from '@nestjs/testing';
import { GoogleManagementController } from './google-management.controller';
import { GoogleManagementService } from './google-management.service';

describe('GoogleManagementController', () => {
  let controller: GoogleManagementController;
  let service: GoogleManagementService;

  const mockUserId = 'user-123';

  const mockManagementService = {
    // Reviews
    listReviews: jest.fn(),
    getReview: jest.fn(),
    replyToReview: jest.fn(),
    deleteReviewReply: jest.fn(),
    // Posts
    listPosts: jest.fn(),
    createPost: jest.fn(),
    updatePost: jest.fn(),
    deletePost: jest.fn(),
    // Media
    listMedia: jest.fn(),
    createMedia: jest.fn(),
    deleteMedia: jest.fn(),
    // Q&A
    listQuestions: jest.fn(),
    answerQuestion: jest.fn(),
    deleteAnswer: jest.fn(),
    // Business Info
    getBusinessInfo: jest.fn(),
    updateBusinessHours: jest.fn(),
    updateBusinessDescription: jest.fn(),
    updateBusinessPhone: jest.fn(),
    updateBusinessWebsite: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoogleManagementController],
      providers: [
        {
          provide: GoogleManagementService,
          useValue: mockManagementService,
        },
      ],
    }).compile();

    controller = module.get<GoogleManagementController>(GoogleManagementController);
    service = module.get<GoogleManagementService>(GoogleManagementService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Reviews Tests
  // ==========================================================================

  describe('Reviews Endpoints', () => {
    describe('GET /reviews', () => {
      it('should list reviews', async () => {
        const mockReviews = {
          reviews: [{ reviewId: '1', comment: 'Great!' }],
          averageRating: 4.5,
          totalReviewCount: 1,
        };
        mockManagementService.listReviews.mockResolvedValue(mockReviews);

        const result = await controller.listReviews(mockUserId, undefined);

        expect(result).toEqual(mockReviews);
        expect(mockManagementService.listReviews).toHaveBeenCalledWith(mockUserId, undefined);
      });

      it('should pass pageToken when provided', async () => {
        mockManagementService.listReviews.mockResolvedValue({ reviews: [] });

        await controller.listReviews(mockUserId, 'page-token-123');

        expect(mockManagementService.listReviews).toHaveBeenCalledWith(mockUserId, 'page-token-123');
      });
    });

    describe('GET /reviews/:reviewId', () => {
      it('should get a specific review', async () => {
        const mockReview = { reviewId: 'review-1', comment: 'Great!' };
        mockManagementService.getReview.mockResolvedValue(mockReview);

        const result = await controller.getReview(mockUserId, 'review-1');

        expect(result).toEqual(mockReview);
        expect(mockManagementService.getReview).toHaveBeenCalledWith(mockUserId, 'review-1');
      });
    });

    describe('PUT /reviews/:reviewId/reply', () => {
      it('should reply to a review', async () => {
        mockManagementService.replyToReview.mockResolvedValue(undefined);

        await controller.replyToReview(mockUserId, 'review-1', { comment: 'Thank you!' });

        expect(mockManagementService.replyToReview).toHaveBeenCalledWith(
          mockUserId,
          'review-1',
          'Thank you!',
        );
      });
    });

    describe('DELETE /reviews/:reviewId/reply', () => {
      it('should delete a review reply', async () => {
        mockManagementService.deleteReviewReply.mockResolvedValue(undefined);

        await controller.deleteReviewReply(mockUserId, 'review-1');

        expect(mockManagementService.deleteReviewReply).toHaveBeenCalledWith(mockUserId, 'review-1');
      });
    });
  });

  // ==========================================================================
  // Posts Tests
  // ==========================================================================

  describe('Posts Endpoints', () => {
    describe('GET /posts', () => {
      it('should list posts', async () => {
        const mockPosts = { localPosts: [{ summary: 'Post 1' }] };
        mockManagementService.listPosts.mockResolvedValue(mockPosts);

        const result = await controller.listPosts(mockUserId, undefined);

        expect(result).toEqual(mockPosts);
        expect(mockManagementService.listPosts).toHaveBeenCalledWith(mockUserId, undefined);
      });
    });

    describe('POST /posts', () => {
      it('should create a post', async () => {
        const createDto = { summary: 'New post!', topicType: 'STANDARD' as const };
        const createdPost = { ...createDto, name: 'post-1' };
        mockManagementService.createPost.mockResolvedValue(createdPost);

        const result = await controller.createPost(mockUserId, createDto);

        expect(result).toEqual(createdPost);
        expect(mockManagementService.createPost).toHaveBeenCalledWith(mockUserId, createDto);
      });
    });

    describe('PATCH /posts/:postName', () => {
      it('should update a post', async () => {
        const updateDto = { summary: 'Updated content' };
        const updatedPost = { ...updateDto, name: 'post-1' };
        mockManagementService.updatePost.mockResolvedValue(updatedPost);

        const result = await controller.updatePost(mockUserId, 'post-1', updateDto);

        expect(result).toEqual(updatedPost);
        expect(mockManagementService.updatePost).toHaveBeenCalledWith(mockUserId, 'post-1', updateDto);
      });
    });

    describe('DELETE /posts/:postName', () => {
      it('should delete a post', async () => {
        mockManagementService.deletePost.mockResolvedValue(undefined);

        await controller.deletePost(mockUserId, 'post-1');

        expect(mockManagementService.deletePost).toHaveBeenCalledWith(mockUserId, 'post-1');
      });
    });
  });

  // ==========================================================================
  // Media Tests
  // ==========================================================================

  describe('Media Endpoints', () => {
    describe('GET /media', () => {
      it('should list media', async () => {
        const mockMedia = { mediaItems: [{ name: 'media-1' }], totalMediaItemCount: 1 };
        mockManagementService.listMedia.mockResolvedValue(mockMedia);

        const result = await controller.listMedia(mockUserId, undefined);

        expect(result).toEqual(mockMedia);
        expect(mockManagementService.listMedia).toHaveBeenCalledWith(mockUserId, undefined);
      });
    });

    describe('POST /media', () => {
      it('should upload media', async () => {
        const createDto = { mediaFormat: 'PHOTO' as const, sourceUrl: 'https://example.com/photo.jpg' };
        const createdMedia = { ...createDto, name: 'media-1' };
        mockManagementService.createMedia.mockResolvedValue(createdMedia);

        const result = await controller.createMedia(mockUserId, createDto);

        expect(result).toEqual(createdMedia);
        expect(mockManagementService.createMedia).toHaveBeenCalledWith(mockUserId, createDto);
      });
    });

    describe('DELETE /media/:mediaName', () => {
      it('should delete media', async () => {
        mockManagementService.deleteMedia.mockResolvedValue(undefined);

        await controller.deleteMedia(mockUserId, 'media-1');

        expect(mockManagementService.deleteMedia).toHaveBeenCalledWith(mockUserId, 'media-1');
      });
    });
  });

  // ==========================================================================
  // Q&A Tests
  // ==========================================================================

  describe('Q&A Endpoints', () => {
    describe('GET /questions', () => {
      it('should list questions', async () => {
        const mockQuestions = { questions: [{ text: 'Question?' }], totalSize: 1 };
        mockManagementService.listQuestions.mockResolvedValue(mockQuestions);

        const result = await controller.listQuestions(mockUserId, undefined);

        expect(result).toEqual(mockQuestions);
        expect(mockManagementService.listQuestions).toHaveBeenCalledWith(mockUserId, undefined);
      });
    });

    describe('POST /questions/:questionName/answer', () => {
      it('should answer a question', async () => {
        const answer = { text: 'Yes, we do!', name: 'answer-1' };
        mockManagementService.answerQuestion.mockResolvedValue(answer);

        const result = await controller.answerQuestion(mockUserId, 'question-1', { text: 'Yes, we do!' });

        expect(result).toEqual(answer);
        expect(mockManagementService.answerQuestion).toHaveBeenCalledWith(
          mockUserId,
          'question-1',
          'Yes, we do!',
        );
      });
    });

    describe('DELETE /answers/:answerName', () => {
      it('should delete an answer', async () => {
        mockManagementService.deleteAnswer.mockResolvedValue(undefined);

        await controller.deleteAnswer(mockUserId, 'answer-1');

        expect(mockManagementService.deleteAnswer).toHaveBeenCalledWith(mockUserId, 'answer-1');
      });
    });
  });

  // ==========================================================================
  // Business Info Tests
  // ==========================================================================

  describe('Business Info Endpoints', () => {
    describe('GET /business-info', () => {
      it('should get business info', async () => {
        const mockInfo = { title: 'My Business', phoneNumbers: { primaryPhone: '+55119999' } };
        mockManagementService.getBusinessInfo.mockResolvedValue(mockInfo);

        const result = await controller.getBusinessInfo(mockUserId);

        expect(result).toEqual(mockInfo);
        expect(mockManagementService.getBusinessInfo).toHaveBeenCalledWith(mockUserId);
      });
    });

    describe('PATCH /business-info/hours', () => {
      it('should update business hours', async () => {
        const hoursDto = {
          periods: [{ openDay: 'MONDAY', openTime: '09:00', closeDay: 'MONDAY', closeTime: '18:00' }],
        };
        const updatedInfo = { regularHours: hoursDto };
        mockManagementService.updateBusinessHours.mockResolvedValue(updatedInfo);

        const result = await controller.updateBusinessHours(mockUserId, hoursDto);

        expect(result).toEqual(updatedInfo);
        expect(mockManagementService.updateBusinessHours).toHaveBeenCalledWith(mockUserId, hoursDto);
      });
    });

    describe('PATCH /business-info/description', () => {
      it('should update business description', async () => {
        const dto = { description: 'New description' };
        const updatedInfo = { profile: dto };
        mockManagementService.updateBusinessDescription.mockResolvedValue(updatedInfo);

        const result = await controller.updateBusinessDescription(mockUserId, dto);

        expect(result).toEqual(updatedInfo);
        expect(mockManagementService.updateBusinessDescription).toHaveBeenCalledWith(
          mockUserId,
          'New description',
        );
      });
    });

    describe('PATCH /business-info/phone', () => {
      it('should update business phone', async () => {
        const dto = { primaryPhone: '+5511888888888' };
        const updatedInfo = { phoneNumbers: dto };
        mockManagementService.updateBusinessPhone.mockResolvedValue(updatedInfo);

        const result = await controller.updateBusinessPhone(mockUserId, dto);

        expect(result).toEqual(updatedInfo);
        expect(mockManagementService.updateBusinessPhone).toHaveBeenCalledWith(
          mockUserId,
          '+5511888888888',
        );
      });
    });

    describe('PATCH /business-info/website', () => {
      it('should update business website', async () => {
        const dto = { websiteUri: 'https://newsite.com' };
        const updatedInfo = dto;
        mockManagementService.updateBusinessWebsite.mockResolvedValue(updatedInfo);

        const result = await controller.updateBusinessWebsite(mockUserId, dto);

        expect(result).toEqual(updatedInfo);
        expect(mockManagementService.updateBusinessWebsite).toHaveBeenCalledWith(
          mockUserId,
          'https://newsite.com',
        );
      });
    });
  });
});
