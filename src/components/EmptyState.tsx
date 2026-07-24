/**
 * EmptyState — friendly placeholder when lists are empty.
 * Theme-aware.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/useThemeColors';

interface Props {
  icon: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, subtitle, action }: Props) {
  const Colors = useThemeColors();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
        paddingHorizontal: 24,
      }}
    >
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: Colors.bgSubtle,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <MaterialCommunityIcons name={icon as any} size={36} color={Colors.fgSubtle} />
      </View>
      <Text
        style={{
          fontSize: 18,
          fontWeight: '600',
          color: Colors.fg,
          textAlign: 'center',
          marginBottom: 4,
        }}
      >
        {title}
      </Text>
      {subtitle && (
        <Text
          style={{
            fontSize: 14,
            color: Colors.fgMuted,
            textAlign: 'center',
            marginBottom: 16,
          }}
        >
          {subtitle}
        </Text>
      )}
      {action}
    </View>
  );
}
