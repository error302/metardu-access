/**
 * Home tab — overview dashboard.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Colors } from '@/theme';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { LogoMark } from '@/components/LogoMark';
import { SurveyTypeBadge } from '@/components/SurveyTypeBadge';
import { SyncStatusBadge } from '@/components/SyncStatusBadge';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const projects = useProjectStore((s) => s.projects);
  const loadProjects = useProjectStore((s) => s.load);

  useEffect(() => {
    loadProjects();
  }, []);

  const recentProjects = projects.slice(0, 3);
  const activeCount = projects.filter((p) => p.status === 'active' || p.status === 'draft').length;
  const syncedCount = projects.filter((p) => p.syncStatus === 'synced').length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.metarduCream }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {profile?.fullName?.split(' ')[0] ?? 'Surveyor'}</Text>
            <Text style={styles.subGreeting}>{profile?.iskNumber}</Text>
          </View>
          <LogoMark size={44} />
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard
            icon="folder-multiple"
            label="Projects"
            value={String(projects.length)}
            color={Colors.metarduOrange}
          />
          <StatCard
            icon="clipboard-check"
            label="Active"
            value={String(activeCount)}
            color={Colors.info}
          />
          <StatCard
            icon="cloud-check"
            label="Synced"
            value={String(syncedCount)}
            color={Colors.success}
          />
        </View>

        {/* Quick actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          <QuickAction
            icon="map-marker-plus"
            label="New Cadastral"
            color={Colors.metarduOrange}
            onPress={() => router.push('/projects/new?type=cadastral')}
          />
          <QuickAction
            icon="road-variant"
            label="Engineering"
            color={Colors.info}
            onPress={() => router.push('/projects/new?type=engineering')}
          />
          <QuickAction
            icon="terrain"
            label="Topographic"
            color={Colors.success}
            onPress={() => router.push('/projects/new?type=topographic')}
          />
          <QuickAction
            icon="home-city"
            label="Sectional"
            color={Colors.warning}
            onPress={() => router.push('/projects/new?type=sectional')}
          />
        </View>

        {/* Recent projects */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Projects</Text>
          {projects.length > 3 && (
            <TouchableOpacity onPress={() => router.push('/(tabs)/projects')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          )}
        </View>

        {recentProjects.length === 0 ? (
          <Card variant="outline" padding={24}>
            <Text style={styles.emptyTitle}>No projects yet</Text>
            <Text style={styles.emptySubtitle}>
              Start your first survey by tapping a quick action above.
            </Text>
            <Button
              title="Create Project"
              onPress={() => router.push('/projects/new')}
              size="sm"
              style={{ marginTop: 12 }}
            />
          </Card>
        ) : (
          recentProjects.map((project) => (
            <Card key={project.id} style={{ marginBottom: 12 }}>
              <TouchableOpacity
                onPress={() => router.push(`/projects/${project.id}`)}
                style={{ gap: 8 }}
              >
                <View style={styles.projectRow}>
                  <Text style={styles.projectName} numberOfLines={1}>
                    {project.name}
                  </Text>
                  <SurveyTypeBadge type={project.surveyType} size="sm" />
                </View>
                <View style={styles.projectMeta}>
                  <Text style={styles.projectMetaText}>{project.county ?? '—'}</Text>
                  <Text style={styles.projectMetaDot}>·</Text>
                  <Text style={styles.projectMetaText}>
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </Text>
                </View>
                <SyncStatusBadge status={project.syncStatus} />
              </TouchableOpacity>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <MaterialCommunityIcons name={icon as any} size={20} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  color,
  onPress,
}: {
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.quickAction}>
      <View style={[styles.quickActionIcon, { backgroundColor: `${color}20` }]}>
        <MaterialCommunityIcons name={icon as any} size={26} color={color} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.metarduNavy,
  },
  subGreeting: {
    fontSize: 13,
    color: Colors.gray500,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.metarduWhite,
    borderRadius: 12,
    padding: 12,
    borderTopWidth: 3,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.metarduNavy,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.gray500,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.metarduNavy,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  seeAll: {
    color: Colors.metarduOrange,
    fontSize: 13,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 8,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.metarduNavy,
    textAlign: 'center',
  },
  projectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  projectName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.metarduNavy,
  },
  projectMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  projectMetaText: {
    fontSize: 12,
    color: Colors.gray500,
  },
  projectMetaDot: {
    color: Colors.gray400,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.metarduNavy,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.gray500,
  },
});
