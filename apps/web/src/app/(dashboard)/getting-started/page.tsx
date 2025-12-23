'use client';

/**
 * Getting Started Page - Comece Aqui
 *
 * Tutorial de onboarding para os primeiros 90 dias do usuário.
 * Exibe checklist de tarefas e recursos de ajuda.
 * Inclui gamificação com animações ao completar tarefas.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
} from '@/components/ui';
import {
  Check,
  Circle,
  ChevronRight,
  Smartphone,
  Users,
  FileText,
  Receipt,
  Wallet,
  CreditCard,
  MessageCircle,
  HelpCircle,
  Calendar,
  ExternalLink,
  PlayCircle,
  Sparkles,
  Trophy,
  Star,
} from 'lucide-react';

// Tipo para item do checklist
interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  href?: string;
  externalLinks?: { label: string; url: string; icon?: React.ReactNode }[];
  completed: boolean;
}

// Chave do localStorage para salvar progresso
const ONBOARDING_STORAGE_KEY = 'auvo_onboarding_progress';

// Componente de confete/celebração
function Confetti({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {[...Array(50)].map((_, i) => (
        <div
          key={i}
          className="absolute animate-confetti"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 0.5}s`,
            backgroundColor: ['#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#3B82F6'][
              Math.floor(Math.random() * 5)
            ],
          }}
        />
      ))}
      <style jsx>{`
        @keyframes confetti {
          0% {
            transform: translateY(-10vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          width: 10px;
          height: 10px;
          animation: confetti 3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

// Componente de toast de celebração
function CelebrationToast({
  show,
  message,
  onClose
}: {
  show: boolean;
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-bounce-in">
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3">
        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
          <Trophy className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold">{message}</p>
          <p className="text-sm text-white/80">Continue assim!</p>
        </div>
        <div className="flex gap-1 ml-2">
          <Star className="h-4 w-4 text-yellow-300 animate-pulse" />
          <Star className="h-4 w-4 text-yellow-300 animate-pulse" style={{ animationDelay: '0.1s' }} />
          <Star className="h-4 w-4 text-yellow-300 animate-pulse" style={{ animationDelay: '0.2s' }} />
        </div>
      </div>
      <style jsx>{`
        @keyframes bounce-in {
          0% {
            transform: translateY(100px) scale(0.8);
            opacity: 0;
          }
          50% {
            transform: translateY(-10px) scale(1.05);
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        .animate-bounce-in {
          animation: bounce-in 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

export default function GettingStartedPage() {
  const { user } = useAuth();
  const [completedItems, setCompletedItems] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState('');
  const [showCelebration, setShowCelebration] = useState(false);
  const [animatingItem, setAnimatingItem] = useState<string | null>(null);

  // Carregar progresso do localStorage
  useEffect(() => {
    const saved = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (saved) {
      try {
        setCompletedItems(JSON.parse(saved));
      } catch {
        setCompletedItems([]);
      }
    }
    setIsLoading(false);
  }, []);

  // Mensagens de celebração
  const celebrationMessages = [
    'Excelente trabalho!',
    'Muito bem!',
    'Você está arrasando!',
    'Fantástico!',
    'Parabéns!',
    'Incrível!',
  ];

  // Salvar progresso no localStorage com animação
  const toggleItem = useCallback((itemId: string, itemTitle: string) => {
    setCompletedItems((prev) => {
      const wasCompleted = prev.includes(itemId);
      const newItems = wasCompleted
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId];

      localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(newItems));

      // Se está marcando como completo, mostrar celebração
      if (!wasCompleted) {
        setAnimatingItem(itemId);
        setTimeout(() => setAnimatingItem(null), 600);

        // Mostrar confete
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);

        // Mostrar toast de celebração
        const randomMessage = celebrationMessages[Math.floor(Math.random() * celebrationMessages.length)];
        setCelebrationMessage(randomMessage);
        setShowCelebration(true);
      }

      return newItems;
    });
  }, []);

  // Calcular dias desde criação da conta
  const daysSinceCreation = user?.createdAt
    ? Math.floor(
        (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      )
    : 0;
  const daysRemaining = Math.max(0, 90 - daysSinceCreation);

  // Itens do checklist
  const checklistItems: ChecklistItem[] = [
    {
      id: 'download-app',
      title: 'Baixe o aplicativo',
      description:
        'Acesse suas informações de qualquer lugar com o app Auvo Field.',
      icon: <Smartphone className="h-5 w-5" />,
      externalLinks: [
        {
          label: 'Google Play',
          url: 'https://play.google.com/store/apps/details?id=com.auvo.field',
          icon: <ExternalLink className="h-4 w-4" />,
        },
        {
          label: 'App Store',
          url: 'https://apps.apple.com/app/auvo-field/id123456789',
          icon: <ExternalLink className="h-4 w-4" />,
        },
      ],
      completed: completedItems.includes('download-app'),
    },
    {
      id: 'add-client',
      title: 'Cadastre um cliente',
      description:
        'Adicione seu primeiro cliente para gerenciar casos e cobranças.',
      icon: <Users className="h-5 w-5" />,
      href: '/clients/new',
      completed: completedItems.includes('add-client'),
    },
    {
      id: 'create-quote',
      title: 'Cadastre um orçamento',
      description:
        'Crie orçamentos profissionais e envie para aprovação dos clientes.',
      icon: <FileText className="h-5 w-5" />,
      href: '/quotes/new',
      completed: completedItems.includes('create-quote'),
    },
    {
      id: 'create-charge',
      title: 'Cadastre uma cobrança',
      description: 'Registre cobranças e acompanhe os pagamentos dos clientes.',
      icon: <Receipt className="h-5 w-5" />,
      href: '/billing/charges/new',
      completed: completedItems.includes('create-charge'),
    },
    {
      id: 'add-expense',
      title: 'Cadastre uma despesa',
      description:
        'Controle suas despesas e tenha visão completa do financeiro.',
      icon: <Wallet className="h-5 w-5" />,
      href: '/billing/expenses/new',
      completed: completedItems.includes('add-expense'),
    },
    {
      id: 'setup-asaas',
      title: 'Emita cobranças com o Asaas',
      description:
        'Integre com o Asaas para emitir boletos, Pix e cartão automaticamente.',
      icon: <CreditCard className="h-5 w-5" />,
      href: '/settings/integrations',
      completed: completedItems.includes('setup-asaas'),
    },
  ];

  const completedCount = checklistItems.filter((item) =>
    completedItems.includes(item.id)
  ).length;
  const progressPercent = Math.round(
    (completedCount / checklistItems.length) * 100
  );

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-gray-200 rounded" />
          <div className="h-4 w-96 bg-gray-200 rounded" />
          <div className="h-64 bg-gray-200 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Efeitos de celebração */}
      <Confetti show={showConfetti} />
      <CelebrationToast
        show={showCelebration}
        message={celebrationMessage}
        onClose={() => setShowCelebration(false)}
      />

    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">
          Comece a usar o Auvo
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Complete as etapas abaixo para aproveitar ao máximo todas as
          funcionalidades do sistema.
        </p>
      </div>

      {/* Progress Card */}
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Seu progresso</h3>
              <p className="text-sm text-gray-500">
                {completedCount} de {checklistItems.length} etapas concluídas
              </p>
            </div>
            {daysRemaining > 0 && (
              <div className="text-right">
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <Calendar className="h-4 w-4" />
                  <span>{daysRemaining} dias restantes</span>
                </div>
              </div>
            )}
          </div>
          {/* Progress bar */}
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Checklist de configuração</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100">
            {checklistItems.map((item) => (
              <div
                key={item.id}
                className={`flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors ${
                  completedItems.includes(item.id) ? 'bg-green-50/50' : ''
                }`}
              >
                {/* Checkbox com animação */}
                <button
                  onClick={() => toggleItem(item.id, item.title)}
                  className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                    completedItems.includes(item.id)
                      ? 'bg-green-500 border-green-500 text-white scale-110'
                      : 'border-gray-300 hover:border-primary hover:scale-105'
                  } ${animatingItem === item.id ? 'animate-ping-once' : ''}`}
                  style={{
                    animation: animatingItem === item.id ? 'checkmark-pop 0.6s ease-out' : undefined
                  }}
                >
                  {completedItems.includes(item.id) && (
                    <Check className="h-4 w-4" />
                  )}
                </button>
                <style jsx>{`
                  @keyframes checkmark-pop {
                    0% { transform: scale(1); }
                    30% { transform: scale(1.4); }
                    50% { transform: scale(0.9); }
                    70% { transform: scale(1.1); }
                    100% { transform: scale(1.1); }
                  }
                `}</style>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`${
                        completedItems.includes(item.id)
                          ? 'text-gray-400'
                          : 'text-primary'
                      }`}
                    >
                      {item.icon}
                    </span>
                    <h4
                      className={`font-medium ${
                        completedItems.includes(item.id)
                          ? 'text-gray-400 line-through'
                          : 'text-gray-900'
                      }`}
                    >
                      {item.title}
                    </h4>
                  </div>
                  <p
                    className={`text-sm mt-1 ${
                      completedItems.includes(item.id)
                        ? 'text-gray-400'
                        : 'text-gray-600'
                    }`}
                  >
                    {item.description}
                  </p>

                  {/* Action buttons */}
                  {!completedItems.includes(item.id) && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {item.href && (
                        <Link href={item.href}>
                          <Button size="sm" variant="outline">
                            Começar
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </Link>
                      )}
                      {item.externalLinks?.map((link) => (
                        <a
                          key={link.url}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button size="sm" variant="outline">
                            {link.label}
                            {link.icon && <span className="ml-1">{link.icon}</span>}
                          </Button>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* Chevron */}
                {item.href && !completedItems.includes(item.id) && (
                  <Link href={item.href} className="flex-shrink-0">
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Resources Section */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Explore mais
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Central de Ajuda */}
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <HelpCircle className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Central de Ajuda
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Encontre tutoriais, guias e respostas para suas dúvidas sobre o
                sistema.
              </p>
              <a
                href="https://ajuda.auvo.com.br"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1"
              >
                Acessar
                <ExternalLink className="h-3 w-3" />
              </a>
            </CardContent>
          </Card>

          {/* Suporte Online */}
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <MessageCircle className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Suporte Online
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Fale com nossa equipe de suporte para tirar dúvidas ou resolver
                problemas.
              </p>
              <a
                href="https://wa.me/5511999999999"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1"
              >
                Iniciar conversa
                <ExternalLink className="h-3 w-3" />
              </a>
            </CardContent>
          </Card>

          {/* Video Tutorial */}
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <PlayCircle className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Aprenda o Básico
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Assista ao vídeo tutorial e aprenda a usar o sistema em poucos
                minutos.
              </p>
              <a
                href="https://youtube.com/watch?v=tutorial"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1"
              >
                Assistir vídeo
                <ExternalLink className="h-3 w-3" />
              </a>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Completion message */}
      {completedCount === checklistItems.length && (
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <CardContent className="py-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Trophy className="h-10 w-10 text-white" />
            </div>
            <div className="flex justify-center gap-1 mb-4">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-6 w-6 text-yellow-400 fill-yellow-400" />
              ))}
            </div>
            <h3 className="text-2xl font-bold text-green-900 mb-2">
              Parabéns! Você completou todas as etapas!
            </h3>
            <p className="text-green-700 mb-6">
              Agora você está pronto para aproveitar ao máximo o Auvo.
            </p>
            <Link href="/dashboard">
              <Button size="lg" className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700">
                <Sparkles className="h-5 w-5 mr-2" />
                Ir para o Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
    </>
  );
}
