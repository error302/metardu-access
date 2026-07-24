/**
 * Button — touch-friendly button with brand variants.
 * Theme-aware: bg/text/border adapt to light/dark/outdoor mode.
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  View,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { field as haptics } from '@/lib/haptics';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
}

const SIZE_STYLES: Record<Size, { height: number; fontSize: number; paddingHorizontal: number }> = {
  sm: { height: 40, fontSize: 14, paddingHorizontal: 12 },
  md: { height: 48, fontSize: 16, paddingHorizontal: 16 },
  lg: { height: 56, fontSize: 18, paddingHorizontal: 24 },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  style,
  textStyle,
  testID,
}: ButtonProps) {
  const Colors = useThemeColors();

  const variantStyle: { bg: string; text: string; border?: string } = {
    primary: { bg: Colors.metarduOrange, text: Colors.metarduWhite },
    secondary: { bg: Colors.metarduNavy, text: Colors.metarduWhite },
    ghost: { bg: 'transparent', text: Colors.fg },
    danger: { bg: Colors.danger, text: Colors.metarduWhite },
    outline: { bg: 'transparent', text: Colors.fg, border: Colors.borderStrong },
  }[variant];

  const sizeStyle = SIZE_STYLES[size];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      testID={testID}
      onPress={() => {
        if (!isDisabled) haptics.tap();
        onPress();
      }}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={{
        height: sizeStyle.height,
        backgroundColor: isDisabled ? Colors.gray300 : variantStyle.bg,
        borderRadius: 12,
        paddingHorizontal: sizeStyle.paddingHorizontal,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: isDisabled ? 0.6 : 1,
        borderWidth: variantStyle.border ? 1.5 : 0,
        borderColor: variantStyle.border,
        width: fullWidth ? '100%' : undefined,
        ...style,
      }}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.text} size="small" />
      ) : (
        <>
          {icon && <View>{icon}</View>}
          <Text
            style={{
              color: isDisabled ? Colors.gray500 : variantStyle.text,
              fontSize: sizeStyle.fontSize,
              fontWeight: '600',
              ...textStyle,
            }}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}
