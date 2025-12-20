import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pagamento',
  description: 'Pagina de pagamento',
};

export default function PayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Layout publico simples, sem autenticacao
  return <>{children}</>;
}
