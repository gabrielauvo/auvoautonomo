/**
 * Tests for Avatar Component
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Avatar } from '../../../src/design-system/components/Avatar';
import { ThemeProvider } from '../../../src/design-system/ThemeProvider';

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('Avatar Component', () => {
  describe('rendering', () => {
    it('should render avatar with initials', () => {
      const { getByText } = renderWithTheme(<Avatar name="John Doe" />);
      expect(getByText('JD')).toBeTruthy();
    });

    it('should render question mark for empty name', () => {
      const { getByText } = renderWithTheme(<Avatar />);
      expect(getByText('?')).toBeTruthy();
    });

    it('should render single initial for single name', () => {
      const { getByText } = renderWithTheme(<Avatar name="John" />);
      expect(getByText('J')).toBeTruthy();
    });

    it('should render first and last initials for multiple names', () => {
      const { getByText } = renderWithTheme(
        <Avatar name="John Michael Doe Smith" />
      );
      expect(getByText('JS')).toBeTruthy();
    });
  });

  describe('sizes', () => {
    it('should render extra small size', () => {
      const { getByText } = renderWithTheme(<Avatar name="John" size="xs" />);
      expect(getByText('J')).toBeTruthy();
    });

    it('should render small size', () => {
      const { getByText } = renderWithTheme(<Avatar name="John" size="sm" />);
      expect(getByText('J')).toBeTruthy();
    });

    it('should render medium size by default', () => {
      const { getByText } = renderWithTheme(<Avatar name="John" />);
      expect(getByText('J')).toBeTruthy();
    });

    it('should render large size', () => {
      const { getByText } = renderWithTheme(<Avatar name="John" size="lg" />);
      expect(getByText('J')).toBeTruthy();
    });

    it('should render extra large size', () => {
      const { getByText } = renderWithTheme(<Avatar name="John" size="xl" />);
      expect(getByText('J')).toBeTruthy();
    });
  });

  describe('with image', () => {
    it('should render image when src is provided', () => {
      const { queryByText } = renderWithTheme(
        <Avatar name="John" src="https://example.com/avatar.jpg" />
      );
      // Initials should not be visible when image is shown
      expect(queryByText('J')).toBeNull();
    });
  });

  describe('initials logic', () => {
    it('should handle lowercase names', () => {
      const { getByText } = renderWithTheme(<Avatar name="john doe" />);
      expect(getByText('JD')).toBeTruthy();
    });

    it('should handle names with extra spaces', () => {
      const { getByText } = renderWithTheme(<Avatar name="  John   Doe  " />);
      expect(getByText('JD')).toBeTruthy();
    });

    it('should handle undefined name', () => {
      const { getByText } = renderWithTheme(<Avatar name={undefined} />);
      expect(getByText('?')).toBeTruthy();
    });

    it('should handle empty string name', () => {
      const { getByText } = renderWithTheme(<Avatar name="" />);
      expect(getByText('?')).toBeTruthy();
    });
  });
});
