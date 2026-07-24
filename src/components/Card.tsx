/**
 * Card — reusable surface for content blocks.
 * Theme-aware: bg/border/shadow adapt to light/dark/outdoor mode.
 */

import React from 'react';
import { View, type ViewProps } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';

interface CardProps extends ViewProps {
  variant?: 'default' | 'elevated' | 'outline';
  padding?: number;
}

export function Card({
  children,
  variant = 'default',
  padding = 16,
  style,
  ...rest
}: CardProps) {
  const Colors = useThemeColors();

  const variantStyle = {
    default: {
      backgroundColor: Colors.bgCard,
      borderWidth: 1,
      borderColor: Colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
    },
    elevated: {
      backgroundColor: Colors.bgCard,
      borderWidth: 1,
      borderColor: Colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: Colors.border,
    },
  }[variant];

  return (
    <View
      style={{
        borderRadius: 12,
        padding,
        ...variantStyle,
        ...style,
      }}
      {...rest}
    >
      {children}
    </View>
  );
}
