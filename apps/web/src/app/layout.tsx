import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider, QueryProvider, ThemeProvider } from '@/context';
import { TranslationsProvider } from '@/i18n';
import { ProgressBar } from '@/components/ui';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

// URL base da aplicação (ajustar conforme ambiente)
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://auvo.app';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'Auvo - Sistema de Gestão de Serviços',
    template: '%s | Auvo',
  },
  description: 'Sistema completo de gestão para prestadores de serviços. Gerencie orçamentos, ordens de serviço, clientes, cobranças e muito mais em uma plataforma integrada.',
  keywords: [
    'gestão de serviços',
    'ordem de serviço',
    'orçamento online',
    'sistema para prestadores de serviço',
    'CRM',
    'gestão de clientes',
    'cobranças',
    'Auvo',
  ],
  authors: [{ name: 'Auvo' }],
  creator: 'Auvo',
  publisher: 'Auvo',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: baseUrl,
    siteName: 'Auvo',
    title: 'Auvo - Sistema de Gestão de Serviços',
    description: 'Sistema completo de gestão para prestadores de serviços. Gerencie orçamentos, ordens de serviço, clientes, cobranças e muito mais.',
    images: [
      {
        url: `${baseUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Auvo - Sistema de Gestão de Serviços',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Auvo - Sistema de Gestão de Serviços',
    description: 'Sistema completo de gestão para prestadores de serviços',
    images: [`${baseUrl}/og-image.png`],
    creator: '@auvoapp',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="light">
      <head></head>
      <body className={inter.className}>
        <ThemeProvider>
          <ProgressBar />
          <QueryProvider>
            <AuthProvider>
              <TranslationsProvider>
                {children}
              </TranslationsProvider>
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
