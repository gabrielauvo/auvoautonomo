'use client';

import * as Sentry from '@sentry/nextjs';

export default function SentryExamplePage() {
  const triggerError = () => {
    throw new Error('Sentry Test Error - Configuracao funcionando!');
  };

  const triggerCapturedError = () => {
    try {
      throw new Error('Sentry Captured Error - Este erro foi capturado manualmente');
    } catch (error) {
      Sentry.captureException(error);
      alert('Erro capturado e enviado ao Sentry!');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Teste do Sentry
        </h1>
        <p className="text-gray-600 mb-6">
          Clique em um dos botoes abaixo para testar a integracao com o Sentry.
        </p>

        <div className="space-y-4">
          <button
            onClick={triggerCapturedError}
            className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Enviar erro capturado
          </button>

          <button
            onClick={triggerError}
            className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Disparar erro nao tratado
          </button>
        </div>

        <p className="text-sm text-gray-500 mt-6">
          Apos clicar, verifique o dashboard do Sentry para ver o erro registrado.
        </p>
      </div>
    </div>
  );
}
