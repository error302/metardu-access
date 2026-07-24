/**
 * Settings screen — full settings list.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/Card';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAuthStore } from '@/stores/authStore';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const settings = useSettingsStore();
  const profile = useAuthStore((s) => s.profile);

  const copyApiKey = async () => {
    if (profile?.apiKey) {
      await Clipboard.setStringAsync(profile.apiKey);
      Alert.alert('Copied', 'API key copied to clipboard');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF7F2' }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={'#0B1F3A'} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('settings.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Appearance */}
        <Section title={t('settings.appearance')}>
          <ToggleRow
            icon="white-balance-sunny"
            label={t('settings.outdoorMode')}
            sublabel={t('settings.outdoorModeHelp')}
            value={settings.outdoorMode}
            onToggle={settings.toggleOutdoorMode}
          />
          <ToggleRow
            icon="contrast"
            label={t('settings.highContrast')}
            value={settings.highContrast}
            onToggle={settings.toggleHighContrast}
          />
          <View style={styles.actionRow}>
            <MaterialCommunityIcons name="translate" size={20} color={'#0B1F3A'} />
            <Text style={styles.actionLabel}>{t('settings.language')}</Text>
            <View style={styles.localeToggle}>
              {(['en', 'sw'] as const).map((l) => (
                <TouchableOpacity
                  key={l}
                  onPress={() => settings.setLocale(l)}
                  style={[
                    styles.localeBtn,
                    settings.locale === l && styles.localeBtnActive,
                  ]}
                >
                  <Text style={[styles.localeText, settings.locale === l && styles.localeTextActive]}>
                    {l.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Section>

        {/* Units */}
        <Section title={t('settings.units')}>
          <View style={styles.actionRow}>
            <MaterialCommunityIcons name="ruler" size={20} color={'#0B1F3A'} />
            <Text style={styles.actionLabel}>{t('settings.distanceUnit')}</Text>
            <View style={styles.localeToggle}>
              {(['metric', 'imperial'] as const).map((u) => (
                <TouchableOpacity
                  key={u}
                  onPress={() => settings.setDistanceUnit(u)}
                  style={[
                    styles.localeBtn,
                    settings.distanceUnit === u && styles.localeBtnActive,
                  ]}
                >
                  <Text style={[styles.localeText, settings.distanceUnit === u && styles.localeTextActive]}>
                    {u === 'metric' ? 'm' : 'ft'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.actionRow}>
            <MaterialCommunityIcons name="angle-acute" size={20} color={'#0B1F3A'} />
            <Text style={styles.actionLabel}>{t('settings.angleUnit')}</Text>
            <View style={styles.localeToggle}>
              {(['degrees', 'gons'] as const).map((u) => (
                <TouchableOpacity
                  key={u}
                  onPress={() => settings.setAngleUnit(u)}
                  style={[
                    styles.localeBtn,
                    settings.angleUnit === u && styles.localeBtnActive,
                  ]}
                >
                  <Text style={[styles.localeText, settings.angleUnit === u && styles.localeTextActive]}>
                    {u === 'degrees' ? '°' : 'g'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Section>

        {/* Sync */}
        <Section title={t('settings.sync')}>
          <ToggleRow
            icon="cloud-sync"
            label={t('settings.autoSync')}
            sublabel={t('settings.autoSyncHelp')}
            value={settings.autoSync}
            onToggle={settings.toggleAutoSync}
          />
          <ToggleRow
            icon="map-outline"
            label={t('settings.mapTileCache')}
            value={settings.mapTileCache}
            onToggle={settings.toggleMapTileCache}
          />
          <TouchableOpacity onPress={copyApiKey} style={styles.actionRow}>
            <MaterialCommunityIcons name="key" size={20} color={'#0B1F3A'} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionLabel}>{t('settings.apiKey')}</Text>
              <Text style={styles.actionSublabel} numberOfLines={1}>
                {profile?.apiKey ? `${profile.apiKey.slice(0, 12)}...` : 'Not set'}
              </Text>
            </View>
            <MaterialCommunityIcons name="content-copy" size={18} color={'#F97316'} />
          </TouchableOpacity>
        </Section>

        {/* Field Tools */}
        <Section title="Field Tools">
          <TouchableOpacity
            onPress={() => router.push('/settings/gnss-rtk')}
            style={styles.actionRow}
          >
            <MaterialCommunityIcons name="antenna" size={20} color={'#0B1F3A'} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionLabel}>GNSS / RTK Settings</Text>
              <Text style={styles.actionSublabel}>NTRIP corrections + external receivers</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={'#9CA3AF'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/instruments')}
            style={styles.actionRow}
          >
            <MaterialCommunityIcons name="radio-tower" size={20} color={'#0B1F3A'} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionLabel}>Instruments (Total Stations)</Text>
              <Text style={styles.actionSublabel}>Bluetooth connectivity for Trimble, Leica, Topcon</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={'#9CA3AF'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/settings/offline-maps')}
            style={styles.actionRow}
          >
            <MaterialCommunityIcons name="map-marker-radius" size={20} color={'#0B1F3A'} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionLabel}>Offline Maps</Text>
              <Text style={styles.actionSublabel}>MBTiles basemaps for field use</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={'#9CA3AF'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/settings/beacon-library')}
            style={styles.actionRow}
          >
            <MaterialCommunityIcons name="book-open-variant" size={20} color={'#0B1F3A'} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionLabel}>Beacon Library</Text>
              <Text style={styles.actionSublabel}>Kenya standard beacon specifications</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={'#9CA3AF'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/settings/database')}
            style={styles.actionRow}
          >
            <MaterialCommunityIcons name="database-cog" size={20} color={'#0B1F3A'} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionLabel}>Database & Backup</Text>
              <Text style={styles.actionSublabel}>Integrity check · cloud backup · restore</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={'#9CA3AF'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/sync/conflicts')}
            style={styles.actionRow}
          >
            <MaterialCommunityIcons name="cloud-braces" size={20} color={'#0B1F3A'} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionLabel}>Sync Conflicts</Text>
              <Text style={styles.actionSublabel}>Review and resolve divergences</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={'#9CA3AF'} />
          </TouchableOpacity>
        </Section>

        {/* About */}
        <Section title={t('settings.about')}>
          <View style={styles.actionRow}>
            <MaterialCommunityIcons name="information" size={20} color={'#0B1F3A'} />
            <Text style={styles.actionLabel}>{t('settings.version')}</Text>
            <Text style={styles.versionText}>
              {Application.nativeApplicationVersion ?? '0.1.0'}
            </Text>
          </View>
          <View style={styles.actionRow}>
            <MaterialCommunityIcons name="github" size={20} color={'#0B1F3A'} />
            <Text style={styles.actionLabel}>Repository</Text>
            <Text style={styles.versionText}>error302/metardu-access</Text>
          </View>
          <View style={styles.actionRow}>
            <MaterialCommunityIcons name="earth" size={20} color={'#0B1F3A'} />
            <Text style={styles.actionLabel}>Country Pack</Text>
            <Text style={styles.versionText}>KEN · EPSG:21037</Text>
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Card>{children}</Card>
    </View>
  );
}

function ToggleRow({
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
      <MaterialCommunityIcons name={icon as any} size={20} color={'#0B1F3A'} />
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
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  actionLabel: {
    flex: 1,
    fontSize: 15,
    color: '#0B1F3A',
    fontWeight: '500',
  },
  actionSublabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    padding: 2,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  toggleKnobOn: {
    backgroundColor: '#F97316',
    alignSelf: 'flex-end',
  },
  toggleKnobOff: {
    backgroundColor: '#9CA3AF',
    alignSelf: 'flex-start',
  },
  localeToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 2,
  },
  localeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  localeBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0B1F3A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  localeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  localeTextActive: {
    color: '#0B1F3A',
  },
  versionText: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'JetBrainsMono',
  },
});
