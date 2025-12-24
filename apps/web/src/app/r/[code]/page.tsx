import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// Validate referral code and get referrer info
async function validateReferralCode(code: string) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://monorepobackend-production.up.railway.app';
    const res = await fetch(`${apiUrl}/api/referral/validate/${code}`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      return null;
    }

    return await res.json();
  } catch {
    return null;
  }
}

// Register the click
async function registerClick(code: string, headers: Headers) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://monorepobackend-production.up.railway.app';
    const userAgent = headers.get('user-agent') || '';
    const ip = headers.get('x-forwarded-for')?.split(',')[0] || headers.get('x-real-ip') || '';

    const res = await fetch(`${apiUrl}/api/referral/click`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        userAgent,
        ipAddress: ip,
        referrer: headers.get('referer') || undefined,
      }),
      cache: 'no-store',
    });

    if (res.ok) {
      return await res.json();
    }
    return null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const data = await validateReferralCode(code);

  const referrerName = data?.referrerFirstName || 'Um amigo';

  return {
    title: `${referrerName} te convidou para o Auvo Autônomo`,
    description: 'Gerencie seu negócio de prestação de serviços de forma simples e profissional. Orçamentos, ordens de serviço, clientes e muito mais.',
    openGraph: {
      title: `${referrerName} te convidou para o Auvo Autônomo`,
      description: 'Gerencie seu negócio de prestação de serviços de forma simples e profissional.',
      type: 'website',
      images: ['/images/og-referral.png'],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${referrerName} te convidou para o Auvo Autônomo`,
      description: 'Gerencie seu negócio de prestação de serviços de forma simples e profissional.',
    },
  };
}

// Detect platform from user agent
function detectPlatform(userAgent: string): 'ios' | 'android' | 'web' {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'web';
}

export default async function ReferralLandingPage({ params, searchParams }: PageProps) {
  const { code } = await params;
  const query = await searchParams;
  const { headers } = await import('next/headers');
  const headersList = await headers();

  // Validate the referral code
  const referralData = await validateReferralCode(code);

  if (!referralData || !referralData.valid) {
    notFound();
  }

  // Register the click
  const clickData = await registerClick(code, headersList);
  const clickId = clickData?.clickId;

  const userAgent = headersList.get('user-agent') || '';
  const platform = detectPlatform(userAgent);

  // Store links
  const appStoreUrl = 'https://apps.apple.com/app/auvo-autonomo/id123456789'; // TODO: Update with real ID
  const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.auvo.autonomo';
  const webSignupUrl = `/signup?ref=${code}${clickId ? `&clickId=${clickId}` : ''}`;

  // Deep link URLs
  const deepLinkUrl = `auvoautonomo://referral?code=${code}${clickId ? `&clickId=${clickId}` : ''}`;
  const universalLinkUrl = `https://auvoautonomo.com/app/referral?code=${code}${clickId ? `&clickId=${clickId}` : ''}`;

  // If direct param is set, redirect to signup (for web users)
  if (query.direct === 'web') {
    redirect(webSignupUrl);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-purple-900">
      {/* Smart App Banner for iOS */}
      <meta name="apple-itunes-app" content={`app-id=123456789, app-argument=${deepLinkUrl}`} />

      {/* Auto-redirect script for mobile */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              var platform = '${platform}';
              var deepLink = '${deepLinkUrl}';
              var appStore = '${appStoreUrl}';
              var playStore = '${playStoreUrl}';
              var clickId = '${clickId || ''}';

              if (platform === 'ios' || platform === 'android') {
                // Try to open the app
                var start = Date.now();
                var timeout;

                function redirect() {
                  if (Date.now() - start < 2000) {
                    // App didn't open, go to store
                    var storeUrl = platform === 'ios' ? appStore : playStore;
                    if (clickId) {
                      storeUrl += (storeUrl.includes('?') ? '&' : '?') + 'referrer=' + encodeURIComponent('ref=${code}&clickId=' + clickId);
                    }
                    window.location.href = storeUrl;
                  }
                }

                // Add visibility change listener
                document.addEventListener('visibilitychange', function() {
                  if (document.hidden) {
                    clearTimeout(timeout);
                  }
                });

                // Try deep link
                window.location.href = deepLink;
                timeout = setTimeout(redirect, 1500);
              }
            })();
          `,
        }}
      />

      <div className="container mx-auto px-4 py-8 md:py-16">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-xl mb-6">
              <span className="text-4xl font-bold text-purple-600">A</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
              {referralData.referrerFirstName || 'Um amigo'} te convidou!
            </h1>
            <p className="text-lg text-purple-100">
              Experimente o Auvo Autônomo e gerencie seu negócio de forma profissional
            </p>
          </div>

          {/* Main Card */}
          <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 mb-8">
            {/* Benefits */}
            <div className="space-y-4 mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Com o Auvo Autônomo você pode:
              </h2>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-gray-700">Criar orçamentos profissionais em segundos</p>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-gray-700">Gerenciar ordens de serviço no celular</p>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-gray-700">Controlar clientes, equipamentos e histórico</p>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-gray-700">Acompanhar finanças e relatórios</p>
              </div>
            </div>

            {/* Trial Badge */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-green-800">7 dias grátis</p>
                  <p className="text-sm text-green-600">Teste todas as funcionalidades sem compromisso</p>
                </div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="space-y-3">
              {/* Mobile: Show app store buttons */}
              {platform !== 'web' && (
                <>
                  {platform === 'ios' ? (
                    <a
                      href={appStoreUrl}
                      className="flex items-center justify-center gap-3 w-full bg-black text-white rounded-xl py-4 px-6 font-semibold hover:bg-gray-800 transition-colors"
                    >
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                      </svg>
                      Baixar na App Store
                    </a>
                  ) : (
                    <a
                      href={`${playStoreUrl}&referrer=${encodeURIComponent(`ref=${code}${clickId ? `&clickId=${clickId}` : ''}`)}`}
                      className="flex items-center justify-center gap-3 w-full bg-black text-white rounded-xl py-4 px-6 font-semibold hover:bg-gray-800 transition-colors"
                    >
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                      </svg>
                      Baixar no Google Play
                    </a>
                  )}
                </>
              )}

              {/* Web signup button */}
              <Link
                href={webSignupUrl}
                className={`flex items-center justify-center gap-2 w-full rounded-xl py-4 px-6 font-semibold transition-colors ${
                  platform === 'web'
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {platform === 'web' ? 'Criar conta grátis' : 'Continuar no navegador'}
              </Link>
            </div>
          </div>

          {/* Referral Code Display */}
          <div className="text-center">
            <p className="text-purple-200 text-sm mb-2">Código de indicação:</p>
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
              <span className="font-mono font-bold text-white text-lg tracking-wider">{code}</span>
            </div>
            <p className="text-purple-300 text-xs mt-2">
              Use este código ao criar sua conta para ativar o benefício
            </p>
          </div>

          {/* Footer */}
          <div className="mt-12 text-center">
            <p className="text-purple-200 text-sm">
              Ao criar uma conta, você concorda com nossos{' '}
              <a href="/terms" className="underline hover:text-white">Termos de Uso</a>
              {' '}e{' '}
              <a href="/privacy" className="underline hover:text-white">Política de Privacidade</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
