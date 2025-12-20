import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://auvo.app';

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 1,
    },
    // Páginas públicas podem ser adicionadas aqui conforme necessário
    // As páginas privadas (dashboard, etc) não devem estar no sitemap
  ];
}
