/**
 * LogoMark — the Metardu logo as a React component.
 * Falls back to a text-based wordmark if the image asset fails to load.
 */

import React from 'react';
import { Image, View, Text, type ImageStyle } from 'react-native';
import { Colors } from '@/theme';

interface LogoProps {
  size?: number;
  withWordmark?: boolean;
  style?: ImageStyle;
}

export function LogoMark({ size = 64, withWordmark = false, style }: LogoProps) {
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
              color: Colors.metarduWhite,
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
