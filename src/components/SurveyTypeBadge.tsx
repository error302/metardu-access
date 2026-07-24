/**
 * SurveyTypeBadge — colored pill showing the survey type with icon.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SurveyTypeConfig } from '@/theme';
import type { SurveyType } from '@/types';

interface BadgeProps {
  type: SurveyType;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = {
  sm: { height: 22, fontSize: 11, iconSize: 12, paddingHorizontal: 8 },
  md: { height: 28, fontSize: 12, iconSize: 14, paddingHorizontal: 10 },
  lg: { height: 34, fontSize: 14, iconSize: 16, paddingHorizontal: 12 },
};

export function SurveyTypeBadge({ type, size = 'md' }: BadgeProps) {
  const config = SurveyTypeConfig[type];
  const sz = SIZE_MAP[size];

  if (!config) return null;

  return (
    <View
      style={{
        height: sz.height,
        backgroundColor: `${config.color}15`, // 15 = ~8% opacity
        borderRadius: sz.height / 2,
        paddingHorizontal: sz.paddingHorizontal,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <MaterialCommunityIcons
        name={config.icon as any}
        size={sz.iconSize}
        color={config.color}
      />
      <Text
        style={{
          fontSize: sz.fontSize,
          fontWeight: '600',
          color: config.color,
        }}
      >
        {config.label}
      </Text>
    </View>
  );
}
