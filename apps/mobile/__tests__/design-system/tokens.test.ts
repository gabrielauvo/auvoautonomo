/**
 * Tests for Design System Tokens
 *
 * IMPORTANTE: Estes testes verificam conformidade com o Design System Auvo
 * Valores devem ser IDÊNTICOS aos do web (apps/web/src/lib/design-tokens.ts)
 */

import {
  theme,
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  zIndex,
  animation,
} from '../../src/design-system/tokens';

describe('Design System Tokens', () => {
  describe('colors', () => {
    it('should have Auvo brand color palette', () => {
      expect(colors.auvo).toBeDefined();
      expect(colors.auvo[600]).toBe('#7C3AED'); // Logo color
      expect(colors.auvo[500]).toBe('#8B5CF6');
    });

    it('should have primary color palette (Auvo Purple)', () => {
      expect(colors.primary).toBeDefined();
      expect(colors.primary[500]).toBe('#8B5CF6');  // Auvo purple
      expect(colors.primary[600]).toBe('#7C3AED');  // Logo color
      expect(colors.primary[50]).toBe('#F5F3FF');
      expect(colors.primary[900]).toBe('#4C1D95');
    });

    it('should have secondary color palette (Cyan/Teal)', () => {
      expect(colors.secondary).toBeDefined();
      expect(colors.secondary[500]).toBe('#06B6D4');
    });

    it('should have gray color palette', () => {
      expect(colors.gray).toBeDefined();
      expect(colors.gray[500]).toBe('#6B7280');
    });

    it('should have success color palette', () => {
      expect(colors.success).toBeDefined();
      expect(colors.success[500]).toBe('#10B981');
    });

    it('should have warning color palette', () => {
      expect(colors.warning).toBeDefined();
      expect(colors.warning[500]).toBe('#F59E0B');
    });

    it('should have error color palette', () => {
      expect(colors.error).toBeDefined();
      expect(colors.error[500]).toBe('#EF4444');
    });

    it('should have info color palette (Blue)', () => {
      expect(colors.info).toBeDefined();
      expect(colors.info[500]).toBe('#3B82F6');
    });

    it('should have semantic background colors', () => {
      expect(colors.background.primary).toBe('#FFFFFF');
      expect(colors.background.secondary).toBe('#F3F4F6');
      expect(colors.background.tertiary).toBe('#F9FAFB');
    });

    it('should have semantic text colors', () => {
      expect(colors.text.primary).toBe('#1F2937');
      expect(colors.text.secondary).toBe('#6B7280');
      expect(colors.text.tertiary).toBe('#9CA3AF');
      expect(colors.text.inverse).toBe('#FFFFFF');
    });

    it('should have border colors', () => {
      expect(colors.border.light).toBe('#F3F4F6');
      expect(colors.border.default).toBe('#E5E7EB');
      expect(colors.border.dark).toBe('#D1D5DB');
    });
  });

  describe('typography', () => {
    it('should have font family definitions', () => {
      expect(typography.fontFamily.primary).toBe('System');
      expect(typography.fontFamily.secondary).toBe('System');
      expect(typography.fontFamily.mono).toBe('monospace');
      expect(typography.fontFamily.sans).toBe('System');
    });

    it('should have font size scale', () => {
      expect(typography.fontSize.xs).toBe(12);
      expect(typography.fontSize.sm).toBe(14);
      expect(typography.fontSize.base).toBe(16);
      expect(typography.fontSize.lg).toBe(18);
      expect(typography.fontSize.xl).toBe(20);
      expect(typography.fontSize['2xl']).toBe(24);
      expect(typography.fontSize['3xl']).toBe(30);
      expect(typography.fontSize['4xl']).toBe(36);
      expect(typography.fontSize['5xl']).toBe(48);
    });

    it('should have font weights', () => {
      expect(typography.fontWeight.light).toBe('300');
      expect(typography.fontWeight.normal).toBe('400');
      expect(typography.fontWeight.medium).toBe('500');
      expect(typography.fontWeight.semibold).toBe('600');
      expect(typography.fontWeight.bold).toBe('700');
    });

    it('should have line heights', () => {
      expect(typography.lineHeight.none).toBe(1);
      expect(typography.lineHeight.tight).toBe(1.25);
      expect(typography.lineHeight.snug).toBe(1.375);
      expect(typography.lineHeight.normal).toBe(1.5);
      expect(typography.lineHeight.relaxed).toBe(1.625);
      expect(typography.lineHeight.loose).toBe(2);
    });
  });

  describe('spacing', () => {
    it('should have spacing scale based on 4px', () => {
      expect(spacing[0]).toBe(0);
      expect(spacing[1]).toBe(4);
      expect(spacing[2]).toBe(8);
      expect(spacing[3]).toBe(12);
      expect(spacing[4]).toBe(16);
      expect(spacing[8]).toBe(32);
      expect(spacing[16]).toBe(64);
    });

    it('should have half steps', () => {
      expect(spacing[0.5]).toBe(2);
      expect(spacing[1.5]).toBe(6);
      expect(spacing[2.5]).toBe(10);
      expect(spacing[3.5]).toBe(14);
    });
  });

  describe('borderRadius', () => {
    it('should have border radius scale', () => {
      expect(borderRadius.none).toBe(0);
      expect(borderRadius.sm).toBe(2);
      expect(borderRadius.default).toBe(6);
      expect(borderRadius.md).toBe(8);
      expect(borderRadius.lg).toBe(12);
      expect(borderRadius.xl).toBe(16);
      expect(borderRadius['2xl']).toBe(24);
      expect(borderRadius['3xl']).toBe(32);
      expect(borderRadius.full).toBe(9999);
    });
  });

  describe('shadows', () => {
    it('should have shadow definitions with required properties', () => {
      expect(shadows.none).toHaveProperty('shadowColor');
      expect(shadows.none).toHaveProperty('shadowOffset');
      expect(shadows.none).toHaveProperty('shadowOpacity');
      expect(shadows.none).toHaveProperty('shadowRadius');
      expect(shadows.none).toHaveProperty('elevation');
    });

    it('should have increasing elevation values', () => {
      expect(shadows.none.elevation).toBe(0);
      expect(shadows.sm.elevation).toBe(1);
      expect(shadows.default.elevation).toBe(2);
      expect(shadows.md.elevation).toBe(4);
      expect(shadows.lg.elevation).toBe(8);
      expect(shadows.xl.elevation).toBe(12);
    });

    it('should have Auvo brand shadow', () => {
      expect(shadows.auvo).toBeDefined();
      expect(shadows.auvo.shadowColor).toBe('#7C3AED'); // Auvo logo color
    });
  });

  describe('zIndex', () => {
    it('should have z-index scale (web-compatible)', () => {
      expect(zIndex.hide).toBe(-1);
      expect(zIndex.base).toBe(0);
      expect(zIndex.docked).toBe(10);
      expect(zIndex.dropdown).toBe(1000);
      expect(zIndex.sticky).toBe(1100);
      expect(zIndex.overlay).toBe(1300);
      expect(zIndex.modal).toBe(1400);
      expect(zIndex.popover).toBe(1500);
      expect(zIndex.toast).toBe(1700);
      expect(zIndex.tooltip).toBe(1800);
    });
  });

  describe('animation', () => {
    it('should have animation durations', () => {
      expect(animation.duration.fast).toBe(150);
      expect(animation.duration.default).toBe(200);
      expect(animation.duration.normal).toBe(300);
      expect(animation.duration.slow).toBe(300);
      expect(animation.duration.slower).toBe(500);
    });

    it('should have easing functions', () => {
      expect(animation.easing.default).toBe('ease-in-out');
      expect(animation.easing.linear).toBe('linear');
      expect(animation.easing.easeIn).toBe('ease-in');
      expect(animation.easing.easeOut).toBe('ease-out');
      expect(animation.easing.easeInOut).toBe('ease-in-out');
    });
  });

  describe('theme object', () => {
    it('should export complete theme object', () => {
      expect(theme).toHaveProperty('colors');
      expect(theme).toHaveProperty('typography');
      expect(theme).toHaveProperty('spacing');
      expect(theme).toHaveProperty('borderRadius');
      expect(theme).toHaveProperty('shadows');
      expect(theme).toHaveProperty('zIndex');
      expect(theme).toHaveProperty('animation');
      expect(theme).toHaveProperty('statusColors');
    });
  });

  describe('statusColors', () => {
    it('should have quote status colors', () => {
      expect(theme.statusColors.quote.DRAFT).toBe(colors.gray[400]);
      expect(theme.statusColors.quote.APPROVED).toBe(colors.success[500]);
      expect(theme.statusColors.quote.REJECTED).toBe(colors.error[500]);
    });

    it('should have workOrder status colors', () => {
      expect(theme.statusColors.workOrder.SCHEDULED).toBe(colors.info[500]);
      expect(theme.statusColors.workOrder.DONE).toBe(colors.success[500]);
      expect(theme.statusColors.workOrder.CANCELED).toBe(colors.error[500]);
    });

    it('should have payment status colors', () => {
      expect(theme.statusColors.payment.PENDING).toBe(colors.warning[500]);
      expect(theme.statusColors.payment.RECEIVED).toBe(colors.success[500]);
      expect(theme.statusColors.payment.OVERDUE).toBe(colors.error[500]);
    });
  });
});
