import Link from 'next/link';
import Image from 'next/image';

export default function ReferralNotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-purple-900 flex items-center justify-center">
      <div className="container mx-auto px-4">
        <div className="max-w-md mx-auto text-center">
          {/* Logo */}
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-xl mb-8">
            <Image
              src="/images/logo-icon.png"
              alt="Auvo Autônomo"
              width={48}
              height={48}
              className="w-12 h-12"
            />
          </div>

          {/* Error Message */}
          <div className="bg-white rounded-3xl shadow-2xl p-8 mb-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              Link de indicação inválido
            </h1>
            <p className="text-gray-600 mb-6">
              Este código de indicação não existe ou não está mais ativo.
              Verifique o link com quem te indicou.
            </p>

            <div className="space-y-3">
              <Link
                href="/signup"
                className="flex items-center justify-center gap-2 w-full bg-purple-600 text-white rounded-xl py-4 px-6 font-semibold hover:bg-purple-700 transition-colors"
              >
                Criar conta mesmo assim
              </Link>

              <Link
                href="/"
                className="flex items-center justify-center gap-2 w-full bg-gray-100 text-gray-700 rounded-xl py-4 px-6 font-semibold hover:bg-gray-200 transition-colors"
              >
                Ir para a página inicial
              </Link>
            </div>
          </div>

          {/* Help Text */}
          <p className="text-purple-200 text-sm">
            Tem um código de indicação?{' '}
            <Link href="/signup" className="underline hover:text-white">
              Insira manualmente ao criar sua conta
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
