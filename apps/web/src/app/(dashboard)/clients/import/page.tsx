'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Crown, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ImportWizard } from '@/components/clients/import-wizard';
import { useAuth } from '@/context/auth-context';

export default function ClientsImportPage() {
  const router = useRouter();
  const { billing, isLoading } = useAuth();

  // Com o novo modelo, tanto TRIAL quanto PRO têm acesso completo
  const isPro = billing?.planKey === 'PRO' || billing?.planKey === 'TRIAL';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // Show upgrade message for non-PRO users
  if (!isPro) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="text-center space-y-6">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center">
            <Crown className="h-10 w-10 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Recurso exclusivo PRO
            </h1>
            <p className="mt-2 text-gray-500 max-w-md mx-auto">
              A importação em massa de clientes é um recurso exclusivo do plano
              PRO. Faça upgrade para importar centenas de clientes de uma vez.
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 text-left max-w-md mx-auto">
            <h3 className="font-medium text-gray-900 mb-3">
              Com o plano PRO você pode:
            </h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center">
                <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full mr-2" />
                Importar até 1.000 clientes por arquivo
              </li>
              <li className="flex items-center">
                <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full mr-2" />
                Usar arquivos Excel ou CSV
              </li>
              <li className="flex items-center">
                <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full mr-2" />
                Validação automática de CPF/CNPJ
              </li>
              <li className="flex items-center">
                <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full mr-2" />
                Relatório detalhado de erros
              </li>
            </ul>
          </div>

          <div className="flex justify-center space-x-4">
            <Link href="/clients">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para Clientes
              </Button>
            </Link>
            <Link href="/settings/billing">
              <Button>
                <Crown className="h-4 w-4 mr-2" />
                Fazer Upgrade
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/clients"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar para Clientes
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Importar Clientes</h1>
        <p className="mt-1 text-sm text-gray-500">
          Importe clientes em massa usando um arquivo Excel ou CSV.
        </p>
      </div>

      {/* Wizard */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <ImportWizard onComplete={() => router.push('/clients')} />
      </div>

      {/* Info box */}
      <div className="mt-6 bg-blue-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">
          Dicas para uma importação bem-sucedida:
        </h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>
            - Baixe e use nosso arquivo modelo para garantir o formato correto
          </li>
          <li>- Preencha os campos obrigatórios: Nome, CPF/CNPJ e Telefone</li>
          <li>- Limite de 1.000 clientes por arquivo</li>
          <li>- CPF/CNPJ duplicados atualizarão os dados existentes</li>
        </ul>
      </div>
    </div>
  );
}
