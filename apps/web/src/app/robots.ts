import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://auvo.app';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard/',
          '/clients/',
          '/quotes/',
          '/work-orders/',
          '/billing/',
          '/reports/',
          '/settings/',
          '/catalog/',
          '/schedule/',
          '/checklists/',
          '/payments/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
