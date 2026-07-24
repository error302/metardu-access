/**
 * Audit Log screen — regulatory tamper-evident log.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { getAuditLog } from '@/lib/db/queries';
import type { AuditEntry } from '@/types';

const ACTION_ICONS: Record<string, string> = {
  create_session: 'folder-plus',
  add_point: 'map-marker-plus',
  add_observation: 'angle-acute',
  edit_point: 'pencil',
  delete_point: 'map-marker-remove',
  seal_session: 'lock',
  sync_session: 'cloud-upload',
  export_session: 'file-export',
  login: 'login',
  logout: 'logout',
  settings_change: 'cog',
};

export default function AuditLogScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAuditLog(undefined, 200).then((e) => {
      setEntries(e);
      setLoading(false);
    });
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF7F2' }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={'#0B1F3A'} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Audit Log</Text>
          <Text style={styles.subtitle}>{entries.length} entries · tamper-evident</Text>
        </View>
      </View>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 8, padding: 12 }}>
            <View style={styles.entryRow}>
              <View style={styles.entryIcon}>
                <MaterialCommunityIcons
                  name={(ACTION_ICONS[item.action] ?? 'circle-outline') as any}
                  size={16}
                  color={'#0B1F3A'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.entryAction}>{item.action.replace(/_/g, ' ')}</Text>
                <Text style={styles.entryMeta}>
                  {item.entityType} · {item.entityId.slice(0, 8)}
                </Text>
                {item.metadata && (
                  <Text style={styles.entryData}>
                    {JSON.stringify(item.metadata).slice(0, 100)}
                  </Text>
                )}
              </View>
              <Text style={styles.entryTime}>
                {new Date(item.timestamp).toLocaleString()}
              </Text>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="clipboard-list-outline"
            title="No audit entries yet"
            subtitle="Actions you take will be logged here for regulatory compliance."
          />
        }
        refreshing={loading}
        onRefresh={() => {
          setLoading(true);
          getAuditLog(undefined, 200).then((e) => {
            setEntries(e);
            setLoading(false);
          });
        }}
      />
    </SafeAreaView>
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
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  entryIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryAction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0B1F3A',
    textTransform: 'capitalize',
  },
  entryMeta: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    fontFamily: 'JetBrainsMono',
  },
  entryData: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
    fontFamily: 'JetBrainsMono',
  },
  entryTime: {
    fontSize: 10,
    color: '#9CA3AF',
    fontFamily: 'JetBrainsMono',
  },
});
