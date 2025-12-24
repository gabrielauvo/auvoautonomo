'use client';

/**
 * Reviews Tab Component
 *
 * Lista avaliacoes do Google Meu Negocio com opcao de responder
 */

import { useState } from 'react';
import { useTranslations } from '@/i18n';
import {
  Card,
  CardContent,
  Button,
  Badge,
  Skeleton,
  EmptyState,
  Input,
  Textarea,
} from '@/components/ui';
import {
  Star,
  MessageCircle,
  Send,
  Trash2,
  User,
  Clock,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import {
  useReviews,
  useReplyToReview,
  useDeleteReviewReply,
} from '@/hooks/use-google-management';

// ============================================================================
// Types
// ============================================================================

interface Review {
  name: string;
  reviewId: string;
  reviewer: {
    displayName: string;
    profilePhotoUrl?: string;
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

// ============================================================================
// Helper Components
// ============================================================================

function StarRating({ rating }: { rating: string }) {
  const ratingMap: Record<string, number> = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
  };
  const stars = ratingMap[rating] || 0;

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${
            i <= stars ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
          }`}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review, onReplySuccess }: { review: Review; onReplySuccess: () => void }) {
  const { t } = useTranslations('googleBusiness');
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');

  const replyMutation = useReplyToReview();
  const deleteReplyMutation = useDeleteReviewReply();

  const handleSubmitReply = async () => {
    if (!replyText.trim()) return;

    await replyMutation.mutateAsync({
      reviewId: review.reviewId,
      comment: replyText,
    });

    setReplyText('');
    setIsReplying(false);
    onReplySuccess();
  };

  const handleDeleteReply = async () => {
    if (!confirm(t('reviews.confirmDeleteReply'))) return;

    await deleteReplyMutation.mutateAsync(review.reviewId);
    onReplySuccess();
  };

  const getRatingBadgeVariant = (rating: string) => {
    const ratingMap: Record<string, number> = {
      ONE: 1,
      TWO: 2,
      THREE: 3,
      FOUR: 4,
      FIVE: 5,
    };
    const stars = ratingMap[rating] || 0;
    if (stars >= 4) return 'success';
    if (stars === 3) return 'warning';
    return 'error';
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {review.reviewer.profilePhotoUrl ? (
              <img
                src={review.reviewer.profilePhotoUrl}
                alt={review.reviewer.displayName}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <User className="h-5 w-5 text-gray-400" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-medium text-gray-900">{review.reviewer.displayName}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <StarRating rating={review.starRating} />
                  <Badge variant={getRatingBadgeVariant(review.starRating)} size="sm">
                    {review.starRating.toLowerCase()}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="h-3 w-3" />
                {new Date(review.createTime).toLocaleDateString('pt-BR')}
              </div>
            </div>

            {/* Comment */}
            {review.comment && (
              <p className="mt-3 text-gray-600 text-sm">{review.comment}</p>
            )}

            {/* Existing Reply */}
            {review.reviewReply && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg border-l-4 border-primary">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-primary">{t('reviews.yourReply')}</span>
                  <button
                    onClick={handleDeleteReply}
                    disabled={deleteReplyMutation.isPending}
                    className="text-gray-400 hover:text-error transition-colors"
                  >
                    {deleteReplyMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-sm text-gray-600">{review.reviewReply.comment}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(review.reviewReply.updateTime).toLocaleDateString('pt-BR')}
                </p>
              </div>
            )}

            {/* Reply Form */}
            {!review.reviewReply && (
              <div className="mt-4">
                {isReplying ? (
                  <div className="space-y-3">
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={t('reviews.replyPlaceholder')}
                      rows={3}
                      className="text-sm"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={handleSubmitReply}
                        loading={replyMutation.isPending}
                        disabled={!replyText.trim()}
                        leftIcon={<Send className="h-3 w-3" />}
                      >
                        {t('reviews.sendReply')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setIsReplying(false);
                          setReplyText('');
                        }}
                      >
                        {t('common.cancel')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsReplying(true)}
                    leftIcon={<MessageCircle className="h-3 w-3" />}
                  >
                    {t('reviews.reply')}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ReviewsTab() {
  const { t } = useTranslations('googleBusiness');

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useReviews();

  const reviews = data?.pages.flatMap((page) => page.reviews) || [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <EmptyState
        icon={<Star className="h-12 w-12" />}
        title={t('reviews.empty')}
        description={t('reviews.emptyDescription')}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center gap-4 mb-6">
        <Badge variant="info">{reviews.length} {t('reviews.total')}</Badge>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.map((review: Review) => (
          <ReviewCard
            key={review.name}
            review={review}
            onReplySuccess={() => refetch()}
          />
        ))}
      </div>

      {/* Load More */}
      {hasNextPage && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            loading={isFetchingNextPage}
            leftIcon={<ChevronDown className="h-4 w-4" />}
          >
            {t('reviews.loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
}
