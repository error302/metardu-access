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

import { Colors } from '@/theme';
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
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.metarduCream }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.metarduNavy} />
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
            <MaterialCommunityIcons name="translate" size={20} color={Colors.metarduNavy} />
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
            <MaterialCommunityIcons name="ruler" size={20} color={Colors.metarduNavy} />
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
            <MaterialCommunityIcons name="angle-acute" size={20} color={Colors.metarduNavy} />
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
            <MaterialCommunityIcons name="key" size={20} color={Colors.metarduNavy} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionLabel}>{t('settings.apiKey')}</Text>
              <Text style={styles.actionSublabel} numberOfLines={1}>
                {profile?.apiKey ? `${profile.apiKey.slice(0, 12)}...` : 'Not set'}
              </Text>
            </View>
            <MaterialCommunityIcons name="content-copy" size={18} color={Colors.metarduOrange} />
          </TouchableOpacity>
        </Section>

        {/* Field Tools */}
        <Section title="Field Tools">
          <TouchableOpacity
            onPress={() => router.push('/settings/gnss-rtk')}
            style={styles.actionRow}
          >
            <MaterialCommunityIcons name="antenna" size={20} color={Colors.metarduNavy} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionLabel}>GNSS / RTK Settings</Text>
              <Text style={styles.actionSublabel}>NTRIP corrections + external receivers</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.gray400} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/instruments')}
            style={styles.actionRow}
          >
            <MaterialCommunityIcons name="radio-tower" size={20} color={Colors.metarduNavy} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionLabel}>Instruments (Total Stations)</Text>
              <Text style={styles.actionSublabel}>Bluetooth connectivity for Trimble, Leica, Topcon</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.gray400} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/settings/offline-maps')}
            style={styles.actionRow}
          >
            <MaterialCommunityIcons name="map-marker-radius" size={20} color={Colors.metarduNavy} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionLabel}>Offline Maps</Text>
              <Text style={styles.actionSublabel}>MBTiles basemaps for field use</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.gray400} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/settings/beacon-library')}
            style={styles.actionRow}
          >
            <MaterialCommunityIcons name="book-open-variant" size={20} color={Colors.metarduNavy} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionLabel}>Beacon Library</Text>
              <Text style={styles.actionSublabel}>Kenya standard beacon specifications</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.gray400} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/settings/database')}
            style={styles.actionRow}
          >
            <MaterialCommunityIcons name="database-cog" size={20} color={Colors.metarduNavy} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionLabel}>Database & Backup</Text>
              <Text style={styles.actionSublabel}>Integrity check · cloud backup · restore</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.gray400} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/sync/conflicts')}
            style={styles.actionRow}
          >
            <MaterialCommunityIcons name="cloud-braces" size={20} color={Colors.metarduNavy} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionLabel}>Sync Conflicts</Text>
              <Text style={styles.actionSublabel}>Review and resolve divergences</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.gray400} />
          </TouchableOpacity>
        </Section>

        {/* About */}
        <Section title={t('settings.about')}>
          <View style={styles.actionRow}>
            <MaterialCommunityIcons name="information" size={20} color={Colors.metarduNavy} />
            <Text style={styles.actionLabel}>{t('settings.version')}</Text>
            <Text style={styles.versionText}>
              {Application.nativeApplicationVersion ?? '0.1.0'}
            </Text>
          </View>
          <View style={styles.actionRow}>
            <MaterialCommunityIcons name="github" size={20} color={Colors.metarduNavy} />
            <Text style={styles.actionLabel}>Repository</Text>
            <Text style={styles.versionText}>error302/metardu-access</Text>
          </View>
          <View style={styles.actionRow}>
            <MaterialCommunityIcons name="earth" size={20} color={Colors.metarduNavy} />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.metarduNavy,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gray500,
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
    borderBottomColor: Colors.gray200,
  },
  actionLabel: {
    flex: 1,
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
    fontSize: 13,
    color: Colors.gray500,
    fontFamily: 'JetBrainsMono',
  },
});
