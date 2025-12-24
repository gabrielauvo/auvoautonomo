import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Indique e Ganhe',
  description: 'Indique amigos para o Auvo Autônomo e ganhe meses grátis de assinatura. Cada amigo que assinar = 30 dias grátis pra você.',
  openGraph: {
    title: 'Indique e Ganhe | Auvo',
    description: 'Programa de indicação: ganhe 30 dias grátis para cada amigo que assinar',
  },
};

export default function ReferralLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
