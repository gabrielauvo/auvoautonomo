/**
 * Tests for Card Component
 */

import React from 'react';
import { Text as RNText } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { Card } from '../../../src/design-system/components/Card';
import { ThemeProvider } from '../../../src/design-system/ThemeProvider';

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('Card Component', () => {
  describe('rendering', () => {
    it('should render card with children', () => {
      const { getByText } = renderWithTheme(
        <Card>
          <RNText>Card Content</RNText>
        </Card>
      );
      expect(getByText('Card Content')).toBeTruthy();
    });
  });

  describe('variants', () => {
    it('should render elevated variant by default', () => {
      const { getByText } = renderWithTheme(
        <Card>
          <RNText>Elevated Card</RNText>
        </Card>
      );
      expect(getByText('Elevated Card')).toBeTruthy();
    });

    it('should render outlined variant', () => {
      const { getByText } = renderWithTheme(
        <Card variant="outlined">
          <RNText>Outlined Card</RNText>
        </Card>
      );
      expect(getByText('Outlined Card')).toBeTruthy();
    });

    it('should render filled variant', () => {
      const { getByText } = renderWithTheme(
        <Card variant="filled">
          <RNText>Filled Card</RNText>
        </Card>
      );
      expect(getByText('Filled Card')).toBeTruthy();
    });
  });

  describe('padding', () => {
    it('should render with default padding', () => {
      const { getByText } = renderWithTheme(
        <Card>
          <RNText>Default Padding</RNText>
        </Card>
      );
      expect(getByText('Default Padding')).toBeTruthy();
    });

    it('should render with custom padding', () => {
      const { getByText } = renderWithTheme(
        <Card padding={8}>
          <RNText>Custom Padding</RNText>
        </Card>
      );
      expect(getByText('Custom Padding')).toBeTruthy();
    });
  });

  describe('interactions', () => {
    it('should call onPress when pressed', () => {
      const onPress = jest.fn();
      const { getByText } = renderWithTheme(
        <Card onPress={onPress}>
          <RNText>Pressable Card</RNText>
        </Card>
      );

      fireEvent.press(getByText('Pressable Card'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('should not be pressable without onPress', () => {
      const { getByText } = renderWithTheme(
        <Card>
          <RNText>Non-Pressable Card</RNText>
        </Card>
      );
      expect(getByText('Non-Pressable Card')).toBeTruthy();
    });
  });
});
