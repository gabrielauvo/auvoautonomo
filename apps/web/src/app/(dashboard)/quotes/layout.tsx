import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Orçamentos',
  description: 'Crie e gerencie orçamentos profissionais, envie propostas para clientes e acompanhe aprovações.',
  openGraph: {
    title: 'Orçamentos | Auvo',
    description: 'Criação e gestão de orçamentos profissionais',
  },
};

export default function QuotesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
