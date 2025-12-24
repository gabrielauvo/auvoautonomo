'use client';

/**
 * Posts Tab Component
 *
 * Gerenciar posts do Google Meu Negocio
 */

import { useState } from 'react';
import { useTranslations } from '@/i18n';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Skeleton,
  EmptyState,
  Input,
  Textarea,
  Select,
  Modal,
} from '@/components/ui';
import {
  Plus,
  Edit,
  Trash2,
  MessageSquare,
  Calendar,
  ExternalLink,
  Image,
  ChevronDown,
  Loader2,
  Tag,
  Percent,
  CalendarClock,
  Info,
} from 'lucide-react';
import {
  usePosts,
  useCreatePost,
  useUpdatePost,
  useDeletePost,
} from '@/hooks/use-google-management';
import { CreatePostInput } from '@/services/google-management.service';

// ============================================================================
// Types
// ============================================================================

type PostType = 'STANDARD' | 'EVENT' | 'OFFER';

interface Post {
  name: string;
  languageCode: string;
  summary: string;
  callToAction?: {
    actionType: string;
    url?: string;
  };
  media?: Array<{
    mediaFormat: string;
    sourceUrl: string;
  }>;
  topicType?: PostType;
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
  createTime: string;
  updateTime: string;
  state: string;
}

// ============================================================================
// Post Form Modal
// ============================================================================

function PostFormModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  initialData,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreatePostInput) => void;
  isLoading: boolean;
  initialData?: Partial<CreatePostInput>;
}) {
  const { t } = useTranslations('googleBusiness');
  const [postType, setPostType] = useState<PostType>(initialData?.topicType || 'STANDARD');
  const [summary, setSummary] = useState(initialData?.summary || '');
  const [mediaUrl, setMediaUrl] = useState(initialData?.media?.[0]?.sourceUrl || '');
  const [ctaType, setCtaType] = useState(initialData?.callToAction?.actionType || 'LEARN_MORE');
  const [ctaUrl, setCtaUrl] = useState(initialData?.callToAction?.url || '');

  // Event fields
  const [eventTitle, setEventTitle] = useState(initialData?.event?.title || '');
  const [eventStartDate, setEventStartDate] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');

  // Offer fields
  const [couponCode, setCouponCode] = useState(initialData?.offer?.couponCode || '');
  const [termsConditions, setTermsConditions] = useState(initialData?.offer?.termsConditions || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data: CreatePostInput = {
      summary,
      topicType: postType,
    };

    if (mediaUrl) {
      data.media = [{ sourceUrl: mediaUrl, mediaFormat: 'PHOTO' }];
    }

    if (ctaUrl) {
      data.callToAction = { actionType: ctaType, url: ctaUrl };
    }

    if (postType === 'EVENT' && eventTitle) {
      const startDate = new Date(eventStartDate);
      const endDate = new Date(eventEndDate || eventStartDate);
      data.event = {
        title: eventTitle,
        schedule: {
          startDate: { year: startDate.getFullYear(), month: startDate.getMonth() + 1, day: startDate.getDate() },
          endDate: { year: endDate.getFullYear(), month: endDate.getMonth() + 1, day: endDate.getDate() },
        },
      };
    }

    if (postType === 'OFFER') {
      data.offer = {};
      if (couponCode) data.offer.couponCode = couponCode;
      if (termsConditions) data.offer.termsConditions = termsConditions;
    }

    onSubmit(data);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? t('posts.editPost') : t('posts.newPost')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Post Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('posts.type')}
          </label>
          <Select
            value={postType}
            onChange={(e) => setPostType(e.target.value as PostType)}
          >
            <option value="STANDARD">{t('posts.types.standard')}</option>
            <option value="EVENT">{t('posts.types.event')}</option>
            <option value="OFFER">{t('posts.types.offer')}</option>
          </Select>
        </div>

        {/* Summary */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('posts.content')} *
          </label>
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder={t('posts.contentPlaceholder')}
            rows={4}
            required
            maxLength={1500}
          />
          <p className="text-xs text-gray-500 mt-1">{summary.length}/1500</p>
        </div>

        {/* Media URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('posts.imageUrl')}
          </label>
          <Input
            type="url"
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
          />
        </div>

        {/* Event Fields */}
        {postType === 'EVENT' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('posts.eventTitle')} *
              </label>
              <Input
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder={t('posts.eventTitlePlaceholder')}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('posts.startDate')} *
                </label>
                <Input
                  type="date"
                  value={eventStartDate}
                  onChange={(e) => setEventStartDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('posts.endDate')}
                </label>
                <Input
                  type="date"
                  value={eventEndDate}
                  onChange={(e) => setEventEndDate(e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {/* Offer Fields */}
        {postType === 'OFFER' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('posts.couponCode')}
              </label>
              <Input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                placeholder={t('posts.couponCodePlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('posts.termsConditions')}
              </label>
              <Textarea
                value={termsConditions}
                onChange={(e) => setTermsConditions(e.target.value)}
                placeholder={t('posts.termsConditionsPlaceholder')}
                rows={2}
              />
            </div>
          </>
        )}

        {/* Call to Action */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('posts.ctaType')}
            </label>
            <Select
              value={ctaType}
              onChange={(e) => setCtaType(e.target.value)}
            >
              <option value="LEARN_MORE">{t('posts.cta.learnMore')}</option>
              <option value="BOOK">{t('posts.cta.book')}</option>
              <option value="ORDER">{t('posts.cta.order')}</option>
              <option value="SHOP">{t('posts.cta.shop')}</option>
              <option value="SIGN_UP">{t('posts.cta.signUp')}</option>
              <option value="CALL">{t('posts.cta.call')}</option>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('posts.ctaUrl')}
            </label>
            <Input
              type="url"
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={isLoading}>
            {initialData ? t('common.save') : t('posts.publish')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================================
// Post Card
// ============================================================================

function PostCard({ post, onEdit, onDelete }: { post: Post; onEdit: () => void; onDelete: () => void }) {
  const { t } = useTranslations('googleBusiness');
  const deleteMutation = useDeletePost();

  const handleDelete = async () => {
    if (!confirm(t('posts.confirmDelete'))) return;
    await deleteMutation.mutateAsync(post.name);
    onDelete();
  };

  const getTypeIcon = () => {
    switch (post.topicType) {
      case 'EVENT':
        return <CalendarClock className="h-4 w-4" />;
      case 'OFFER':
        return <Percent className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getTypeBadge = () => {
    switch (post.topicType) {
      case 'EVENT':
        return <Badge variant="info">{t('posts.types.event')}</Badge>;
      case 'OFFER':
        return <Badge variant="warning">{t('posts.types.offer')}</Badge>;
      default:
        return <Badge variant="default">{t('posts.types.standard')}</Badge>;
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Media Preview */}
          {post.media && post.media.length > 0 && (
            <div className="flex-shrink-0">
              <img
                src={post.media[0].sourceUrl}
                alt=""
                className="w-24 h-24 object-cover rounded-lg"
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {getTypeBadge()}
                {post.event && (
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {post.event.title}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={onEdit}
                  className="p-1 text-gray-400 hover:text-primary transition-colors"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="p-1 text-gray-400 hover:text-error transition-colors"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <p className="mt-2 text-sm text-gray-600 line-clamp-3">{post.summary}</p>

            {/* Offer details */}
            {post.offer?.couponCode && (
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="success" size="sm">
                  <Tag className="h-3 w-3 mr-1" />
                  {post.offer.couponCode}
                </Badge>
              </div>
            )}

            {/* CTA */}
            {post.callToAction?.url && (
              <a
                href={post.callToAction.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                {post.callToAction.actionType.replace('_', ' ')}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}

            {/* Meta */}
            <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
              <span>{new Date(post.createTime).toLocaleDateString('pt-BR')}</span>
              <Badge variant={post.state === 'LIVE' ? 'success' : 'default'} size="sm">
                {post.state}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PostsTab() {
  const { t } = useTranslations('googleBusiness');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = usePosts();

  const createMutation = useCreatePost();
  const updateMutation = useUpdatePost();

  const posts = data?.pages.flatMap((page) => page.localPosts) || [];

  const handleSubmit = async (postData: CreatePostInput) => {
    if (editingPost) {
      await updateMutation.mutateAsync({
        postName: editingPost.name,
        post: postData,
      });
    } else {
      await createMutation.mutateAsync(postData);
    }
    setIsModalOpen(false);
    setEditingPost(null);
    refetch();
  };

  const handleEdit = (post: Post) => {
    setEditingPost(post);
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setEditingPost(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Badge variant="info">{posts.length} {t('posts.total')}</Badge>
        <Button
          onClick={() => setIsModalOpen(true)}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          {t('posts.newPost')}
        </Button>
      </div>

      {/* Posts List */}
      {posts.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-12 w-12" />}
          title={t('posts.empty')}
          description={t('posts.emptyDescription')}
          action={
            <Button
              onClick={() => setIsModalOpen(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              {t('posts.createFirst')}
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {posts.map((post: Post) => (
            <PostCard
              key={post.name}
              post={post}
              onEdit={() => handleEdit(post)}
              onDelete={() => refetch()}
            />
          ))}
        </div>
      )}

      {/* Load More */}
      {hasNextPage && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            loading={isFetchingNextPage}
            leftIcon={<ChevronDown className="h-4 w-4" />}
          >
            {t('posts.loadMore')}
          </Button>
        </div>
      )}

      {/* Modal */}
      <PostFormModal
        isOpen={isModalOpen}
        onClose={handleClose}
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
        initialData={editingPost ? {
          summary: editingPost.summary,
          topicType: editingPost.topicType,
          media: editingPost.media,
          callToAction: editingPost.callToAction,
          event: editingPost.event,
          offer: editingPost.offer,
        } : undefined}
      />
    </div>
  );
}
