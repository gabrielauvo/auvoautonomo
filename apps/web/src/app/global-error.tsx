'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full text-center">
            <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-red-100 mb-6">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Erro Critico
            </h1>

            <p className="text-gray-600 mb-8">
              Ocorreu um erro inesperado. Por favor, recarregue a pagina.
            </p>

            <button
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Recarregar pagina
            </button>

            {process.env.NODE_ENV === 'development' && error.message && (
              <div className="mt-8 p-4 bg-gray-100 rounded-lg text-left">
                <p className="text-sm font-mono text-gray-600 break-all">
                  {error.message}
                </p>
              </div>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
