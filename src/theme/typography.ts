/**
 * Typography helpers — pre-built style objects using the new design system.
 *
 * Usage:
 *   import { TextStyles } from '@/theme/typography';
 *   <Text style={TextStyles.display.lg}>Heading</Text>
 *
 * Inspired by Linear / Vercel — tight letter-spacing on display,
 * normal on body, monospace for technical values.
 */

import { Typography, LightColors, DarkColors } from '@/theme';

type ColorSet = typeof LightColors;

function buildTextStyles(c: ColorSet) {
  return {
    // Display — large headings (page titles)
    display: {
      '2xl': {
        fontFamily: Typography.fontFamily.heading,
        fontSize: Typography.fontSize['3xl'],
        lineHeight: Typography.lineHeight.tight * Typography.fontSize['3xl'],
        letterSpacing: Typography.letterSpacing.tight,
        color: c.fg,
        fontWeight: '600',
      },
      xl: {
        fontFamily: Typography.fontFamily.heading,
        fontSize: Typography.fontSize['2xl'],
        lineHeight: Typography.lineHeight.tight * Typography.fontSize['2xl'],
        letterSpacing: Typography.letterSpacing.tight,
        color: c.fg,
        fontWeight: '600',
      },
      lg: {
        fontFamily: Typography.fontFamily.heading,
        fontSize: Typography.fontSize.xl,
        lineHeight: Typography.lineHeight.tight * Typography.fontSize.xl,
        letterSpacing: Typography.letterSpacing.tight,
        color: c.fg,
        fontWeight: '600',
      },
    },
    // Heading — section titles
    heading: {
      xl: {
        fontFamily: Typography.fontFamily.heading,
        fontSize: Typography.fontSize.lg,
        lineHeight: Typography.lineHeight.snug * Typography.fontSize.lg,
        letterSpacing: Typography.letterSpacing.snug,
        color: c.fg,
        fontWeight: '600',
      },
      lg: {
        fontFamily: Typography.fontFamily.heading,
        fontSize: Typography.fontSize.base,
        lineHeight: Typography.lineHeight.snug * Typography.fontSize.base,
        letterSpacing: Typography.letterSpacing.snug,
        color: c.fg,
        fontWeight: '600',
      },
      md: {
        fontFamily: Typography.fontFamily.heading,
        fontSize: Typography.fontSize.sm,
        lineHeight: Typography.lineHeight.snug * Typography.fontSize.sm,
        letterSpacing: Typography.letterSpacing.snug,
        color: c.fg,
        fontWeight: '600',
      },
    },
    // Body — paragraph text
    body: {
      lg: {
        fontFamily: Typography.fontFamily.sans,
        fontSize: Typography.fontSize.base,
        lineHeight: Typography.lineHeight.normal * Typography.fontSize.base,
        color: c.fgSecondary,
      },
      md: {
        fontFamily: Typography.fontFamily.sans,
        fontSize: Typography.fontSize.sm,
        lineHeight: Typography.lineHeight.normal * Typography.fontSize.sm,
        color: c.fgSecondary,
      },
      sm: {
        fontFamily: Typography.fontFamily.sans,
        fontSize: Typography.fontSize.xs,
        lineHeight: Typography.lineHeight.normal * Typography.fontSize.xs,
        color: c.fgMuted,
      },
    },
    // Caption — small helper text
    caption: {
      md: {
        fontFamily: Typography.fontFamily.sans,
        fontSize: Typography.fontSize.xs,
        lineHeight: Typography.lineHeight.normal * Typography.fontSize.xs,
        color: c.fgMuted,
      },
      sm: {
        fontFamily: Typography.fontFamily.sans,
        fontSize: Typography.fontSize['2xs'],
        lineHeight: Typography.lineHeight.normal * Typography.fontSize['2xs'],
        color: c.fgSubtle,
      },
    },
    // Overline — uppercase labels above sections
    overline: {
      md: {
        fontFamily: Typography.fontFamily.sansMedium,
        fontSize: Typography.fontSize['2xs'],
        letterSpacing: Typography.letterSpacing.widest,
        color: c.fgMuted,
        textTransform: 'uppercase' as const,
        fontWeight: '600' as const,
      },
    },
    // Mono — technical values (coordinates, IDs, hashes)
    mono: {
      lg: {
        fontFamily: Typography.fontFamily.monoMedium,
        fontSize: Typography.fontSize.base,
        lineHeight: Typography.lineHeight.snug * Typography.fontSize.base,
        color: c.fg,
      },
      md: {
        fontFamily: Typography.fontFamily.mono,
        fontSize: Typography.fontSize.sm,
        lineHeight: Typography.lineHeight.snug * Typography.fontSize.sm,
        color: c.fgSecondary,
      },
      sm: {
        fontFamily: Typography.fontFamily.mono,
        fontSize: Typography.fontSize.xs,
        lineHeight: Typography.lineHeight.snug * Typography.fontSize.xs,
        color: c.fgMuted,
      },
    },
    // Link / accent text
    accent: {
      md: {
        fontFamily: Typography.fontFamily.sansMedium,
        fontSize: Typography.fontSize.sm,
        color: '#F97316', // metarduOrange
        fontWeight: '500' as const,
      },
    },
  };
}

export const LightTextStyles = buildTextStyles(LightColors);
export const DarkTextStyles = buildTextStyles(DarkColors);
export const OutdoorTextStyles = buildTextStyles({
  ...DarkColors,
  fg: '#FFFFFF',
  fgSecondary: '#FFFFFF',
  fgMuted: '#CCCCCC',
  fgSubtle: '#999999',
});

export type TextStyles = typeof LightTextStyles;
