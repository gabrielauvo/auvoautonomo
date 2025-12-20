import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ordens de Serviço',
  description: 'Gerencie ordens de serviço, agende execuções, acompanhe status e registre conclusões de serviços.',
  openGraph: {
    title: 'Ordens de Serviço | Auvo',
    description: 'Gestão completa de ordens de serviço',
  },
};

export default function WorkOrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
