/**
 * Fieldbook tab — list of field sessions + quick capture actions.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { CameraCapture, type CapturedPhoto } from '@/components/CameraCapture';
import { field as haptics } from '@/lib/haptics';
import { EmptyState } from '@/components/EmptyState';
import { SurveyTypeBadge } from '@/components/SurveyTypeBadge';
import { SyncStatusBadge } from '@/components/SyncStatusBadge';
import { useProjectStore } from '@/stores/projectStore';
import { useAuthStore } from '@/stores/authStore';
import { getPoints, addPoint } from '@/lib/db/queries';
import type { SurveyPoint } from '@/types';
import { useThemeColors } from '@/hooks/useThemeColors';

interface RecentItem {
  type: 'point' | 'observation';
  id: string;
  label: string;
  meta: string;
  timestamp: string;
  surveyType?: any;
  syncStatus: any;
  projectId: string;
}

export default function FieldbookScreen() {
  const Colors = useThemeColors();
  const { t } = useTranslation();
  const router = useRouter();
  const projects = useProjectStore((s) => s.projects);
  const loadProjects = useProjectStore((s) => s.load);
  const selected = useProjectStore((s) => s.selectedProject);
  const profile = useAuthStore((s) => s.profile);
  const [items, setItems] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCamera, setShowCamera] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selected) {
      loadRecentItems(selected.id);
    } else if (projects.length > 0) {
      loadRecentItems(projects[0].id);
    } else {
      setLoading(false);
    }
  }, [selected, projects]);

  async function loadRecentItems(projectId: string) {
    setLoading(true);
    try {
      const points = await getPoints(projectId);
      const recent: RecentItem[] = points.slice(0, 50).map((p) => ({
        type: 'point' as const,
        id: `${p.pointNumber}-${p.timestamp}`,
        label: `Point ${p.pointNumber}`,
        meta: `${p.easting.toFixed(3)}, ${p.northing.toFixed(3)} | ${p.source}`,
        timestamp: p.timestamp,
        syncStatus: 'pending',
        projectId,
      }));
      setItems(recent);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }

  async function captureGpsPoint() {
    if (!selected && projects.length === 0) {
      Alert.alert('No project', 'Create a project first to capture points.');
      return;
    }
    const project = selected ?? projects[0];

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to capture GPS points.');
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Convert WGS84 to Arc 1960 / UTM 37S (Kenya default)
      const { wgs84ToArc1960Utm37S } = await import('@engine/transforms');
      const utm = wgs84ToArc1960Utm37S({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });

      const pointNumber = `GPS-${Date.now().toString().slice(-6)}`;
      const point = await addPoint({
        pointNumber,
        easting: utm.easting,
        northing: utm.northing,
        elevation: location.coords.altitude ?? 0,
        code: 'GPS',
        description: `Captured via GPS, accuracy ±${location.coords.accuracy?.toFixed(1) ?? '?'}m`,
        source: 'gnss',
        projectId: project.id,
        sessionId: undefined,
        raw: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
          capturedAt: new Date().toISOString(),
        },
      });

      Alert.alert(
        'Point captured',
        `${pointNumber}\nE: ${utm.easting.toFixed(3)}\nN: ${utm.northing.toFixed(3)}\nElev: ${(location.coords.altitude ?? 0).toFixed(2)}m`
      );
      await haptics.pointCaptured();
      loadRecentItems(project.id);
    } catch (err: any) {
      await haptics.syncFailed();
      Alert.alert('Capture failed', err.message ?? 'Unknown error');
    }
  }

  async function capturePhotoPoint(photo: CapturedPhoto) {
    if (!selected && projects.length === 0) {
      Alert.alert('No project', 'Create a project first to capture points.');
      return;
    }
    const project = selected ?? projects[0];

    try {
      const pointNumber = `PHOTO-${Date.now().toString().slice(-6)}`;
      const point = await addPoint({
        pointNumber,
        easting: photo.easting ?? 0,
        northing: photo.northing ?? 0,
        elevation: photo.elevation ?? 0,
        code: 'PHOTO',
        description: `Photo point${photo.accuracy ? ` (±${photo.accuracy.toFixed(1)}m)` : ''}`,
        source: 'gnss',
        projectId: project.id,
        sessionId: undefined,
        photoUri: photo.uri,
        raw: photo.lat ? {
          latitude: photo.lat,
          longitude: photo.lng,
          accuracy: photo.accuracy,
          capturedAt: photo.capturedAt,
        } : undefined,
      });
      await haptics.pointCaptured();
      Alert.alert(
        'Photo point captured',
        `${pointNumber}\n${photo.lat ? `Lat: ${photo.lat.toFixed(6)}\nLng: ${photo.lng!.toFixed(6)}\n` : ''}Photo attached.`
      );
      loadRecentItems(project.id);
    } catch (err: any) {
      await haptics.syncFailed();
      Alert.alert('Failed', err.message);
    }
  }

  const renderItem = ({ item }: { item: RecentItem }) => (
    <Card style={{ marginBottom: 8, padding: 12 }}>
      <TouchableOpacity
        onPress={() => router.push(`/projects/${item.projectId}`)}
        style={{ gap: 4 }}
      >
        <View style={styles.itemRow}>
          <View style={styles.itemIcon}>
            <MaterialCommunityIcons
              name={item.type === 'point' ? 'map-marker' : 'angle-acute'}
              size={18}
              color={'#F97316'}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemLabel}>{item.label}</Text>
            <Text style={styles.itemMeta}>{item.meta}</Text>
          </View>
          <SyncStatusBadge status={item.syncStatus} size="sm" />
        </View>
        <Text style={styles.itemTime}>
          {new Date(item.timestamp).toLocaleString()}
        </Text>
      </TouchableOpacity>
    </Card>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF7F2' }} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('fieldbook.title')}</Text>
          <Text style={styles.subtitle}>
            {selected ? selected.name : projects[0]?.name ?? 'No project selected'}
          </Text>
        </View>
        <Button
          title={t('fieldbook.newSession')}
          onPress={() => router.push('/projects/new')}
          size="sm"
        />
      </View>

      {/* Quick capture row */}
      <View style={styles.quickCaptureRow}>
        <QuickCaptureButton
          icon="crosshairs-gps"
          label={t('fieldbook.captureGps')}
          color={'#F97316'}
          onPress={captureGpsPoint}
        />
        <QuickCaptureButton
          icon="camera"
          label={t('fieldbook.capturePhoto')}
          color={'#3B82F6'}
          onPress={() => setShowCamera(true)}
        />
        <QuickCaptureButton
          icon="note-plus"
          label={t('fieldbook.addObservation')}
          color={'#10B981'}
          onPress={() => router.push('/fieldbook/observation')}
        />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ListEmptyComponent={
          <EmptyState
            icon="notebook-outline"
            title="No observations yet"
            subtitle="Capture a GPS point or use a total station to start your fieldbook."
          />
        }
        refreshing={loading}
        onRefresh={() => selected && loadRecentItems(selected.id)}
      />

      <CameraCapture
        visible={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={capturePhotoPoint}
        title="Capture Photo Point"
      />
    </SafeAreaView>
  );
}

function QuickCaptureButton({
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
    <TouchableOpacity onPress={onPress} style={styles.quickCaptureBtn}>
      <View style={[styles.quickCaptureIcon, { backgroundColor: `${color}20` }]}>
        <MaterialCommunityIcons name={icon as any} size={22} color={color} />
      </View>
      <Text style={styles.quickCaptureLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0B1F3A',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  quickCaptureRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  quickCaptureBtn: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  quickCaptureIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickCaptureLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#0B1F3A',
    textAlign: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: #F9731615,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0B1F3A',
  },
  itemMeta: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'JetBrainsMono',
  },
  itemTime: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
    marginLeft: 46,
  },
});
