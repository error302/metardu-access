/**
 * Profile tab — surveyor profile, settings, sync, sign out.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Colors } from '@/theme';
import { Card } from '@/components/Card';
import { LogoMark } from '@/components/LogoMark';
import { Button } from '@/components/Button';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { getSyncQueue } from '@/lib/db/queries';
import { getSyncEngine } from '@/lib/sync/engine';
import * as Application from 'expo-application';
import React, { useState, useEffect, useCallback } from 'react';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const outdoorMode = useSettingsStore((s) => s.outdoorMode);
  const toggleOutdoor = useSettingsStore((s) => s.toggleOutdoorMode);
  const highContrast = useSettingsStore((s) => s.highContrast);
  const toggleContrast = useSettingsStore((s) => s.toggleHighContrast);
  const locale = useSettingsStore((s) => s.locale);
  const setLocale = useSettingsStore((s) => s.setLocale);
  const autoSync = useSettingsStore((s) => s.autoSync);
  const toggleAutoSync = useSettingsStore((s) => s.toggleAutoSync);

  const [serverHealth, setServerHealth] = useState<{
    online: boolean;
    latencyMs?: number;
    stats?: any;
    checking: boolean;
  }>({ online: false, checking: false });

  const checkServerHealth = useCallback(async () => {
    setServerHealth({ online: false, checking: true });
    try {
      const engine = getSyncEngine();
      const result = await engine.checkHealth();
      setServerHealth({ ...result, checking: false });
    } catch (err: any) {
      setServerHealth({ online: false, checking: false });
    }
  }, []);

  useEffect(() => {
    checkServerHealth();
  }, [checkServerHealth]);

  const handleSignOut = () => {
    Alert.alert(
      t('auth.signOut'),
      'Are you sure you want to sign out?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('auth.signOut'),
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/auth/login');
          },
        },
      ]
    );
  };

  const handleSyncNow = async () => {
    try {
      const engine = getSyncEngine();
      const queue = await getSyncQueue();
      if (queue.length === 0) {
        Alert.alert('Sync', 'Sync queue is empty. Nothing to push.');
        return;
      }
      const result = await engine.drainQueue();
      Alert.alert(
        'Sync complete',
        `Pushed: ${result.pushed}\nFailed: ${result.failed}`
      );
    } catch (err: any) {
      Alert.alert('Sync failed', err.message);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.metarduCream }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Profile card */}
        <Card variant="elevated" style={{ alignItems: 'center', padding: 24, marginBottom: 16 }}>
          <LogoMark size={64} />
          <Text style={styles.profileName}>{profile?.fullName ?? 'Surveyor'}</Text>
          <Text style={styles.profileEmail}>{profile?.email}</Text>
          <View style={styles.iskBadge}>
            <MaterialCommunityIcons name="shield-check" size={14} color={Colors.metarduOrange} />
            <Text style={styles.iskText}>{profile?.iskNumber ?? 'ISK/—'}</Text>
            {profile?.verifiedIsk ? (
              <MaterialCommunityIcons name="check-decagram" size={14} color={Colors.success} />
            ) : (
              <Text style={styles.iskPending}>pending</Text>
            )}
          </View>
          {profile?.firmName && (
            <Text style={styles.firmName}>{profile.firmName}</Text>
          )}
        </Card>

        {/* Sync server health */}
        <Card style={{ marginBottom: 16 }}>
          <View style={styles.healthRow}>
            <View style={[
              styles.healthDot,
              serverHealth.checking
                ? { backgroundColor: Colors.warning }
                : serverHealth.online
                  ? { backgroundColor: Colors.success }
                  : { backgroundColor: Colors.danger },
            ]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.healthTitle}>
                {serverHealth.checking
                  ? 'Checking sync server...'
                  : serverHealth.online
                    ? 'Sync server online'
                    : 'Sync server offline'}
              </Text>
              <Text style={styles.healthSubtitle} numberOfLines={1}>
                {serverHealth.online
                  ? `${serverHealth.latencyMs ?? 0}ms · ${serverHealth.stats?.sessions ?? 0} sessions stored`
                  : 'Run the mock server: cd mock-sync-server && npm start'}
              </Text>
            </View>
            <TouchableOpacity onPress={checkServerHealth} style={{ padding: 4 }}>
              <MaterialCommunityIcons
                name={serverHealth.checking ? 'loading' : 'refresh'}
                size={18}
                color={Colors.metarduOrange}
              />
            </TouchableOpacity>
          </View>
        </Card>

        {/* Sync */}
        <Text style={styles.sectionTitle}>{t('settings.sync')}</Text>
        <Card>
          <SettingRow
            icon="cloud-sync"
            label={t('settings.autoSync')}
            sublabel={t('settings.autoSyncHelp')}
            value={autoSync}
            onToggle={toggleAutoSync}
          />
          <TouchableOpacity onPress={handleSyncNow} style={styles.actionRow}>
            <MaterialCommunityIcons name="sync" size={20} color={Colors.metarduOrange} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionLabel}>{t('sync.syncNow')}</Text>
              <Text style={styles.actionSublabel}>Push pending sessions to the server</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.gray400} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/sync/queue')}
            style={styles.actionRow}
          >
            <MaterialCommunityIcons name="cloud-upload" size={20} color={Colors.metarduOrange} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionLabel}>{t('sync.queue')}</Text>
              <Text style={styles.actionSublabel}>View pending sync items</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.gray400} />
          </TouchableOpacity>
        </Card>

        {/* Appearance */}
        <Text style={styles.sectionTitle}>{t('settings.appearance')}</Text>
        <Card>
          <SettingRow
            icon="white-balance-sunny"
            label={t('settings.outdoorMode')}
            sublabel={t('settings.outdoorModeHelp')}
            value={outdoorMode}
            onToggle={toggleOutdoor}
          />
          <SettingRow
            icon="contrast"
            label={t('settings.highContrast')}
            value={highContrast}
            onToggle={toggleContrast}
          />
          <View style={styles.actionRow}>
            <MaterialCommunityIcons name="translate" size={20} color={Colors.metarduNavy} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionLabel}>{t('settings.language')}</Text>
            </View>
            <View style={styles.localeToggle}>
              <TouchableOpacity
                onPress={() => setLocale('en')}
                style={[
                  styles.localeBtn,
                  locale === 'en' && styles.localeBtnActive,
                ]}
              >
                <Text style={[styles.localeText, locale === 'en' && styles.localeTextActive]}>
                  EN
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setLocale('sw')}
                style={[
                  styles.localeBtn,
                  locale === 'sw' && styles.localeBtnActive,
                ]}
              >
                <Text style={[styles.localeText, locale === 'sw' && styles.localeTextActive]}>
                  SW
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>

        {/* Settings */}
        <Text style={styles.sectionTitle}>{t('settings.title')}</Text>
        <Card>
          <TouchableOpacity
            onPress={() => router.push('/settings')}
            style={styles.actionRow}
          >
            <MaterialCommunityIcons name="cog" size={20} color={Colors.metarduNavy} />
            <Text style={styles.actionLabel}>All Settings</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.gray400} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/settings/audit')}
            style={styles.actionRow}
          >
            <MaterialCommunityIcons name="clipboard-list" size={20} color={Colors.metarduNavy} />
            <Text style={styles.actionLabel}>Audit Log</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.gray400} />
          </TouchableOpacity>
        </Card>

        {/* About */}
        <Text style={styles.sectionTitle}>{t('settings.about')}</Text>
        <Card>
          <View style={styles.actionRow}>
            <MaterialCommunityIcons name="information" size={20} color={Colors.metarduNavy} />
            <Text style={styles.actionLabel}>{t('settings.version')}</Text>
            <Text style={styles.versionText}>
              {Application.nativeApplicationVersion ?? '0.1.0'}
            </Text>
          </View>
        </Card>

        <Button
          title={t('auth.signOut')}
          onPress={handleSignOut}
          variant="danger"
          fullWidth
          style={{ marginTop: 24 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingRow({
  icon,
  label,
  sublabel,
  value,
  onToggle,
}: {
  icon: string;
  label: string;
  sublabel?: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.actionRow}>
      <MaterialCommunityIcons name={icon as any} size={20} color={Colors.metarduNavy} />
      <View style={{ flex: 1 }}>
        <Text style={styles.actionLabel}>{label}</Text>
        {sublabel && <Text style={styles.actionSublabel}>{sublabel}</Text>}
      </View>
      <TouchableOpacity onPress={onToggle} style={styles.toggle}>
        <View
          style={[
            styles.toggleKnob,
            value ? styles.toggleKnobOn : styles.toggleKnobOff,
          ]}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.metarduNavy,
    marginTop: 12,
  },
  profileEmail: {
    fontSize: 14,
    color: Colors.gray500,
    marginTop: 2,
  },
  iskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${Colors.metarduOrange}15`,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 12,
  },
  iskText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.metarduOrange,
  },
  iskPending: {
    fontSize: 10,
    color: Colors.warning,
    fontWeight: '500',
  },
  firmName: {
    fontSize: 12,
    color: Colors.gray500,
    marginTop: 8,
  },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  healthDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  healthTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.metarduNavy,
  },
  healthSubtitle: {
    fontSize: 11,
    color: Colors.gray500,
    marginTop: 2,
    fontFamily: 'JetBrainsMono',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.gray200,
  },
  actionLabel: {
    fontSize: 15,
    color: Colors.metarduNavy,
    fontWeight: '500',
  },
  actionSublabel: {
    fontSize: 12,
    color: Colors.gray500,
    marginTop: 2,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.gray200,
    padding: 2,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.metarduWhite,
  },
  toggleKnobOn: {
    backgroundColor: Colors.metarduOrange,
    alignSelf: 'flex-end',
  },
  toggleKnobOff: {
    backgroundColor: Colors.gray400,
    alignSelf: 'flex-start',
  },
  localeToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.gray100,
    borderRadius: 8,
    padding: 2,
  },
  localeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  localeBtnActive: {
    backgroundColor: Colors.metarduWhite,
    shadowColor: Colors.metarduNavy,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  localeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.gray500,
  },
  localeTextActive: {
    color: Colors.metarduNavy,
  },
  versionText: {
    fontSize: 14,
    color: Colors.gray500,
    fontFamily: 'JetBrainsMono',
  },
});
