import { getRequestConfig } from 'next-intl/server';
import { Locale, defaultLocale, locales } from './config';

export default getRequestConfig(async ({ requestLocale }) => {
  // This is called for every request, so we need to get the locale from the request
  let locale = await requestLocale;

  // Ensure that a valid locale is used
  if (!locale || !locales.includes(locale as Locale)) {
    locale = defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
