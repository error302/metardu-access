/**
 * Shared "Coming Soon" screen for survey-type workflows under active development.
 * Theme-aware.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useThemeColors';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';

interface Props {
  title: string;
  icon: string;
  description: string;
  features: string[];
}

export function WorkflowPlaceholder({ title, icon, description, features }: Props) {
  const router = useRouter();
  const Colors = useThemeColors();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={{ padding: 8 }}>
        <Button title="Back" variant="ghost" size="sm" onPress={() => router.back()} />
      </View>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          paddingHorizontal: 24,
          paddingTop: 32,
        }}
      >
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 24,
            backgroundColor: `${Colors.metarduOrange}15`,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <MaterialCommunityIcons name={icon as any} size={56} color={Colors.metarduOrange} />
        </View>
        <Text
          style={{
            fontSize: 22,
            fontWeight: '700',
            color: Colors.fg,
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: Colors.fgMuted,
            textAlign: 'center',
            lineHeight: 20,
          }}
        >
          {description}
        </Text>

        <Card style={{ marginTop: 24, width: '100%' }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: Colors.fg,
              marginBottom: 12,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Planned Capabilities
          </Text>
          {features.map((f, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 6,
              }}
            >
              <MaterialCommunityIcons name="check-circle" size={18} color={Colors.success} />
              <Text style={{ fontSize: 14, color: Colors.fg }}>{f}</Text>
            </View>
          ))}
        </Card>

        <Text
          style={{
            fontSize: 12,
            color: Colors.fgMuted,
            textAlign: 'center',
            marginTop: 24,
            paddingHorizontal: 16,
            lineHeight: 18,
          }}
        >
          This workflow is on the v0.2 roadmap. Use the Fieldbook tab to capture raw
          observations now — they'll be ready when this module ships.
        </Text>
      </View>
    </SafeAreaView>
  );
}
