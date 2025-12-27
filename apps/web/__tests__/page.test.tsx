import { render, screen } from '@testing-library/react';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

// Mock @/i18n
jest.mock('@/i18n', () => ({
  useTranslations: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        loading: 'Carregando...',
      };
      return translations[key] || key;
    },
    locale: 'pt-BR',
    setLocale: jest.fn(),
    isLoading: false,
  }),
}));

// Mock js-cookie
jest.mock('js-cookie', () => ({
  get: jest.fn(() => undefined), // No token = unauthenticated
}));

// Import after mocks
import Home from '@/app/page';

describe('Home Page', () => {
  it('should render loading state', () => {
    render(<Home />);
    const loadingText = screen.getByText(/Carregando.../i);
    expect(loadingText).toBeInTheDocument();
  });
});
