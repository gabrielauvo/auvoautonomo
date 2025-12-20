import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Clientes',
  description: 'Gerencie seus clientes, cadastre novos contatos, visualize histórico de orçamentos e ordens de serviço.',
  openGraph: {
    title: 'Clientes | Auvo',
    description: 'Gestão completa de clientes para seu negócio',
  },
};

export default function ClientsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
