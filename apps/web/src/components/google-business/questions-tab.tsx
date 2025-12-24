'use client';

/**
 * Questions Tab Component
 *
 * Gerenciar perguntas e respostas do Google Meu Negocio
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
  Textarea,
} from '@/components/ui';
import {
  HelpCircle,
  MessageCircle,
  Send,
  Trash2,
  User,
  Clock,
  ChevronDown,
  Loader2,
  ThumbsUp,
} from 'lucide-react';
import {
  useQuestions,
  useAnswerQuestion,
  useDeleteAnswer,
} from '@/hooks/use-google-management';

// ============================================================================
// Types
// ============================================================================

interface Answer {
  name: string;
  author: {
    displayName: string;
    profilePhotoUrl?: string;
    type: 'LOCAL_GUIDE' | 'MERCHANT' | 'REGULAR_USER';
  };
  text: string;
  createTime: string;
  updateTime: string;
  upvoteCount: number;
}

interface Question {
  name: string;
  author: {
    displayName: string;
    profilePhotoUrl?: string;
    type: 'LOCAL_GUIDE' | 'MERCHANT' | 'REGULAR_USER';
  };
  text: string;
  createTime: string;
  updateTime: string;
  upvoteCount: number;
  totalAnswerCount: number;
  topAnswers?: Answer[];
}

// ============================================================================
// Answer Card
// ============================================================================

function AnswerCard({ answer, onDelete }: { answer: Answer; onDelete: () => void }) {
  const { t } = useTranslations('googleBusiness');
  const deleteMutation = useDeleteAnswer();

  const handleDelete = async () => {
    if (!confirm(t('questions.confirmDeleteAnswer'))) return;
    await deleteMutation.mutateAsync(answer.name);
    onDelete();
  };

  const isMerchant = answer.author.type === 'MERCHANT';

  return (
    <div className={`p-3 rounded-lg ${isMerchant ? 'bg-primary-50 border-l-4 border-primary' : 'bg-gray-50'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {answer.author.profilePhotoUrl ? (
            <img
              src={answer.author.profilePhotoUrl}
              alt={answer.author.displayName}
              className="w-6 h-6 rounded-full"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
              <User className="h-3 w-3 text-gray-400" />
            </div>
          )}
          <span className="text-sm font-medium text-gray-700">{answer.author.displayName}</span>
          {isMerchant && (
            <Badge variant="primary" size="sm">{t('questions.owner')}</Badge>
          )}
        </div>
        {isMerchant && (
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="text-gray-400 hover:text-error transition-colors"
          >
            {deleteMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
      <p className="mt-2 text-sm text-gray-600">{answer.text}</p>
      <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
        <span>{new Date(answer.createTime).toLocaleDateString('pt-BR')}</span>
        {answer.upvoteCount > 0 && (
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3" />
            {answer.upvoteCount}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Question Card
// ============================================================================

function QuestionCard({ question, onAnswerSuccess }: { question: Question; onAnswerSuccess: () => void }) {
  const { t } = useTranslations('googleBusiness');
  const [isAnswering, setIsAnswering] = useState(false);
  const [answerText, setAnswerText] = useState('');

  const answerMutation = useAnswerQuestion();

  const handleSubmitAnswer = async () => {
    if (!answerText.trim()) return;

    await answerMutation.mutateAsync({
      questionName: question.name,
      text: answerText,
    });

    setAnswerText('');
    setIsAnswering(false);
    onAnswerSuccess();
  };

  const hasOwnerAnswer = question.topAnswers?.some((a) => a.author.type === 'MERCHANT');

  return (
    <Card>
      <CardContent className="p-4">
        {/* Question */}
        <div className="flex items-start gap-3">
          {question.author.profilePhotoUrl ? (
            <img
              src={question.author.profilePhotoUrl}
              alt={question.author.displayName}
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <User className="h-5 w-5 text-gray-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-medium text-gray-900">{question.author.displayName}</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(question.createTime).toLocaleDateString('pt-BR')}
                  </span>
                  {question.upvoteCount > 0 && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <ThumbsUp className="h-3 w-3" />
                      {question.upvoteCount}
                    </span>
                  )}
                </div>
              </div>
              <Badge variant={hasOwnerAnswer ? 'success' : 'warning'} size="sm">
                {hasOwnerAnswer ? t('questions.answered') : t('questions.pending')}
              </Badge>
            </div>

            <p className="mt-3 text-gray-700">{question.text}</p>

            {/* Existing Answers */}
            {question.topAnswers && question.topAnswers.length > 0 && (
              <div className="mt-4 space-y-3">
                <h5 className="text-sm font-medium text-gray-700">
                  {t('questions.answers')} ({question.totalAnswerCount})
                </h5>
                {question.topAnswers.map((answer) => (
                  <AnswerCard
                    key={answer.name}
                    answer={answer}
                    onDelete={onAnswerSuccess}
                  />
                ))}
              </div>
            )}

            {/* Answer Form */}
            <div className="mt-4">
              {isAnswering ? (
                <div className="space-y-3">
                  <Textarea
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder={t('questions.answerPlaceholder')}
                    rows={3}
                    className="text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleSubmitAnswer}
                      loading={answerMutation.isPending}
                      disabled={!answerText.trim()}
                      leftIcon={<Send className="h-3 w-3" />}
                    >
                      {t('questions.sendAnswer')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setIsAnswering(false);
                        setAnswerText('');
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
                  onClick={() => setIsAnswering(true)}
                  leftIcon={<MessageCircle className="h-3 w-3" />}
                >
                  {hasOwnerAnswer ? t('questions.addAnotherAnswer') : t('questions.answer')}
                </Button>
              )}
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

export function QuestionsTab() {
  const { t } = useTranslations('googleBusiness');

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useQuestions();

  const questions = data?.pages.flatMap((page) => page.questions) || [];
  const pendingCount = questions.filter((q: Question) => !q.topAnswers?.some((a) => a.author.type === 'MERCHANT')).length;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <EmptyState
        icon={<HelpCircle className="h-12 w-12" />}
        title={t('questions.empty')}
        description={t('questions.emptyDescription')}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center gap-4 mb-6">
        <Badge variant="info">{questions.length} {t('questions.total')}</Badge>
        {pendingCount > 0 && (
          <Badge variant="warning">{pendingCount} {t('questions.pendingAnswers')}</Badge>
        )}
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {questions.map((question: Question) => (
          <QuestionCard
            key={question.name}
            question={question}
            onAnswerSuccess={() => refetch()}
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
            {t('questions.loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
}
