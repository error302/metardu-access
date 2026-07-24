/**
 * Database & Backup — manage local SQLite + cloud backups.
 *
 * Field data is the most valuable thing the surveyor produces.
 * This screen gives them visibility and control:
 *
 *   - Database size + table counts
 *   - Manual integrity check
 *   - Manual backup creation
 *   - Auto-backup configuration
 *   - Cloud provider selection (iCloud / Google Drive / WebDAV / local)
 *   - Backup history + restore
 *   - Database compaction (VACUUM)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Colors, Typography, Spacing, Radius } from '@/theme';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TextInput } from '@/components/TextInput';
import {
  fullIntegrityCheck,
  getDatabaseStats,
  compactDatabase,
  type IntegrityReport,
} from '@/lib/db/integrity';
import {
  listBackups,
  createBackup,
  restoreFromBackup,
  deleteBackup,
  getConfig,
  updateConfig,
  formatFileSize,
  type BackupEntry,
  type BackupConfig,
  type CloudProvider,
} from '@/lib/cloud/backup';
import { useAuthStore } from '@/stores/authStore';
import { field as haptics } from '@/lib/haptics';

export default function DatabaseSettingsScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);

  const [dbStats, setDbStats] = useState<{ fileSizeBytes: number; tableCount: number; rowCountByTable: Record<string, number> } | null>(null);
  const [integrity, setIntegrity] = useState<IntegrityReport | null>(null);
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [config, setConfig] = useState<BackupConfig | null>(null);
  const [checking, setChecking] = useState(false);
  const [backing, setBacking] = useState(false);
  const [compacting, setCompacting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [stats, bps, cfg] = await Promise.all([
        getDatabaseStats(),
        listBackups(),
        getConfig(),
      ]);
      setDbStats(stats);
      setBackups(bps);
      setConfig(cfg);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleIntegrityCheck = async () => {
    setChecking(true);
    try {
      const report = await fullIntegrityCheck();
      setIntegrity(report);
      if (report.status === 'ok') {
        await haptics.success();
        Alert.alert('Database healthy', 'Integrity check passed. Backups created.');
      } else if (report.status === 'restored-from-backup') {
        await haptics.warning();
        Alert.alert(
          'Database was corrupt',
          'Recovered from backup. Some recent data may be lost.',
        );
      } else if (report.status === 'unrecoverable') {
        await haptics.error();
        Alert.alert('Database unrecoverable', report.error ?? 'Unknown error');
      }
    } finally {
      setChecking(false);
    }
  };

  const handleCreateBackup = async () => {
    if (!profile) return;
    setBacking(true);
    try {
      const stats = await getDatabaseStats();
      const entry = await createBackup({
        surveyorEmail: profile.email,
        surveyorApiKey: profile.apiKey ?? '',
        projectCount: stats.rowCountByTable.projects ?? 0,
        pointCount: stats.rowCountByTable.points ?? 0,
      });
      await haptics.success();
      Alert.alert(
        'Backup created',
        `${formatFileSize(entry.fileSizeBytes)}${entry.encrypted ? ' (encrypted)' : ''}${entry.uploadedToCloud ? ' · uploaded to cloud' : ' · local only'}`,
      );
      await load();
    } catch (err: any) {
      await haptics.error();
      Alert.alert('Backup failed', err.message);
    } finally {
      setBacking(false);
    }
  };

  const handleCompact = async () => {
    Alert.alert(
      'Compact database?',
      'VACUUM reclaims space from deleted records. Takes 5-30 seconds. Don\'t close the app.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Compact',
          onPress: async () => {
            setCompacting(true);
            try {
              await compactDatabase();
              await haptics.success();
              Alert.alert('Compacted', 'Database compacted successfully.');
              await load();
            } catch (err: any) {
              Alert.alert('Failed', err.message);
            } finally {
              setCompacting(false);
            }
          },
        },
      ]
    );
  };

  const handleRestore = (entry: BackupEntry) => {
    Alert.alert(
      'Restore from backup?',
      `This will REPLACE your current database with the backup from ${new Date(entry.createdAt).toLocaleString()}.\n\nAny data captured after that backup will be LOST.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            try {
              await restoreFromBackup(entry.id, profile?.apiKey ?? '');
              await haptics.success();
              Alert.alert('Restored', 'Database restored from backup. Restart the app.');
            } catch (err: any) {
              Alert.alert('Restore failed', err.message);
            }
          },
        },
      ]
    );
  };

  const handleDeleteBackup = (entry: BackupEntry) => {
    Alert.alert(
      'Delete backup?',
      `Delete backup from ${new Date(entry.createdAt).toLocaleString()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteBackup(entry.id);
            await load();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF7F2' }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={'#0B1F3A'} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Database & Backup</Text>
          <Text style={styles.subtitle}>Protect your field data</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: Spacing[4], paddingBottom: Spacing[12] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
      >
        {/* Database stats */}
        <Text style={styles.sectionOverline}>Local database</Text>
        <Card style={{ marginBottom: Spacing[4] }}>
          {dbStats && (
            <>
              <StatRow label="File size" value={formatFileSize(dbStats.fileSizeBytes)} />
              <StatRow label="Tables" value={String(dbStats.tableCount)} />
              <StatRow label="Projects" value={String(dbStats.rowCountByTable.projects ?? 0)} />
              <StatRow label="Points" value={String(dbStats.rowCountByTable.points ?? 0)} />
              <StatRow label="Observations" value={String(dbStats.rowCountByTable.observations ?? 0)} />
              <StatRow label="Breaklines" value={String(dbStats.rowCountByTable.breaklines ?? 0)} />
              <StatRow label="GCPs" value={String(dbStats.rowCountByTable.gcps ?? 0)} />
              <StatRow label="Audit entries" value={String(dbStats.rowCountByTable.audit_log ?? 0)} />
            </>
          )}
        </Card>

        {/* Integrity check */}
        <Card style={{ marginBottom: Spacing[4] }}>
          <Text style={styles.cardTitle}>Integrity Check</Text>
          <Text style={styles.cardHelp}>
            Verifies the database file is not corrupted. Field conditions (battery death, drops, water) can damage SQLite files.
          </Text>
          <Button
            title={checking ? 'Checking...' : 'Run Integrity Check'}
            onPress={handleIntegrityCheck}
            loading={checking}
            fullWidth
            icon={<MaterialCommunityIcons name="shield-check-outline" size={18} color={'#FFFFFF'} />}
          />
          {integrity && (
            <View style={[styles.integrityResult, {
              backgroundColor: integrity.status === 'ok' ? '#D1FAE5' : '#FEE2E2',
              borderColor: integrity.status === 'ok' ? '#10B981' : '#EF4444',
            }]}>
              <MaterialCommunityIcons
                name={integrity.status === 'ok' ? 'check-circle' : 'alert-circle'}
                size={16}
                color={integrity.status === 'ok' ? '#10B981' : '#EF4444'}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.integrityStatus, { color: integrity.status === 'ok' ? '#10B981' : '#EF4444' }]}>
                  {integrity.status.toUpperCase()}
                </Text>
                {integrity.integrityCheck && (
                  <Text style={styles.integrityDetail}>{integrity.integrityCheck}</Text>
                )}
              </View>
            </View>
          )}
        </Card>

        {/* Backup configuration */}
        <Text style={styles.sectionOverline}>Backup configuration</Text>
        <Card style={{ marginBottom: Spacing[4] }}>
          {config && (
            <>
              <Text style={styles.cardTitle}>Cloud Provider</Text>
              <View style={styles.providerRow}>
                <ProviderChip
                  icon="apple-icloud"
                  label="iCloud"
                  active={config.provider === 'icloud'}
                  onPress={() => updateConfig({ provider: 'icloud' }).then(load)}
                />
                <ProviderChip
                  icon="google-drive"
                  label="Google Drive"
                  active={config.provider === 'gdrive'}
                  onPress={() => updateConfig({ provider: 'gdrive' }).then(load)}
                />
                <ProviderChip
                  icon="cloud-outline"
                  label="WebDAV"
                  active={config.provider === 'webdav'}
                  onPress={() => updateConfig({ provider: 'webdav' }).then(load)}
                />
                <ProviderChip
                  icon="cellphone"
                  label="Local only"
                  active={config.provider === 'local-only'}
                  onPress={() => updateConfig({ provider: 'local-only' }).then(load)}
                />
              </View>

              <TouchableOpacity
                onPress={() => updateConfig({ encryptionEnabled: !config.encryptionEnabled }).then(load)}
                style={styles.toggleRow}
              >
                <MaterialCommunityIcons
                  name={config.encryptionEnabled ? 'lock-check' : 'lock-open'}
                  size={18}
                  color={config.encryptionEnabled ? '#10B981' : '#9CA3AF'}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Encryption</Text>
                  <Text style={styles.toggleHelp}>Encrypt backups with surveyor API key</Text>
                </View>
                <View style={[styles.toggle, config.encryptionEnabled && styles.toggleOn]}>
                  <View style={[styles.toggleKnob, config.encryptionEnabled && styles.toggleKnobOn]} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => updateConfig({ autoBackup: !config.autoBackup }).then(load)}
                style={styles.toggleRow}
              >
                <MaterialCommunityIcons
                  name={config.autoBackup ? 'cloud-sync' : 'cloud-off'}
                  size={18}
                  color={config.autoBackup ? '#F97316' : '#9CA3AF'}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Auto-backup</Text>
                  <Text style={styles.toggleHelp}>Every {config.backupIntervalHours} hours when app is open</Text>
                </View>
                <View style={[styles.toggle, config.autoBackup && styles.toggleOn]}>
                  <View style={[styles.toggleKnob, config.autoBackup && styles.toggleKnobOn]} />
                </View>
              </TouchableOpacity>

              {config.lastBackupAt && (
                <Text style={styles.lastBackup}>
                  Last backup: {new Date(config.lastBackupAt).toLocaleString()}
                </Text>
              )}
            </>
          )}
        </Card>

        {/* Manual backup actions */}
        <View style={styles.actionRow}>
          <Button
            title={backing ? 'Creating...' : 'Create Backup'}
            onPress={handleCreateBackup}
            loading={backing}
            style={{ flex: 1 }}
            icon={<MaterialCommunityIcons name="cloud-upload" size={18} color={'#FFFFFF'} />}
          />
          <Button
            title={compacting ? 'Compacting...' : 'Compact'}
            variant="outline"
            onPress={handleCompact}
            loading={compacting}
            style={{ flex: 1 }}
          />
        </View>

        {/* Backup history */}
        <Text style={styles.sectionOverline}>Backup history ({backups.length})</Text>
        {backups.length === 0 ? (
          <Card variant="outline" style={{ alignItems: 'center', padding: Spacing[6] }}>
            <MaterialCommunityIcons name="cloud-off-outline" size={28} color={'#9CA3AF'} />
            <Text style={styles.emptyTitle}>No backups yet</Text>
            <Text style={styles.emptySub}>Create your first backup above.</Text>
          </Card>
        ) : (
          <View style={{ gap: Spacing[2] }}>
            {backups.map((entry) => (
              <Card key={entry.id} style={{ padding: Spacing[3] }}>
                <View style={styles.backupRow}>
                  <View style={[styles.backupIcon, { backgroundColor: #F9731615 }]}>
                    <MaterialCommunityIcons
                      name={entry.encrypted ? 'lock' : 'database'}
                      size={18}
                      color={'#F97316'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.backupDate}>
                      {new Date(entry.createdAt).toLocaleString()}
                    </Text>
                    <Text style={styles.backupMeta}>
                      {formatFileSize(entry.fileSizeBytes)} · {entry.projectCount} projects · {entry.pointCount} pts
                      {entry.encrypted ? ' · encrypted' : ''}
                    </Text>
                    <View style={styles.backupBadges}>
                      <Badge
                        label={entry.uploadedToCloud ? 'CLOUD' : 'LOCAL'}
                        color={entry.uploadedToCloud ? '#10B981' : '#6B7280'}
                      />
                      <Badge label={entry.provider.toUpperCase()} color={'#3B82F6'} />
                    </View>
                  </View>
                </View>
                <View style={styles.backupActions}>
                  <Button
                    title="Restore"
                    variant="outline"
                    size="sm"
                    onPress={() => handleRestore(entry)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Delete"
                    variant="danger"
                    size="sm"
                    onPress={() => handleDeleteBackup(entry)}
                    style={{ flex: 1 }}
                  />
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function ProviderChip({
  icon,
  label,
  active,
  onPress,
}: {
  icon: string;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.providerChip, active && styles.providerChipActive]}
    >
      <MaterialCommunityIcons
        name={icon as any}
        size={14}
        color={active ? '#FFFFFF' : '#0B1F3A'}
      />
      <Text style={[styles.providerChipText, active && styles.providerChipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}15` }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
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
  cardTitle: {
    fontFamily: Typography.fontFamily.sansMedium,
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    color: '#0B1F3A',
    marginBottom: Spacing[2],
  },
  cardHelp: {
    fontFamily: Typography.fontFamily.sans,
    fontSize: Typography.fontSize.xs,
    color: '#6B7280',
    lineHeight: 17,
    marginBottom: Spacing[3],
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  statLabel: {
    fontFamily: Typography.fontFamily.sans,
    fontSize: Typography.fontSize.sm,
    color: '#6B7280',
  },
  statValue: {
    fontFamily: Typography.fontFamily.mono,
    fontSize: Typography.fontSize.sm,
    fontWeight: '500',
    color: '#0B1F3A',
  },
  integrityResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    padding: Spacing[3],
    borderRadius: Radius.md,
    borderWidth: 1,
    marginTop: Spacing[3],
  },
  integrityStatus: {
    fontFamily: Typography.fontFamily.sansBold,
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
  },
  integrityDetail: {
    fontFamily: Typography.fontFamily.mono,
    fontSize: Typography.fontSize['2xs'],
    color: '#4B5563',
    marginTop: 2,
  },
  providerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[2],
    marginBottom: Spacing[4],
  },
  providerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[1.5],
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  providerChipActive: {
    backgroundColor: '#0B1F3A',
    borderColor: '#0B1F3A',
  },
  providerChipText: {
    fontFamily: Typography.fontFamily.sansMedium,
    fontSize: Typography.fontSize.xs,
    fontWeight: '500',
    color: '#0B1F3A',
  },
  providerChipTextActive: {
    color: '#FFFFFF',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingVertical: Spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  toggleLabel: {
    fontFamily: Typography.fontFamily.sansMedium,
    fontSize: Typography.fontSize.sm,
    fontWeight: '500',
    color: '#0B1F3A',
  },
  toggleHelp: {
    fontFamily: Typography.fontFamily.sans,
    fontSize: Typography.fontSize.xs,
    color: '#6B7280',
    marginTop: 1,
  },
  toggle: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    padding: 2,
    justifyContent: 'center',
  },
  toggleOn: {
    backgroundColor: '#F97316',
  },
  toggleKnob: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
  },
  lastBackup: {
    fontFamily: Typography.fontFamily.mono,
    fontSize: Typography.fontSize['2xs'],
    color: '#6B7280',
    marginTop: Spacing[2],
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing[2],
    marginBottom: Spacing[6],
  },
  emptyTitle: {
    fontFamily: Typography.fontFamily.sansMedium,
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    color: '#0B1F3A',
    marginTop: Spacing[2],
  },
  emptySub: {
    fontFamily: Typography.fontFamily.sans,
    fontSize: Typography.fontSize.xs,
    color: '#6B7280',
    marginTop: 4,
  },
  backupRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3],
    marginBottom: Spacing[3],
  },
  backupIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backupDate: {
    fontFamily: Typography.fontFamily.sansMedium,
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    color: '#0B1F3A',
  },
  backupMeta: {
    fontFamily: Typography.fontFamily.mono,
    fontSize: Typography.fontSize['2xs'],
    color: '#6B7280',
    marginTop: 2,
  },
  backupBadges: {
    flexDirection: 'row',
    gap: Spacing[1.5],
    marginTop: Spacing[2],
  },
  badge: {
    paddingHorizontal: Spacing[2],
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  badgeText: {
    fontFamily: Typography.fontFamily.sansBold,
    fontSize: 9,
    fontWeight: '700',
  },
  backupActions: {
    flexDirection: 'row',
    gap: Spacing[2],
  },
});
