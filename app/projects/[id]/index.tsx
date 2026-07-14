/**
 * Project Detail screen — tabs for overview, points, observations, workflow.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Colors, SurveyTypeConfig } from '@/theme';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { SurveyTypeBadge } from '@/components/SurveyTypeBadge';
import { SyncStatusBadge } from '@/components/SyncStatusBadge';
import { useProjectStore } from '@/stores/projectStore';
import { getProject, getPoints, deleteProject } from '@/lib/db/queries';
import { getDatabase } from '@/lib/db/schema';
import type { Project, SurveyPoint } from '@/types';

type Tab = 'overview' | 'points' | 'workflow';

export default function ProjectDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const refresh = useProjectStore((s) => s.refresh);

  const [project, setProject] = useState<Project | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [points, setPoints] = useState<SurveyPoint[]>([]);
  const [obsCount, setObsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    if (!id) return;
    setLoading(true);
    const p = await getProject(id);
    setProject(p);
    if (p) {
      const [pts, db] = await Promise.all([
        getPoints(p.id),
        getDatabase(),
      ]);
      setPoints(pts);
      const obsRow = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM observations WHERE project_id = ?',
        [p.id]
      );
      setObsCount(obsRow?.count ?? 0);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, [id]);

  const handleDelete = () => {
    Alert.alert(
      'Delete project',
      'This permanently deletes the project and all its data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteProject(id);
            await refresh();
            router.replace('/(tabs)/projects');
          },
        },
      ]
    );
  };

  if (!project) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.metarduCream }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: Colors.gray500 }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.metarduCream }} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <TouchableOpacity onPress={() => router.back()}>
              <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.metarduNavy} />
            </TouchableOpacity>
            <Text style={styles.title} numberOfLines={1}>{project.name}</Text>
          </View>
          <View style={styles.metaRow}>
            <SurveyTypeBadge type={project.surveyType} size="sm" />
            <SyncStatusBadge status={project.syncStatus} size="sm" />
          </View>
        </View>
      </View>

      <View style={styles.tabsRow}>
        {([
          { id: 'overview', label: 'Overview' },
          { id: 'points', label: `Points (${points.length})` },
          { id: 'workflow', label: 'Workflow' },
        ] as { id: Tab; label: string }[]).map((tb) => (
          <TouchableOpacity
            key={tb.id}
            onPress={() => setTab(tb.id)}
            style={[styles.tab, tab === tb.id && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === tb.id && styles.tabTextActive]}>
              {tb.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadAll} />}
      >
        {tab === 'overview' && <OverviewTab project={project} points={points} obsCount={obsCount} />}
        {tab === 'points' && <PointsTab points={points} />}
        {tab === 'workflow' && <WorkflowTab project={project} />}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push(`/fieldbook/observation?projectId=${project.id}`)}
      >
        <MaterialCommunityIcons name="plus" size={28} color={Colors.metarduWhite} />
      </TouchableOpacity>

      <View style={styles.bottomBar}>
        <Button
          title="Sync Queue"
          variant="outline"
          size="sm"
          onPress={() => router.push(`/sync/queue?projectId=${project.id}`)}
          style={{ flex: 1 }}
        />
        <Button
          title="Delete"
          variant="danger"
          size="sm"
          onPress={handleDelete}
          style={{ flex: 1 }}
        />
      </View>
    </SafeAreaView>
  );
}

function OverviewTab({
  project,
  points,
  obsCount,
}: {
  project: Project;
  points: SurveyPoint[];
  obsCount: number;
}) {
  return (
    <View style={{ gap: 12 }}>
      <Card>
        <Text style={styles.cardTitle}>Project Details</Text>
        <DetailRow label="Survey Type" value={SurveyTypeConfig[project.surveyType].label} />
        <DetailRow label="County" value={`${project.county ?? '—'}, ${project.country}`} />
        {project.lrNumber && <DetailRow label="LR Number" value={project.lrNumber} />}
        <DetailRow label="Datum" value={project.datum} />
        <DetailRow label="Projection" value={`${project.projection} (EPSG:${project.crsEpsg})`} />
        <DetailRow label="Surveyor" value={`${project.surveyorName} (${project.surveyorLicense})`} />
        {project.clientName && <DetailRow label="Client" value={project.clientName} />}
      </Card>

      <View style={styles.statsRow}>
        <MiniStat icon="map-marker" label="Points" value={points.length} color={Colors.metarduOrange} />
        <MiniStat icon="angle-acute" label="Observations" value={obsCount} color={Colors.info} />
        <MiniStat icon="clock-outline" label="Created" value={new Date(project.createdAt).toLocaleDateString()} color={Colors.success} />
      </View>
    </View>
  );
}

function PointsTab({ points }: { points: SurveyPoint[] }) {
  if (points.length === 0) {
    return (
      <EmptyState
        icon="map-marker-off"
        title="No points yet"
        subtitle="Capture GPS points or import from total station."
      />
    );
  }
  return (
    <View style={{ gap: 8 }}>
      {points.map((p, i) => (
        <Card key={`${p.pointNumber}-${i}`} style={{ padding: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={styles.pointIcon}>
              <MaterialCommunityIcons name="map-marker" size={18} color={Colors.metarduOrange} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pointNumber}>{p.pointNumber}</Text>
              <Text style={styles.pointCoords}>
                E: {p.easting.toFixed(3)}  N: {p.northing.toFixed(3)}  Elev: {p.elevation.toFixed(2)}
              </Text>
              {p.code && <Text style={styles.pointCode}>Code: {p.code}</Text>}
            </View>
          </View>
        </Card>
      ))}
    </View>
  );
}

function WorkflowTab({ project }: { project: Project }) {
  const router = useRouter();
  const workflows: Record<string, { label: string; icon: string; route: string }[]> = {
    cadastral: [
      { label: 'Traverse Entry', icon: 'shape-polygon-plus', route: `/cadastral/traverse?projectId=${project.id}` },
      { label: 'Bowditch Adjustment', icon: 'chart-line', route: `/cadastral/adjustment?projectId=${project.id}` },
      { label: 'Parcel Definition', icon: 'vector-square', route: `/cadastral/parcels?projectId=${project.id}` },
      { label: 'Beacon Library', icon: 'map-marker-multiple', route: `/cadastral/beacons?projectId=${project.id}` },
      { label: 'Seal & Submit', icon: 'lock-check', route: `/cadastral/seal?projectId=${project.id}` },
    ],
    engineering: [
      { label: 'Leveling', icon: 'arrow-up-down', route: `/engineering/leveling?projectId=${project.id}` },
      { label: 'Road Design', icon: 'road-variant', route: `/engineering/road?projectId=${project.id}` },
      { label: 'Setting Out', icon: 'target', route: `/engineering/setting-out?projectId=${project.id}` },
      { label: 'As-Built', icon: 'clipboard-check', route: `/engineering/as-built?projectId=${project.id}` },
      { label: 'Earthworks', icon: 'excavator', route: `/engineering/earthworks?projectId=${project.id}` },
    ],
    topographic: [
      { label: 'Feature Codes', icon: 'tag-multiple', route: `/topo/features?projectId=${project.id}` },
      { label: 'Breaklines', icon: 'wave', route: `/topo/breaklines?projectId=${project.id}` },
      { label: 'Coverage Map', icon: 'map-search', route: `/topo/coverage?projectId=${project.id}` },
      { label: 'Drone / GCPs', icon: 'quadcopter', route: `/topo/drone?projectId=${project.id}` },
    ],
    sectional: [
      { label: 'Development Info', icon: 'home-city', route: `/sectional/development?projectId=${project.id}` },
      { label: 'Units Registry', icon: 'floor-plan', route: `/sectional/units?projectId=${project.id}` },
      { label: 'Floor Plans', icon: 'drawing', route: `/sectional/floorplans?projectId=${project.id}` },
      { label: 'Exclusive Use Areas', icon: 'crop', route: `/sectional/euas?projectId=${project.id}` },
    ],
  };
  const items = workflows[project.surveyType] ?? [];

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.cardTitle}>
        {SurveyTypeConfig[project.surveyType].label} Workflow
      </Text>
      {items.map((item) => (
        <TouchableOpacity key={item.route} onPress={() => router.push(item.route as any)}>
          <Card style={{ padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={styles.workflowIcon}>
                <MaterialCommunityIcons name={item.icon as any} size={22} color={Colors.metarduOrange} />
              </View>
              <Text style={styles.workflowLabel}>{item.label}</Text>
              <MaterialCommunityIcons name="chevron-right" size={22} color={Colors.gray400} style={{ marginLeft: 'auto' }} />
            </View>
          </Card>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function MiniStat({ icon, label, value, color }: { icon: string; label: string; value: any; color: string }) {
  return (
    <View style={[styles.miniStat, { borderTopColor: color }]}>
      <MaterialCommunityIcons name={icon as any} size={18} color={color} />
      <Text style={styles.miniStatValue}>{String(value)}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
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
    color: Colors.metarduNavy,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 4,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: Colors.metarduNavy,
  },
  tabText: {
    fontSize: 12,
    color: Colors.gray500,
    fontWeight: '500',
  },
  tabTextActive: {
    color: Colors.metarduWhite,
    fontWeight: '600',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.metarduNavy,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.gray200,
  },
  detailLabel: {
    fontSize: 13,
    color: Colors.gray500,
  },
  detailValue: {
    fontSize: 13,
    color: Colors.metarduNavy,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  miniStat: {
    flex: 1,
    backgroundColor: Colors.metarduWhite,
    borderRadius: 10,
    padding: 10,
    borderTopWidth: 2,
    alignItems: 'center',
    gap: 2,
  },
  miniStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.metarduNavy,
  },
  miniStatLabel: {
    fontSize: 10,
    color: Colors.gray500,
  },
  pointIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${Colors.metarduOrange}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.metarduNavy,
  },
  pointCoords: {
    fontSize: 12,
    color: Colors.gray500,
    fontFamily: 'JetBrainsMono',
    marginTop: 2,
  },
  pointCode: {
    fontSize: 11,
    color: Colors.metarduOrange,
    marginTop: 2,
    fontWeight: '500',
  },
  workflowIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: `${Colors.metarduOrange}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workflowLabel: {
    fontSize: 15,
    color: Colors.metarduNavy,
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.metarduOrange,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.metarduOrange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  bottomBar: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: Colors.metarduWhite,
    borderTopWidth: 1,
    borderTopColor: Colors.gray200,
  },
});
