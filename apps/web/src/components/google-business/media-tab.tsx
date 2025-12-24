'use client';

/**
 * Media Tab Component
 *
 * Gerenciar fotos do Google Meu Negocio
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
  Select,
  Modal,
} from '@/components/ui';
import {
  Plus,
  Trash2,
  Image,
  ChevronDown,
  Loader2,
  Eye,
  Upload,
  Building2,
  Users,
  Utensils,
  Briefcase,
} from 'lucide-react';
import {
  useMedia,
  useUploadMedia,
  useDeleteMedia,
} from '@/hooks/use-google-management';
import { CreateMediaInput } from '@/services/google-management.service';

// ============================================================================
// Types
// ============================================================================

type MediaCategory = 'COVER' | 'PROFILE' | 'LOGO' | 'EXTERIOR' | 'INTERIOR' | 'PRODUCT' | 'AT_WORK' | 'FOOD_AND_DRINK' | 'MENU' | 'COMMON_AREA' | 'ROOMS' | 'TEAMS' | 'ADDITIONAL';

interface MediaItem {
  name: string;
  mediaFormat: string;
  sourceUrl: string;
  googleUrl?: string;
  thumbnailUrl?: string;
  createTime: string;
  dimensions?: {
    widthPixels: number;
    heightPixels: number;
  };
  insights?: {
    viewCount: string;
  };
  locationAssociation?: {
    category: MediaCategory;
  };
}

// ============================================================================
// Upload Modal
// ============================================================================

function UploadMediaModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateMediaInput) => void;
  isLoading: boolean;
}) {
  const { t } = useTranslations('googleBusiness');
  const [sourceUrl, setSourceUrl] = useState('');
  const [category, setCategory] = useState<MediaCategory>('ADDITIONAL');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    onSubmit({
      sourceUrl,
      mediaFormat: 'PHOTO',
      category,
      description: description || undefined,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('media.upload')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Image URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('media.imageUrl')} *
          </label>
          <Input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            required
          />
          <p className="text-xs text-gray-500 mt-1">{t('media.imageUrlHint')}</p>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('media.category')}
          </label>
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value as MediaCategory)}
          >
            <option value="ADDITIONAL">{t('media.categories.additional')}</option>
            <option value="COVER">{t('media.categories.cover')}</option>
            <option value="PROFILE">{t('media.categories.profile')}</option>
            <option value="LOGO">{t('media.categories.logo')}</option>
            <option value="EXTERIOR">{t('media.categories.exterior')}</option>
            <option value="INTERIOR">{t('media.categories.interior')}</option>
            <option value="PRODUCT">{t('media.categories.product')}</option>
            <option value="AT_WORK">{t('media.categories.atWork')}</option>
            <option value="FOOD_AND_DRINK">{t('media.categories.foodAndDrink')}</option>
            <option value="TEAMS">{t('media.categories.teams')}</option>
          </Select>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('media.description')}
          </label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('media.descriptionPlaceholder')}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={isLoading} leftIcon={<Upload className="h-4 w-4" />}>
            {t('media.uploadButton')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================================
// Media Card
// ============================================================================

function MediaCard({ media, onDelete }: { media: MediaItem; onDelete: () => void }) {
  const { t } = useTranslations('googleBusiness');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const deleteMutation = useDeleteMedia();

  const handleDelete = async () => {
    if (!confirm(t('media.confirmDelete'))) return;
    await deleteMutation.mutateAsync(media.name);
    onDelete();
  };

  const getCategoryIcon = (category?: MediaCategory) => {
    switch (category) {
      case 'EXTERIOR':
      case 'INTERIOR':
        return <Building2 className="h-3 w-3" />;
      case 'TEAMS':
      case 'AT_WORK':
        return <Users className="h-3 w-3" />;
      case 'FOOD_AND_DRINK':
        return <Utensils className="h-3 w-3" />;
      case 'PRODUCT':
        return <Briefcase className="h-3 w-3" />;
      default:
        return <Image className="h-3 w-3" />;
    }
  };

  const imageUrl = media.thumbnailUrl || media.googleUrl || media.sourceUrl;

  return (
    <>
      <Card className="overflow-hidden">
        <div className="relative aspect-square">
          <img
            src={imageUrl}
            alt=""
            className="w-full h-full object-cover"
          />

          {/* Overlay */}
          <div className="absolute inset-0 bg-black/0 hover:bg-black/50 transition-colors group">
            <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setIsPreviewOpen(true)}
                className="p-2 bg-white rounded-full text-gray-700 hover:bg-gray-100"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="p-2 bg-white rounded-full text-error hover:bg-gray-100"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Category Badge */}
          {media.locationAssociation?.category && (
            <div className="absolute top-2 left-2">
              <Badge variant="default" size="sm" className="bg-white/90 text-gray-700">
                {getCategoryIcon(media.locationAssociation.category)}
                <span className="ml-1">{media.locationAssociation.category}</span>
              </Badge>
            </div>
          )}

          {/* Views */}
          {media.insights?.viewCount && (
            <div className="absolute bottom-2 right-2">
              <Badge variant="default" size="sm" className="bg-black/60 text-white">
                <Eye className="h-3 w-3 mr-1" />
                {media.insights.viewCount}
              </Badge>
            </div>
          )}
        </div>

        <CardContent className="p-2">
          <div className="text-xs text-gray-500 flex items-center justify-between">
            <span>{new Date(media.createTime).toLocaleDateString('pt-BR')}</span>
            {media.dimensions && (
              <span>{media.dimensions.widthPixels}x{media.dimensions.heightPixels}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview Modal */}
      <Modal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} title={t('media.preview')}>
        <div className="flex items-center justify-center">
          <img
            src={media.googleUrl || media.sourceUrl}
            alt=""
            className="max-w-full max-h-[70vh] object-contain rounded-lg"
          />
        </div>
      </Modal>
    </>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function MediaTab() {
  const { t } = useTranslations('googleBusiness');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useMedia();

  const uploadMutation = useUploadMedia();

  const mediaItems = data?.pages.flatMap((page) => page.mediaItems) || [];

  const handleUpload = async (mediaData: CreateMediaInput) => {
    await uploadMutation.mutateAsync(mediaData);
    setIsModalOpen(false);
    refetch();
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Skeleton key={i} className="aspect-square" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Badge variant="info">{mediaItems.length} {t('media.total')}</Badge>
        <Button
          onClick={() => setIsModalOpen(true)}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          {t('media.upload')}
        </Button>
      </div>

      {/* Media Grid */}
      {mediaItems.length === 0 ? (
        <EmptyState
          icon={<Image className="h-12 w-12" />}
          title={t('media.empty')}
          description={t('media.emptyDescription')}
          action={
            <Button
              onClick={() => setIsModalOpen(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              {t('media.uploadFirst')}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {mediaItems.map((media: MediaItem) => (
            <MediaCard
              key={media.name}
              media={media}
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
            {t('media.loadMore')}
          </Button>
        </div>
      )}

      {/* Upload Modal */}
      <UploadMediaModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleUpload}
        isLoading={uploadMutation.isPending}
      />
    </div>
  );
}
