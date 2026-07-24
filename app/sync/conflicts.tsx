/**
 * Conflict Resolution screen — review and resolve sync divergences.
 *
 * When the sync server detects that a client's version of a project/session
 * diverges from the server's, it sends a conflict event. This screen shows
 * all pending conflicts and lets the surveyor decide how to resolve each.
 *
 * Resolution strategies:
 *   - "Keep mine" — client version wins (field-side change is preserved)
 *   - "Use server" — server version wins (office-side change is preserved)
 *   - "Merge" — field-level merge (takes newer value per field)
 *   - "Decide later" — defer resolution until back at office
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Colors, Typography, Spacing, Radius } from '@/theme';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import {
  type ConflictRecord,
  formatConflict,
  lastWriteWins,
  fieldLevelMerge,
} from '@/lib/realtime/conflicts';
import { getRealtimeSync } from '@/lib/realtime/sync';
import { field as haptics } from '@/lib/haptics';
import { useThemeColors } from '@/hooks/useThemeColors';

export default function ConflictsScreen() {
  const Colors = useThemeColors();
  const router = useRouter();
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);

  useEffect(() => {
    // Subscribe to conflict events from realtime sync
    const realtime = getRealtimeSync();
    const unsub = realtime.onEvent((event) => {
      if (event.kind === 'conflict') {
        const newConflict: ConflictRecord = {
          id: `conflict-${Date.now()}`,
          type: 'session',
          entityId: event.data.sessionId,
          field: event.data.field,
          clientValue: event.data.clientVersion,
          serverValue: event.data.serverVersion,
          clientTimestamp: new Date().toISOString(),
          serverTimestamp: new Date().toISOString(),
          resolution: 'pending',
          detectedAt: new Date().toISOString(),
        };
        setConflicts((prev) => [newConflict, ...prev]);
      }
    });
    return unsub;
  }, []);

  const resolveConflict = (id: string, resolution: ConflictRecord['resolution']) => {
    setConflicts((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              resolution,
              resolvedValue:
                resolution === 'client-wins' ? c.clientValue :
                resolution === 'server-wins' ? c.serverValue :
                resolution === 'merged' ? fieldLevelMerge(c.clientValue, c.serverValue) :
                undefined,
            }
          : c
      )
    );
    haptics.medium();
  };

  const pending = conflicts.filter((c) => c.resolution === 'pending');
  const resolved = conflicts.filter((c) => c.resolution !== 'pending');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF7F2' }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={'#0B1F3A'} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Sync Conflicts</Text>
          <Text style={styles.subtitle}>
            {pending.length} pending · {resolved.length} resolved
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing[4], paddingBottom: Spacing[12] }}>
        {conflicts.length === 0 ? (
          <EmptyState
            icon="cloud-braces"
            title="No conflicts"
            subtitle="When multiple surveyors edit the same data, conflicts will appear here for resolution."
          />
        ) : (
          <>
            {pending.length > 0 && (
              <Text style={styles.sectionOverline}>Pending ({pending.length})</Text>
            )}
            <View style={{ gap: Spacing[3], marginBottom: Spacing[6] }}>
              {pending.map((conflict) => (
                <ConflictCard
                  key={conflict.id}
                  conflict={conflict}
                  onResolve={(strategy) => resolveConflict(conflict.id, strategy)}
                />
              ))}
            </View>

            {resolved.length > 0 && (
              <>
                <Text style={styles.sectionOverline}>Resolved ({resolved.length})</Text>
                <View style={{ gap: Spacing[3] }}>
                  {resolved.map((conflict) => (
                    <ResolvedConflictCard key={conflict.id} conflict={conflict} />
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ConflictCard({
  conflict,
  onResolve,
}: {
  conflict: ConflictRecord;
  onResolve: (strategy: 'client-wins' | 'server-wins' | 'merged') => void;
}) {
  const { title, description, recommendation } = formatConflict(conflict);

  const handleShare = async () => {
    await Share.share({
      message: `METARDU ACCESS — SYNC CONFLICT\n\n${title}\n\n${description}`,
    });
  };

  return (
    <Card style={[styles.conflictCard, { borderLeftColor: '#F59E0B' }]}>
      <View style={styles.conflictHeader}>
        <MaterialCommunityIcons name="cloud-braces" size={18} color={'#F59E0B'} />
        <Text style={styles.conflictTitle} numberOfLines={1}>{title}</Text>
        <TouchableOpacity onPress={handleShare} style={{ padding: 4 }}>
          <MaterialCommunityIcons name="share-variant" size={14} color={'#9CA3AF'} />
        </TouchableOpacity>
      </View>

      <View style={styles.diffContainer}>
        <DiffRow
          label="Your version"
          value={conflict.clientValue}
          timestamp={conflict.clientTimestamp}
          color={'#F97316'}
          isWinner={recommendation === 'client'}
        />
        <View style={styles.diffDivider}>
          <MaterialCommunityIcons name="swap-vertical" size={14} color={'#9CA3AF'} />
        </View>
        <DiffRow
          label="Server version"
          value={conflict.serverValue}
          timestamp={conflict.serverTimestamp}
          color={'#3B82F6'}
          isWinner={recommendation === 'server'}
        />
      </View>

      <Text style={styles.recommendation}>
        Recommended: {recommendation === 'client' ? 'keep yours' : recommendation === 'server' ? 'use server' : 'review manually'}
      </Text>

      <View style={styles.resolutionRow}>
        <Button
          title="Keep mine"
          variant={recommendation === 'client' ? 'primary' : 'outline'}
          size="sm"
          onPress={() => onResolve('client-wins')}
          style={{ flex: 1 }}
        />
        <Button
          title="Merge"
          variant="outline"
          size="sm"
          onPress={() => onResolve('merged')}
          style={{ flex: 1 }}
        />
        <Button
          title="Use server"
          variant={recommendation === 'server' ? 'primary' : 'outline'}
          size="sm"
          onPress={() => onResolve('server-wins')}
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );
}

function DiffRow({
  label,
  value,
  timestamp,
  color,
  isWinner,
}: {
  label: string;
  value: any;
  timestamp: string;
  color: string;
  isWinner: boolean;
}) {
  const valueStr = typeof value === 'object'
    ? JSON.stringify(value, null, 2)
    : String(value);

  return (
    <View style={styles.diffRow}>
      <View style={styles.diffLabelRow}>
        <View style={[styles.diffDot, { backgroundColor: color }]} />
        <Text style={styles.diffLabel}>{label}</Text>
        {isWinner && (
          <View style={[styles.winnerBadge, { backgroundColor: color }]}>
            <Text style={styles.winnerText}>NEWER</Text>
          </View>
        )}
      </View>
      <Text style={styles.diffValue} numberOfLines={3}>{valueStr}</Text>
      <Text style={styles.diffTimestamp}>
        {new Date(timestamp).toLocaleString()}
      </Text>
    </View>
  );
}

function ResolvedConflictCard({ conflict }: { conflict: ConflictRecord }) {
  const resolutionLabel = {
    'client-wins': 'Kept yours',
    'server-wins': 'Used server',
    'merged': 'Merged',
    'manual': 'Manual',
    'pending': 'Pending',
  }[conflict.resolution];

  const resolutionColor = {
    'client-wins': '#F97316',
    'server-wins': '#3B82F6',
    'merged': '#10B981',
    'manual': '#F59E0B',
    'pending': '#9CA3AF',
  }[conflict.resolution];

  return (
    <Card style={[styles.conflictCard, { borderLeftColor: resolutionColor, opacity: 0.7 }]}>
      <View style={styles.conflictHeader}>
        <MaterialCommunityIcons name="check-circle" size={16} color={resolutionColor} />
        <Text style={styles.conflictTitle} numberOfLines={1}>
          {conflict.field} — {resolutionLabel}
        </Text>
      </View>
      <Text style={styles.resolvedAt}>
        Resolved at {new Date(conflict.detectedAt).toLocaleString()}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    padding: Spacing[4],
  },
  title: {
    fontFamily: Typography.fontFamily.heading,
    fontSize: Typography.fontSize.xl,
    fontWeight: '600',
    color: '#0B1F3A',
  },
  subtitle: {
    fontFamily: Typography.fontFamily.sans,
    fontSize: Typography.fontSize.xs,
    color: '#6B7280',
    marginTop: 2,
  },
  sectionOverline: {
    fontFamily: Typography.fontFamily.sansMedium,
    fontSize: Typography.fontSize['2xs'],
    letterSpacing: Typography.letterSpacing.widest,
    textTransform: 'uppercase',
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: Spacing[3],
    marginLeft: Spacing[1],
  },
  conflictCard: {
    borderLeftWidth: 3,
  },
  conflictHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    marginBottom: Spacing[3],
  },
  conflictTitle: {
    flex: 1,
    fontFamily: Typography.fontFamily.sansMedium,
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    color: '#0B1F3A',
  },
  diffContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: Radius.md,
    padding: Spacing[3],
    marginBottom: Spacing[3],
  },
  diffRow: {
    gap: Spacing[1],
  },
  diffLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  diffDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  diffLabel: {
    fontFamily: Typography.fontFamily.sansMedium,
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  winnerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  winnerText: {
    fontFamily: Typography.fontFamily.sansBold,
    fontSize: 9,
    fontWeight: '700',
    color: Colors.bgCard,
  },
  diffValue: {
    fontFamily: Typography.fontFamily.mono,
    fontSize: Typography.fontSize.xs,
    color: '#0B1F3A',
    lineHeight: 16,
  },
  diffTimestamp: {
    fontFamily: Typography.fontFamily.mono,
    fontSize: Typography.fontSize['2xs'],
    color: '#9CA3AF',
  },
  diffDivider: {
    alignItems: 'center',
    paddingVertical: Spacing[2],
  },
  recommendation: {
    fontFamily: Typography.fontFamily.sans,
    fontSize: Typography.fontSize.xs,
    color: '#6B7280',
    fontStyle: 'italic',
    marginBottom: Spacing[3],
  },
  resolutionRow: {
    flexDirection: 'row',
    gap: Spacing[2],
  },
  resolvedAt: {
    fontFamily: Typography.fontFamily.mono,
    fontSize: Typography.fontSize['2xs'],
    color: '#9CA3AF',
  },
});
