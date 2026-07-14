/**
 * Card — reusable surface for content blocks.
 */

import React from 'react';
import { View, type ViewProps } from 'react-native';
import { Colors } from '@/theme';

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
  const variantStyle = {
    default: {
      backgroundColor: Colors.metarduWhite,
      borderWidth: 0,
      shadowColor: Colors.metarduNavy,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    elevated: {
      backgroundColor: Colors.metarduWhite,
      borderWidth: 0,
      shadowColor: Colors.metarduNavy,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 24,
      elevation: 6,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: Colors.gray200,
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
