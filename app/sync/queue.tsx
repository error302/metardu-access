/**
 * Sync Queue screen — shows pending sync items + drain queue + export to file.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Share,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { SyncStatusBadge } from '@/components/SyncStatusBadge';
import { getSyncQueue, getPoints, getObservations, getProject } from '@/lib/db/queries';
import { getSyncEngine, buildSession } from '@/lib/sync/engine';
import { useAuthStore } from '@/stores/authStore';
import type { SyncQueueItem } from '@/types';

export default function SyncQueueScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const profile = useAuthStore((s) => s.profile);

  const [queue, setQueue] = useState<SyncQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    setLoading(true);
    const q = await getSyncQueue();
    setQueue(q);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const engine = getSyncEngine();
      const result = await engine.drainQueue((item, ok, error) => {
        if (!ok) {
          console.warn('Sync failed for', item.sessionId, error);
        }
      });
      Alert.alert(
        'Sync Complete',
        `Pushed: ${result.pushed}\nFailed: ${result.failed}`
      );
      load();
    } catch (err: any) {
      Alert.alert('Sync failed', err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleExportSession = async () => {
    if (!projectId || !profile) {
      Alert.alert('Error', 'No project selected or not authenticated.');
      return;
    }
    try {
      const project = await getProject(projectId);
      if (!project) {
        Alert.alert('Not found', 'Project not found.');
        return;
      }
      const [points, observations] = await Promise.all([
        getPoints(projectId),
        // For demo, just count observations
        Promise.resolve([]),
      ]);

      const session = buildSession({
        surveyor: profile,
        project: {
          id: project.id,
          name: project.name,
          surveyType: project.surveyType,
          county: project.county,
        },
        points: points as any,
        observations: observations as any,
        crsEpsg: project.crsEpsg,
      });

      const engine = getSyncEngine();
      const path = await engine.exportSessionToFile(session);
      await Share.share({
        url: path,
        message: `Metardu field session for ${project.name}`,
      });
    } catch (err: any) {
      Alert.alert('Export failed', err.message);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF7F2' }} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={'#0B1F3A'} />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>{t('sync.queue')}</Text>
            <Text style={styles.subtitle}>{queue.length} pending</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={queue}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 12, padding: 14 }}>
            <View style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{item.payload.projectName}</Text>
                <Text style={styles.itemMeta}>
                  Session {item.sessionId.slice(0, 8)} · {item.payload.points.length} pts · {item.payload.observations.length} obs
                </Text>
                <Text style={styles.itemDate}>
                  Queued: {new Date(item.queuedAt).toLocaleString()}
                </Text>
                {item.attempts > 0 && (
                  <Text style={styles.itemAttempts}>
                    Attempts: {item.attempts} {item.lastError ? `· ${item.lastError}` : ''}
                  </Text>
                )}
              </View>
              <SyncStatusBadge status={item.attempts > 0 ? 'failed' : 'queued'} size="sm" />
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="cloud-check"
            title={t('sync.queueEmpty')}
            subtitle="Sessions you capture will appear here, waiting to sync."
          />
        }
        refreshing={loading}
        onRefresh={load}
      />

      <View style={styles.bottomBar}>
        <Button
          title={t('sync.syncNow')}
          onPress={handleSyncAll}
          loading={syncing}
          style={{ flex: 2 }}
        />
        <Button
          title={t('sync.exportFile')}
          variant="outline"
          onPress={handleExportSession}
          style={{ flex: 1 }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0B1F3A',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0B1F3A',
  },
  itemMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    fontFamily: 'JetBrainsMono',
  },
  itemDate: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  itemAttempts: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 2,
  },
  bottomBar: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
});
