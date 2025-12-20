/**
 * Tests for Badge Component
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Badge } from '../../../src/design-system/components/Badge';
import { ThemeProvider } from '../../../src/design-system/ThemeProvider';

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('Badge Component', () => {
  describe('rendering', () => {
    it('should render badge with text', () => {
      const { getByText } = renderWithTheme(<Badge>Active</Badge>);
      expect(getByText('Active')).toBeTruthy();
    });
  });

  describe('variants', () => {
    it('should render primary variant by default', () => {
      const { getByText } = renderWithTheme(<Badge>Primary</Badge>);
      expect(getByText('Primary')).toBeTruthy();
    });

    it('should render secondary variant', () => {
      const { getByText } = renderWithTheme(
        <Badge variant="secondary">Secondary</Badge>
      );
      expect(getByText('Secondary')).toBeTruthy();
    });

    it('should render success variant', () => {
      const { getByText } = renderWithTheme(
        <Badge variant="success">Success</Badge>
      );
      expect(getByText('Success')).toBeTruthy();
    });

    it('should render warning variant', () => {
      const { getByText } = renderWithTheme(
        <Badge variant="warning">Warning</Badge>
      );
      expect(getByText('Warning')).toBeTruthy();
    });

    it('should render error variant', () => {
      const { getByText } = renderWithTheme(<Badge variant="error">Error</Badge>);
      expect(getByText('Error')).toBeTruthy();
    });

    it('should render info variant', () => {
      const { getByText } = renderWithTheme(<Badge variant="info">Info</Badge>);
      expect(getByText('Info')).toBeTruthy();
    });
  });

  describe('sizes', () => {
    it('should render medium size by default', () => {
      const { getByText } = renderWithTheme(<Badge>Medium</Badge>);
      expect(getByText('Medium')).toBeTruthy();
    });

    it('should render small size', () => {
      const { getByText } = renderWithTheme(<Badge size="sm">Small</Badge>);
      expect(getByText('Small')).toBeTruthy();
    });
  });
});
