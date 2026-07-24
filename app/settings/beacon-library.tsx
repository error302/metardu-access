/**
 * Kenya Beacon Reference Library — specifications for standard beacon types.
 *
 * Surveyors reference this in the field to choose the right beacon type
 * for their survey. Includes dimensions, materials, regulations, lifespan,
 * and cost in KES.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { KENYA_BEACON_TYPES, type BeaconTypeSpec } from '@/lib/data/kenya-beacons';
import { useThemeColors } from '@/hooks/useThemeColors';

export default function BeaconLibraryScreen() {
  const Colors = useThemeColors();
  const router = useRouter();

  const handleShare = async (beacon: BeaconTypeSpec) => {
    await Share.share({
      message: [
        `METARDU ACCESS — BEACON SPECIFICATION`,
        ``,
        `Type: ${beacon.name} (${beacon.swahili})`,
        `Dimensions: ${beacon.dimensions}`,
        `Material: ${beacon.material}`,
        ``,
        `Use case: ${beacon.useCase}`,
        `Regulations: ${beacon.regulations}`,
        `Lifespan: ${beacon.lifespan}`,
        `Cost: ${beacon.cost}`,
      ].join('\n'),
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={'#0B1F3A'} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Beacon Library</Text>
          <Text style={styles.subtitle}>Kenya standard beacon types</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card variant="outline" style={{ marginBottom: 16 }}>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="book-open-variant" size={20} color={'#3B82F6'} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoText}>
                Reference specifications per Survey of Kenya Field Manual and
                Survey Regulations 1994. Use these when selecting beacon types
                for your survey.
              </Text>
            </View>
          </View>
        </Card>

        {KENYA_BEACON_TYPES.map((beacon) => (
          <Card key={beacon.id} style={[styles.beaconCard, { borderLeftColor: beacon.color }]}>
            <View style={styles.beaconHeader}>
              <View style={[styles.beaconIcon, { backgroundColor: `${beacon.color}20` }]}>
                <MaterialCommunityIcons name={beacon.icon as any} size={28} color={beacon.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.beaconName}>{beacon.name}</Text>
                <Text style={styles.beaconSwahili}>{beacon.swahili}</Text>
              </View>
              <TouchableOpacity onPress={() => handleShare(beacon)} style={{ padding: 4 }}>
                <MaterialCommunityIcons name="share-variant" size={18} color={'#F97316'} />
              </TouchableOpacity>
            </View>

            <DetailRow icon="ruler" label="Dimensions" value={beacon.dimensions} />
            <DetailRow icon="package-variant-closed" label="Material" value={beacon.material} />
            <DetailRow icon="clipboard-text" label="Use case" value={beacon.useCase} />
            <DetailRow icon="scale-balance" label="Regulations" value={beacon.regulations} />
            <DetailRow icon="clock-outline" label="Lifespan" value={beacon.lifespan} />
            <DetailRow icon="currency-kes" label="Cost" value={beacon.cost} />
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIconRow}>
        <MaterialCommunityIcons name={icon as any} size={14} color={Colors.fgMuted} />
        <Text style={styles.detailLabel}>{label}</Text>
      </View>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0B1F3A',
  },
  subtitle: {
    fontSize: 13,
    color: Colors.fgMuted,
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  infoText: {
    fontSize: 12,
    color: Colors.fgMuted,
    lineHeight: 17,
  },
  beaconCard: {
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  beaconHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  beaconIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beaconName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0B1F3A',
  },
  beaconSwahili: {
    fontSize: 12,
    color: Colors.fgMuted,
    marginTop: 2,
    fontStyle: 'italic',
  },
  detailRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  detailIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 11,
    color: Colors.fgMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 12,
    color: '#0B1F3A',
    lineHeight: 16,
  },
});
