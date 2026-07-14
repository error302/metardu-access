/**
 * SyncStatusBadge — pill showing sync state.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SyncStatusConfig } from '@/theme';
import type { SyncStatus } from '@/types';

interface Props {
  status: SyncStatus;
  size?: 'sm' | 'md';
}

export function SyncStatusBadge({ status, size = 'sm' }: Props) {
  const config = SyncStatusConfig[status];
  const sz = size === 'sm' ? { height: 22, fontSize: 11, icon: 12, px: 8 } : { height: 28, fontSize: 12, icon: 14, px: 10 };

  return (
    <View
      style={{
        height: sz.height,
        backgroundColor: `${config.color}15`,
        borderRadius: sz.height / 2,
        paddingHorizontal: sz.px,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <MaterialCommunityIcons name={config.icon as any} size={sz.icon} color={config.color} />
      <Text style={{ fontSize: sz.fontSize, fontWeight: '600', color: config.color }}>
        {config.label}
      </Text>
    </View>
  );
}
