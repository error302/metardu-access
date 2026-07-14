/**
 * Shared "Coming Soon" screen for survey-type workflows under active development.
 * Each route stub renders this with appropriate context.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Colors } from '@/theme';
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.metarduCream }} edges={['top']}>
      <View style={styles.header}>
        <Button title="Back" variant="ghost" size="sm" onPress={() => router.back()} />
      </View>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name={icon as any} size={56} color={Colors.metarduOrange} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.desc}>{description}</Text>

        <Card style={{ marginTop: 24, width: '100%' }}>
          <Text style={styles.featuresTitle}>Planned Capabilities</Text>
          {features.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <MaterialCommunityIcons name="check-circle" size={18} color={Colors.success} />
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </Card>

        <Text style={styles.note}>
          This workflow is on the v0.2 roadmap. Use the Fieldbook tab to capture raw
          observations now — they'll be ready when this module ships.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 8,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: `${Colors.metarduOrange}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.metarduNavy,
    textAlign: 'center',
    marginBottom: 8,
  },
  desc: {
    fontSize: 14,
    color: Colors.gray500,
    textAlign: 'center',
    lineHeight: 20,
  },
  featuresTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.metarduNavy,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  featureText: {
    fontSize: 14,
    color: Colors.metarduNavy,
  },
  note: {
    fontSize: 12,
    color: Colors.gray500,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 16,
    lineHeight: 18,
  },
});
