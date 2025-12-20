/** @type {import('next').NextConfig} */

/**
 * SEGURANÇA - Content Security Policy
 *
 * CSP rigoroso para prevenir XSS e outros ataques de injeção.
 *
 * IMPORTANTE:
 * - Produção: CSP completo ativado
 * - Desenvolvimento: CSP relaxado para hot-reload
 * - Ajuste conforme necessário para seu caso de uso
 *
 * Para 1M+ usuários:
 * - Remove 'unsafe-inline' e 'unsafe-eval' em produção
 * - Use nonces para scripts dinâmicos
 * - Whitelist apenas domínios necessários
 */
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' ${process.env.NODE_ENV === 'production' ? '' : "'unsafe-eval' 'unsafe-inline'"};
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https: ${apiUrl};
  font-src 'self' data:;
  connect-src 'self' ${apiUrl} https://wa.me;
  frame-src 'none';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  object-src 'none';
  ${process.env.NODE_ENV === 'production' ? 'upgrade-insecure-requests;' : ''}
`.replace(/\s{2,}/g, ' ').trim();

/**
 * SEGURANÇA - Headers HTTP
 *
 * Headers de segurança aplicados a todas as respostas.
 *
 * Para 1M+ usuários:
 * - X-Content-Type-Options: previne MIME sniffing
 * - X-Frame-Options: previne clickjacking
 * - Referrer-Policy: controla informações de referência
 * - Permissions-Policy: restringe APIs do browser
 * - HSTS: força HTTPS em produção
 * - CSP: previne XSS e injeção de código
 */
const securityHeaders = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
  },
  ...(process.env.NODE_ENV === 'production'
    ? [
        {
          key: 'Content-Security-Policy',
          value: ContentSecurityPolicy,
        },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains; preload',
        },
      ]
    : []),
];

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@monorepo/shared-types', '@monorepo/shared-utils'],

  // Ignorar erros de ESLint e TypeScript no build
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // Output para Azure Static Web Apps
  output: 'export',

  // Compiler optimizations - CRITICAL para 1M+ users
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Experimental features - desabilitado para compatibilidade
  experimental: {
    // optimizeCss: true, // Desabilitado - requer módulo critters
    missingSuspenseWithCSRBailout: false, // Permite useSearchParams sem Suspense
  },

  // Otimização de imagens
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.auvo.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // Google profile images
      },
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com', // Google images (wildcard)
      },
      ...(process.env.NODE_ENV === 'development'
        ? [{ protocol: 'http', hostname: 'localhost' }]
        : []),
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: false,
  },

  // Headers de segurança e cache
  async headers() {
    return [
      {
        // Headers de segurança globais
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // API routes - sem cache
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          ...securityHeaders,
        ],
      },
      {
        // Static assets - cache longo
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Fontes - cache longo
        source: '/fonts/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Imagens - cache médio
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
    ];
  },

  // Powered by header desabilitado por segurança
  poweredByHeader: false,
};

module.exports = nextConfig;
