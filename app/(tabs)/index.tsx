/**
 * Home tab v2 — modern dashboard with realtime presence.
 *
 * Redesign principles (inspired by Linear / Vercel):
 *   - Generous whitespace
 *   - Tight letter-spacing on display headings
 *   - Status dots (not heavy badges)
 *   - Monospace for technical values
 *   - Clear visual hierarchy
 *   - Live data when available, friendly empty states when not
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Battery from 'expo-battery';

import {
  BrandColors,
  SemanticColors,
  NeutralColors,
  LightColors,
  DarkColors,
  Typography,
  Spacing,
  Radius,
  SurveyTypeConfig,
  PresenceStatusConfig,
} from '@/theme';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import { usePresenceStore } from '@/stores/presenceStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { LogoMark } from '@/components/LogoMark';
import { field as haptics } from '@/lib/haptics';
import type { PresenceEvent } from '@/lib/realtime/sync';

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const projects = useProjectStore((s) => s.projects);
  const loadProjects = useProjectStore((s) => s.load);
  const peers = usePresenceStore((s) => s.peers);
  const realtimeConnected = usePresenceStore((s) => s.realtimeConnected);
  const initPresence = usePresenceStore((s) => s.initialize);
  const outdoorMode = useSettingsStore((s) => s.outdoorMode);

  const systemScheme = useColorScheme();
  const isDark = outdoorMode || systemScheme === 'dark';
  const colors = outdoorMode ? (DarkColors as any) : isDark ? DarkColors : LightColors;

  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [batteryState, setBatteryState] = useState<Battery.BatteryState>(Battery.BatteryState.UNKNOWN);

  useEffect(() => {
    loadProjects();
    initPresence();

    // Battery monitoring
    Battery.getBatteryLevelAsync().then(setBatteryLevel);
    Battery.getBatteryStateAsync().then(setBatteryState);
    const sub = Battery.addBatteryStateListener(({ batteryState }) => {
      setBatteryState(batteryState);
      Battery.getBatteryLevelAsync().then(setBatteryLevel);
    });
    return () => sub.remove();
  }, []);

  const recentProjects = projects.slice(0, 4);
  const activeCount = projects.filter((p) => p.status === 'active' || p.status === 'draft').length;
  const syncedCount = projects.filter((p) => p.syncStatus === 'synced').length;
  const onlinePeers = peers.filter((p) => p.status !== 'offline');

  const batteryPercent = batteryLevel !== null ? Math.round(batteryLevel * 100) : null;
  const batteryColor = batteryPercent === null ? NeutralColors.gray400 :
    batteryPercent > 50 ? SemanticColors.success :
    batteryPercent > 20 ? SemanticColors.warning :
    SemanticColors.danger;

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: Spacing[4], paddingBottom: Spacing[12] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header bar — minimal, status-focused */}
        <View style={styles.headerBar}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.overline, { color: colors.fgMuted }]}>
              {greeting}
            </Text>
            <Text style={[styles.displayName, { color: colors.fg }]} numberOfLines={1}>
              {profile?.fullName ?? 'Surveyor'}
            </Text>
          </View>

          <View style={styles.statusBar}>
            {/* Realtime status */}
            <View style={[styles.statusPill, { backgroundColor: colors.bgSubtle }]}>
              <View style={[
                styles.statusDot,
                { backgroundColor: realtimeConnected ? SemanticColors.success : NeutralColors.gray400 },
              ]} />
              <Text style={[styles.statusPillText, { color: colors.fgSecondary }]}>
                {realtimeConnected ? 'Live' : 'Offline'}
              </Text>
            </View>

            {/* Battery */}
            {batteryPercent !== null && (
              <View style={[styles.statusPill, { backgroundColor: colors.bgSubtle }]}>
                <MaterialCommunityIcons
                  name={
                    batteryState === Battery.BatteryState.CHARGING ? 'battery-charging' :
                    batteryPercent > 50 ? 'battery' :
                    batteryPercent > 20 ? 'battery-30' : 'battery-alert'
                  }
                  size={12}
                  color={batteryColor}
                />
                <Text style={[styles.statusPillText, { color: colors.fgSecondary }]}>
                  {batteryPercent}%
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ISK badge */}
        {profile && (
          <View style={[styles.iskRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <MaterialCommunityIcons
              name={profile.verifiedIsk ? 'shield-check' : 'shield-outline'}
              size={16}
              color={profile.verifiedIsk ? SemanticColors.success : SemanticColors.warning}
            />
            <Text style={[styles.iskNumber, { color: colors.fgSecondary }]}>
              {profile.iskNumber}
            </Text>
            <Text style={[styles.iskStatus, {
              color: profile.verifiedIsk ? SemanticColors.success : SemanticColors.warning,
            }]}>
              {profile.verifiedIsk ? 'Verified' : 'Pending'}
            </Text>
          </View>
        )}

        {/* Stats row — clean, minimal */}
        <View style={styles.statsRow}>
          <StatCard
            label="Projects"
            value={projects.length}
            icon="folder-multiple-outline"
            color={BrandColors.metarduOrange}
            colors={colors}
          />
          <StatCard
            label="Active"
            value={activeCount}
            icon="clipboard-pulse-outline"
            color={SemanticColors.info}
            colors={colors}
          />
          <StatCard
            label="Synced"
            value={syncedCount}
            icon="cloud-check-outline"
            color={SemanticColors.success}
            colors={colors}
          />
        </View>

        {/* Quick actions — survey type grid */}
        <Text style={[styles.sectionOverline, { color: colors.fgMuted }]}>
          Start new survey
        </Text>
        <View style={styles.quickActionGrid}>
          <QuickAction
            icon="map-marker-radius-outline"
            label="Cadastral"
            color={BrandColors.metarduOrange}
            colors={colors}
            onPress={() => router.push('/projects/new?type=cadastral')}
          />
          <QuickAction
            icon="ruler-square-compass-outline"
            label="Engineering"
            color={SemanticColors.info}
            colors={colors}
            onPress={() => router.push('/projects/new?type=engineering')}
          />
          <QuickAction
            icon="terrain"
            label="Topographic"
            color={SemanticColors.success}
            colors={colors}
            onPress={() => router.push('/projects/new?type=topographic')}
          />
          <QuickAction
            icon="home-city-outline"
            label="Sectional"
            color={SemanticColors.warning}
            colors={colors}
            onPress={() => router.push('/projects/new?type=sectional')}
          />
        </View>

        {/* Live team — presence indicators */}
        {onlinePeers.length > 0 && (
          <>
            <Text style={[styles.sectionOverline, { color: colors.fgMuted }]}>
              Live · {onlinePeers.length} online
            </Text>
            <View style={[styles.presenceCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              {onlinePeers.slice(0, 5).map((peer) => (
                <PeerRow key={peer.surveyorId} peer={peer} colors={colors} />
              ))}
              {onlinePeers.length > 5 && (
                <Text style={[styles.morePeers, { color: colors.fgMuted }]}>
                  +{onlinePeers.length - 5} more
                </Text>
              )}
            </View>
          </>
        )}

        {/* Recent projects */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionOverline, { color: colors.fgMuted }]}>
            Recent projects
          </Text>
          {projects.length > 4 && (
            <TouchableOpacity onPress={() => router.push('/(tabs)/projects')}>
              <Text style={[styles.seeAllText, { color: BrandColors.metarduOrange }]}>
                See all
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {recentProjects.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="folder-open-outline" size={32} color={colors.fgSubtle} />
            <Text style={[styles.emptyTitle, { color: colors.fg }]}>
              No projects yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.fgMuted }]}>
              Start your first survey from the quick actions above.
            </Text>
          </View>
        ) : (
          <View style={{ gap: Spacing[2] }}>
            {recentProjects.map((project) => {
              const config = SurveyTypeConfig[project.surveyType];
              return (
                <TouchableOpacity
                  key={project.id}
                  onPress={() => {
                    haptics.tap();
                    router.push(`/projects/${project.id}`);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.projectCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <View style={[styles.projectIcon, { backgroundColor: `${config.color}15` }]}>
                      <MaterialCommunityIcons name={config.icon as any} size={20} color={config.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.projectName, { color: colors.fg }]} numberOfLines={1}>
                        {project.name}
                      </Text>
                      <Text style={[styles.projectMeta, { color: colors.fgMuted }]}>
                        {project.county ?? '—'} · {new Date(project.updatedAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={[
                      styles.syncDot,
                      { backgroundColor: project.syncStatus === 'synced' ? SemanticColors.success : SemanticColors.warning },
                    ]} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================================
// Sub-components
// ============================================================================
function StatCard({
  label,
  value,
  icon,
  color,
  colors,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
  colors: typeof LightColors;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: `${color}15` }]}>
        <MaterialCommunityIcons name={icon as any} size={14} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.fg }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.fgMuted }]}>{label}</Text>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  color,
  colors,
  onPress,
}: {
  icon: string;
  label: string;
  color: string;
  colors: typeof LightColors;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      activeOpacity={0.7}
      style={[styles.quickAction, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: `${color}15` }]}>
        <MaterialCommunityIcons name={icon as any} size={22} color={color} />
      </View>
      <Text style={[styles.quickActionLabel, { color: colors.fg }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function PeerRow({
  peer,
  colors,
}: {
  peer: PresenceEvent;
  colors: typeof LightColors;
}) {
  const status = peer.status;
  const config = PresenceStatusConfig[status] ?? PresenceStatusConfig.offline;
  return (
    <View style={styles.peerRow}>
      <View style={styles.peerAvatar}>
        <Text style={styles.peerInitial}>
          {peer.surveyorName.charAt(0).toUpperCase()}
        </Text>
        <View style={[styles.peerStatusDot, { backgroundColor: config.dotColor, borderColor: colors.bgCard }]} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.peerName, { color: colors.fg }]} numberOfLines={1}>
          {peer.surveyorName}
        </Text>
        {peer.projectId && (
          <Text style={[styles.peerProject, { color: colors.fgMuted }]} numberOfLines={1}>
            Working on a project
          </Text>
        )}
      </View>
      <Text style={[styles.peerStatus, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing[5],
  },
  overline: {
    fontFamily: Typography.fontFamily.sansMedium,
    fontSize: Typography.fontSize['2xs'],
    letterSpacing: Typography.letterSpacing.widest,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: Spacing[1],
  },
  displayName: {
    fontFamily: Typography.fontFamily.heading,
    fontSize: Typography.fontSize['2xl'],
    fontWeight: '600',
    letterSpacing: Typography.letterSpacing.tight,
  },
  statusBar: {
    flexDirection: 'row',
    gap: Spacing[2],
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[1],
    paddingHorizontal: Spacing[2],
    paddingVertical: Spacing[1.5],
    borderRadius: Radius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontFamily: Typography.fontFamily.sansMedium,
    fontSize: Typography.fontSize.xs,
    fontWeight: '500',
  },
  iskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingVertical: Spacing[2],
    paddingHorizontal: Spacing[3],
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing[5],
  },
  iskNumber: {
    flex: 1,
    fontFamily: Typography.fontFamily.mono,
    fontSize: Typography.fontSize.sm,
    fontWeight: '500',
  },
  iskStatus: {
    fontFamily: Typography.fontFamily.sansMedium,
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing[3],
    marginBottom: Spacing[6],
  },
  statCard: {
    flex: 1,
    borderRadius: Radius.lg,
    padding: Spacing[3],
    borderWidth: 1,
    gap: Spacing[1],
  },
  statIcon: {
    width: 24,
    height: 24,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[1],
  },
  statValue: {
    fontFamily: Typography.fontFamily.heading,
    fontSize: Typography.fontSize['2xl'],
    fontWeight: '600',
    letterSpacing: Typography.letterSpacing.tight,
  },
  statLabel: {
    fontFamily: Typography.fontFamily.sans,
    fontSize: Typography.fontSize.xs,
  },
  sectionOverline: {
    fontFamily: Typography.fontFamily.sansMedium,
    fontSize: Typography.fontSize['2xs'],
    letterSpacing: Typography.letterSpacing.widest,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: Spacing[3],
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing[3],
    marginTop: Spacing[2],
  },
  seeAllText: {
    fontFamily: Typography.fontFamily.sansMedium,
    fontSize: Typography.fontSize.xs,
    fontWeight: '500',
  },
  quickActionGrid: {
    flexDirection: 'row',
    gap: Spacing[3],
    marginBottom: Spacing[6],
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing[2],
    paddingVertical: Spacing[4],
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontFamily: Typography.fontFamily.sansMedium,
    fontSize: Typography.fontSize.xs,
    fontWeight: '500',
  },
  presenceCard: {
    borderRadius: Radius.lg,
    padding: Spacing[2],
    borderWidth: 1,
    marginBottom: Spacing[6],
    gap: Spacing[1],
  },
  peerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingVertical: Spacing[2],
    paddingHorizontal: Spacing[2],
  },
  peerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BrandColors.metarduNavy,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  peerInitial: {
    fontFamily: Typography.fontFamily.heading,
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    color: BrandColors.metarduWhite,
  },
  peerStatusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  peerName: {
    fontFamily: Typography.fontFamily.sansMedium,
    fontSize: Typography.fontSize.sm,
    fontWeight: '500',
  },
  peerProject: {
    fontFamily: Typography.fontFamily.sans,
    fontSize: Typography.fontSize.xs,
    marginTop: 1,
  },
  peerStatus: {
    fontFamily: Typography.fontFamily.sansMedium,
    fontSize: Typography.fontSize['2xs'],
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: Typography.letterSpacing.wider,
  },
  morePeers: {
    fontFamily: Typography.fontFamily.sans,
    fontSize: Typography.fontSize.xs,
    textAlign: 'center',
    paddingVertical: Spacing[2],
  },
  emptyCard: {
    alignItems: 'center',
    padding: Spacing[8],
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing[2],
  },
  emptyTitle: {
    fontFamily: Typography.fontFamily.heading,
    fontSize: Typography.fontSize.base,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontFamily: Typography.fontFamily.sans,
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
  },
  projectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    padding: Spacing[3],
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  projectIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectName: {
    fontFamily: Typography.fontFamily.sansMedium,
    fontSize: Typography.fontSize.sm,
    fontWeight: '500',
  },
  projectMeta: {
    fontFamily: Typography.fontFamily.sans,
    fontSize: Typography.fontSize.xs,
    marginTop: 2,
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
