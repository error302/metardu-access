/**
 * LogoMark — the Metardu logo as a React component.
 * Theme-aware: wordmark color adapts to background.
 */

import React from 'react';
import { Image, View, Text, type ImageStyle } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';

interface LogoProps {
  size?: number;
  withWordmark?: boolean;
  style?: ImageStyle;
}

export function LogoMark({ size = 64, withWordmark = false, style }: LogoProps) {
  const Colors = useThemeColors();
  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <Image
        source={require('@/assets/images/logo-mark.png')}
        style={{ width: size, height: size, ...style }}
        resizeMode="contain"
        accessibilityLabel="Metardu logo"
      />
      {withWordmark && (
        <View style={{ flexDirection: 'row' }}>
          <Text
            style={{
              fontFamily: 'InterDisplay',
              fontSize: size * 0.35,
              fontWeight: '700',
              color: Colors.fg,
              letterSpacing: -1,
            }}
          >
            META
          </Text>
          <Text
            style={{
              fontFamily: 'InterDisplay',
              fontSize: size * 0.35,
              fontWeight: '700',
              color: Colors.metarduOrange,
              letterSpacing: -1,
            }}
          >
            RDU
          </Text>
        </View>
      )}
    </View>
  );
}
