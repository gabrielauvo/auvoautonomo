/**
 * Components Module
 *
 * Exportação centralizada dos componentes.
 */

export { DrawerMenu, default as DrawerMenuDefault } from './DrawerMenu';
export { DrawerProvider, useDrawer } from './DrawerContext';
export { AppHeader, default as AppHeaderDefault } from './AppHeader';
export { OptimizedList, default as OptimizedListDefault } from './OptimizedList';
export { TrialBanner, default as TrialBannerDefault } from './TrialBanner';
export { ProgressiveImage, getThumbnailUrl, default as ProgressiveImageDefault } from './ProgressiveImage';
export {
  LazyWrapper,
  LazyLoad,
  ConditionalLazyLoad,
  createLazyComponent,
  preloadComponent,
  default as LazyComponentDefault,
} from './LazyComponent';
