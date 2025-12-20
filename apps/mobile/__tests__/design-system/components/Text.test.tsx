/**
 * Tests for Text Component
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from '../../../src/design-system/components/Text';
import { ThemeProvider } from '../../../src/design-system/ThemeProvider';

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('Text Component', () => {
  describe('rendering', () => {
    it('should render children text', () => {
      const { getByText } = renderWithTheme(<Text>Hello World</Text>);
      expect(getByText('Hello World')).toBeTruthy();
    });

    it('should render with default variant (body)', () => {
      const { getByText } = renderWithTheme(<Text>Default Text</Text>);
      const text = getByText('Default Text');
      expect(text).toBeTruthy();
    });
  });

  describe('variants', () => {
    it('should render h1 variant', () => {
      const { getByText } = renderWithTheme(<Text variant="h1">Heading 1</Text>);
      const text = getByText('Heading 1');
      expect(text.props.style).toContainEqual(
        expect.objectContaining({ fontSize: 36 })
      );
    });

    it('should render h2 variant', () => {
      const { getByText } = renderWithTheme(<Text variant="h2">Heading 2</Text>);
      const text = getByText('Heading 2');
      expect(text.props.style).toContainEqual(
        expect.objectContaining({ fontSize: 30 })
      );
    });

    it('should render h3 variant', () => {
      const { getByText } = renderWithTheme(<Text variant="h3">Heading 3</Text>);
      const text = getByText('Heading 3');
      expect(text.props.style).toContainEqual(
        expect.objectContaining({ fontSize: 24 })
      );
    });

    it('should render h4 variant', () => {
      const { getByText } = renderWithTheme(<Text variant="h4">Heading 4</Text>);
      const text = getByText('Heading 4');
      expect(text.props.style).toContainEqual(
        expect.objectContaining({ fontSize: 20 })
      );
    });

    it('should render h5 variant', () => {
      const { getByText } = renderWithTheme(<Text variant="h5">Heading 5</Text>);
      const text = getByText('Heading 5');
      expect(text.props.style).toContainEqual(
        expect.objectContaining({ fontSize: 18 })
      );
    });

    it('should render body variant', () => {
      const { getByText } = renderWithTheme(<Text variant="body">Body Text</Text>);
      const text = getByText('Body Text');
      expect(text.props.style).toContainEqual(
        expect.objectContaining({ fontSize: 16 })
      );
    });

    it('should render bodySmall variant', () => {
      const { getByText } = renderWithTheme(
        <Text variant="bodySmall">Small Body</Text>
      );
      const text = getByText('Small Body');
      expect(text.props.style).toContainEqual(
        expect.objectContaining({ fontSize: 14 })
      );
    });

    it('should render caption variant', () => {
      const { getByText } = renderWithTheme(<Text variant="caption">Caption</Text>);
      const text = getByText('Caption');
      expect(text.props.style).toContainEqual(
        expect.objectContaining({ fontSize: 12 })
      );
    });

    it('should render label variant', () => {
      const { getByText } = renderWithTheme(<Text variant="label">Label</Text>);
      const text = getByText('Label');
      expect(text.props.style).toContainEqual(
        expect.objectContaining({ fontSize: 14 })
      );
    });
  });

  describe('colors', () => {
    it('should render with primary color by default', () => {
      const { getByText } = renderWithTheme(<Text>Primary Color</Text>);
      const text = getByText('Primary Color');
      expect(text.props.style).toContainEqual(
        expect.objectContaining({ color: '#1F2937' }) // text.primary from Auvo Design System
      );
    });

    it('should render with secondary color', () => {
      const { getByText } = renderWithTheme(
        <Text color="secondary">Secondary Color</Text>
      );
      const text = getByText('Secondary Color');
      expect(text.props.style).toContainEqual(
        expect.objectContaining({ color: '#6B7280' })
      );
    });

    it('should render with tertiary color', () => {
      const { getByText } = renderWithTheme(
        <Text color="tertiary">Tertiary Color</Text>
      );
      const text = getByText('Tertiary Color');
      expect(text.props.style).toContainEqual(
        expect.objectContaining({ color: '#9CA3AF' })
      );
    });

    it('should render with error color', () => {
      const { getByText } = renderWithTheme(<Text color="error">Error Text</Text>);
      const text = getByText('Error Text');
      expect(text.props.style).toContainEqual(
        expect.objectContaining({ color: '#EF4444' })
      );
    });

    it('should render with success color', () => {
      const { getByText } = renderWithTheme(
        <Text color="success">Success Text</Text>
      );
      const text = getByText('Success Text');
      expect(text.props.style).toContainEqual(
        expect.objectContaining({ color: '#10B981' }) // success.500 from Auvo Design System
      );
    });
  });

  describe('alignment', () => {
    it('should align left by default', () => {
      const { getByText } = renderWithTheme(<Text>Left Aligned</Text>);
      const text = getByText('Left Aligned');
      expect(text.props.style).toContainEqual(
        expect.objectContaining({ textAlign: 'left' })
      );
    });

    it('should align center', () => {
      const { getByText } = renderWithTheme(<Text align="center">Centered</Text>);
      const text = getByText('Centered');
      expect(text.props.style).toContainEqual(
        expect.objectContaining({ textAlign: 'center' })
      );
    });

    it('should align right', () => {
      const { getByText } = renderWithTheme(
        <Text align="right">Right Aligned</Text>
      );
      const text = getByText('Right Aligned');
      expect(text.props.style).toContainEqual(
        expect.objectContaining({ textAlign: 'right' })
      );
    });
  });

  describe('font weight', () => {
    it('should apply custom weight', () => {
      const { getByText } = renderWithTheme(<Text weight="bold">Bold Text</Text>);
      const text = getByText('Bold Text');
      expect(text.props.style).toContainEqual(
        expect.objectContaining({ fontWeight: '700' })
      );
    });

    it('should apply medium weight', () => {
      const { getByText } = renderWithTheme(
        <Text weight="medium">Medium Text</Text>
      );
      const text = getByText('Medium Text');
      expect(text.props.style).toContainEqual(
        expect.objectContaining({ fontWeight: '500' })
      );
    });
  });

  describe('custom styles', () => {
    it('should accept custom styles', () => {
      const { getByText } = renderWithTheme(
        <Text style={{ marginTop: 10 }}>Custom Style</Text>
      );
      const text = getByText('Custom Style');
      expect(text.props.style).toContainEqual(
        expect.objectContaining({ marginTop: 10 })
      );
    });
  });
});
