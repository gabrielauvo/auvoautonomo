'use client';

/**
 * Google Business Management Page
 *
 * Pagina completa para gestao do Google Meu Negocio:
 * - Avaliacoes (listar, responder)
 * - Posts (criar, editar, excluir)
 * - Fotos (upload, excluir)
 * - Perguntas e Respostas
 * - Informacoes do negocio
 */

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from '@/i18n';
import { AppLayout } from '@/components/layout';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui';
import {
  Star,
  MessageSquare,
  Image,
  HelpCircle,
  Building2,
  Settings,
  Plug,
  ArrowLeft,
} from 'lucide-react';
import { useGoogleBusinessStatus } from '@/hooks/use-integrations';

// Tab Components
import { ReviewsTab } from '@/components/google-business/reviews-tab';
import { PostsTab } from '@/components/google-business/posts-tab';
import { MediaTab } from '@/components/google-business/media-tab';
import { QuestionsTab } from '@/components/google-business/questions-tab';
import { BusinessInfoTab } from '@/components/google-business/business-info-tab';

// ============================================================================
// Main Component
// ============================================================================

function GoogleBusinessManagementContent() {
  const { t } = useTranslations('googleBusiness');
  const [activeTab, setActiveTab] = useState('reviews');

  // Check connection status
  const { data: googleStatus, isLoading: isLoadingStatus } = useGoogleBusinessStatus();
  const isConnected = googleStatus?.status === 'CONNECTED';

  // If not connected, show connection prompt
  if (!isLoadingStatus && !isConnected) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="page-header">
            <h1 className="page-title">{t('manageTitle')}</h1>
            <p className="page-subtitle">{t('manageSubtitle')}</p>
          </div>

          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary-50 mb-4">
                  <Plug className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">{t('connectFirst')}</h3>
                <p className="text-sm text-gray-500 max-w-sm mb-4">{t('connectFirstDescription')}</p>
                <Link href="/settings/integrations">
                  <Button leftIcon={<Settings className="h-4 w-4" />}>
                    {t('goToIntegrations')}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (isLoadingStatus) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/growth">
              <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
                {t('backToGrowth')}
              </Button>
            </Link>
            <div>
              <h1 className="page-title">{t('manageTitle')}</h1>
              <p className="page-subtitle">{t('manageSubtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {googleStatus?.locationName && (
              <Badge variant="success" className="gap-1">
                <Building2 className="h-3 w-3" />
                {googleStatus.locationName}
              </Badge>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="reviews" className="gap-2">
              <Star className="h-4 w-4" />
              {t('tabs.reviews')}
            </TabsTrigger>
            <TabsTrigger value="posts" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              {t('tabs.posts')}
            </TabsTrigger>
            <TabsTrigger value="media" className="gap-2">
              <Image className="h-4 w-4" />
              {t('tabs.media')}
            </TabsTrigger>
            <TabsTrigger value="questions" className="gap-2">
              <HelpCircle className="h-4 w-4" />
              {t('tabs.questions')}
            </TabsTrigger>
            <TabsTrigger value="info" className="gap-2">
              <Building2 className="h-4 w-4" />
              {t('tabs.businessInfo')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reviews">
            <ReviewsTab />
          </TabsContent>

          <TabsContent value="posts">
            <PostsTab />
          </TabsContent>

          <TabsContent value="media">
            <MediaTab />
          </TabsContent>

          <TabsContent value="questions">
            <QuestionsTab />
          </TabsContent>

          <TabsContent value="info">
            <BusinessInfoTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

export default function GoogleBusinessManagementPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="space-y-6">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </AppLayout>
      }
    >
      <GoogleBusinessManagementContent />
    </Suspense>
  );
}
