/**
 * ProDesign Design System
 *
 * Exportação principal do design system.
 */

// Tokens
export {
  theme,
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  zIndex,
  animation,
} from './tokens';
export type {
  Theme,
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
  ZIndex,
} from './tokens';

// Theme Provider
export {
  ThemeProvider,
  useTheme,
  useColors,
  useSpacing,
  useTypography,
  useShadows,
  useBorderRadius,
} from './ThemeProvider';

// Components
export {
  Text,
  Button,
  Input,
  Card,
  Badge,
  Avatar,
  Divider,
  Skeleton,
  SkeletonText,
  SkeletonCard,
} from './components';
