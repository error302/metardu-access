/**
 * Map tab — shows project points on an offline-capable map.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Circle } from 'react-native-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Colors } from '@/theme';
import { EmptyState } from '@/components/EmptyState';
import { useProjectStore } from '@/stores/projectStore';
import { getPoints } from '@/lib/db/queries';
import { utmToWgs84 } from '@engine/transforms';
import type { SurveyPoint } from '@/types';

// Default center: Nairobi, Kenya
const NAIROBI = { latitude: -1.2864, longitude: 36.8172 };

export default function MapScreen() {
  const { t } = useTranslation();
  const projects = useProjectStore((s) => s.projects);
  const selected = useProjectStore((s) => s.selectedProject);
  const load = useProjectStore((s) => s.load);
  const [points, setPoints] = useState<SurveyPoint[]>([]);
  const [mapPoints, setMapPoints] = useState<{ lat: number; lng: number; point: SurveyPoint }[]>([]);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const project = selected ?? projects[0];
    if (!project) return;
    getPoints(project.id).then(async (pts) => {
      setPoints(pts);
      // Convert UTM (Arc 1960 / 37S) back to WGS84 for the map
      const converted = pts.map((p) => {
        const ll = utmToWgs84(p.easting, p.northing, 37, true);
        return { lat: ll.lat, lng: ll.lng, point: p };
      });
      setMapPoints(converted);
    });
  }, [selected, projects]);

  const project = selected ?? projects[0];

  if (!project) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.metarduCream }} edges={['top']}>
        <EmptyState
          icon="map-outline"
          title="No projects"
          subtitle="Create a project to see points on the map."
        />
      </SafeAreaView>
    );
  }

  if (mapPoints.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.metarduCream }} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('nav.map')}</Text>
          <Text style={styles.subtitle}>{project.name}</Text>
        </View>
        <EmptyState
          icon="map-marker-off"
          title="No points yet"
          subtitle="Capture GPS points or import them to see them on the map."
        />
      </SafeAreaView>
    );
  }

  // Center map on first point or Nairobi
  const first = mapPoints[0];
  const region = {
    latitude: first.lat,
    longitude: first.lng,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.metarduCream }} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('nav.map')}</Text>
          <Text style={styles.subtitle}>{project.name} · {mapPoints.length} points</Text>
        </View>
      </View>
      <MapView
        style={{ flex: 1 }}
        initialRegion={region}
        showsUserLocation
        showsCompass
        showsScale
        mapType="hybrid"
      >
        {mapPoints.map((mp, i) => (
          <Marker
            key={`${mp.point.pointNumber}-${i}`}
            coordinate={{ latitude: mp.lat, longitude: mp.lng }}
            title={mp.point.pointNumber}
            description={mp.point.description ?? mp.point.code ?? ''}
          >
            <View style={styles.markerPin}>
              <MaterialCommunityIcons name="map-marker" size={28} color={Colors.metarduOrange} />
            </View>
          </Marker>
        ))}
      </MapView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.metarduNavy,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.gray500,
    marginTop: 2,
  },
  markerPin: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
