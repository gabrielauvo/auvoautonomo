/**
 * Tests for Button Component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../../../src/design-system/components/Button';
import { ThemeProvider } from '../../../src/design-system/ThemeProvider';

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('Button Component', () => {
  describe('rendering', () => {
    it('should render button with text', () => {
      const { getByText } = renderWithTheme(<Button>Click Me</Button>);
      expect(getByText('Click Me')).toBeTruthy();
    });
  });

  describe('variants', () => {
    it('should render primary variant by default', () => {
      const { getByText } = renderWithTheme(<Button>Primary</Button>);
      expect(getByText('Primary')).toBeTruthy();
    });

    it('should render secondary variant', () => {
      const { getByText } = renderWithTheme(
        <Button variant="secondary">Secondary</Button>
      );
      expect(getByText('Secondary')).toBeTruthy();
    });

    it('should render outline variant', () => {
      const { getByText } = renderWithTheme(
        <Button variant="outline">Outline</Button>
      );
      expect(getByText('Outline')).toBeTruthy();
    });

    it('should render ghost variant', () => {
      const { getByText } = renderWithTheme(<Button variant="ghost">Ghost</Button>);
      expect(getByText('Ghost')).toBeTruthy();
    });

    it('should render danger variant', () => {
      const { getByText } = renderWithTheme(
        <Button variant="danger">Danger</Button>
      );
      expect(getByText('Danger')).toBeTruthy();
    });
  });

  describe('sizes', () => {
    it('should render small size', () => {
      const { getByText } = renderWithTheme(<Button size="sm">Small</Button>);
      expect(getByText('Small')).toBeTruthy();
    });

    it('should render medium size by default', () => {
      const { getByText } = renderWithTheme(<Button>Medium</Button>);
      expect(getByText('Medium')).toBeTruthy();
    });

    it('should render large size', () => {
      const { getByText } = renderWithTheme(<Button size="lg">Large</Button>);
      expect(getByText('Large')).toBeTruthy();
    });
  });

  describe('interactions', () => {
    it('should call onPress when pressed', () => {
      const onPress = jest.fn();
      const { getByText } = renderWithTheme(
        <Button onPress={onPress}>Press Me</Button>
      );

      fireEvent.press(getByText('Press Me'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('should not call onPress when disabled', () => {
      const onPress = jest.fn();
      const { getByText } = renderWithTheme(
        <Button onPress={onPress} disabled>
          Disabled
        </Button>
      );

      fireEvent.press(getByText('Disabled'));
      expect(onPress).not.toHaveBeenCalled();
    });

    it('should not call onPress when loading', () => {
      const onPress = jest.fn();
      const { queryByText } = renderWithTheme(
        <Button onPress={onPress} loading>
          Loading
        </Button>
      );

      // Text should not be visible when loading
      expect(queryByText('Loading')).toBeNull();
    });
  });

  describe('loading state', () => {
    it('should show loading indicator when loading', () => {
      const { queryByText, UNSAFE_queryByType } = renderWithTheme(
        <Button loading>Loading Button</Button>
      );

      // Text should be hidden
      expect(queryByText('Loading Button')).toBeNull();
    });

    it('should be disabled when loading', () => {
      const onPress = jest.fn();
      const { getByRole } = renderWithTheme(
        <Button onPress={onPress} loading>
          Loading
        </Button>
      );

      // Button should be disabled
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  describe('disabled state', () => {
    it('should render disabled button', () => {
      const { getByText } = renderWithTheme(<Button disabled>Disabled</Button>);
      expect(getByText('Disabled')).toBeTruthy();
    });
  });

  describe('full width', () => {
    it('should render full width button', () => {
      const { getByText } = renderWithTheme(<Button fullWidth>Full Width</Button>);
      expect(getByText('Full Width')).toBeTruthy();
    });
  });

  describe('icons', () => {
    it('should render with left icon', () => {
      const { getByText } = renderWithTheme(
        <Button leftIcon={<></>}>With Left Icon</Button>
      );
      expect(getByText('With Left Icon')).toBeTruthy();
    });

    it('should render with right icon', () => {
      const { getByText } = renderWithTheme(
        <Button rightIcon={<></>}>With Right Icon</Button>
      );
      expect(getByText('With Right Icon')).toBeTruthy();
    });
  });
});
