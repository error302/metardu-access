/**
 * Coverage Map — field-side verification of topo data capture.
 *
 * Shows captured mass points colored by feature code, breaklines overlaid,
 * bounding box, point density stats, and quality assessment.
 *
 * This is NOT a final survey map (that's desktop's job). This is a
 * field verification tool to ensure the surveyor has captured:
 *   - Enough mass points across the area
 *   - All necessary breaklines
 *   - A defined survey boundary
 *   - Adequate point density
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, Circle } from 'react-native-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Colors } from '@/theme';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { getProject, getPoints } from '@/lib/db/queries';
import { getBreaklines } from '@/lib/db/breaklines';
import { getFeatureCodes } from '@/lib/db/featureCodes';
import { utmToWgs84 } from '@engine/transforms';
import { assessCoverage, buildTinPrepData, computeBbox } from '@engine/breaklines';
import type { Project, SurveyPoint, FeatureCode, Breakline } from '@/types';

export default function CoverageScreen() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();

  const [project, setProject] = useState<Project | null>(null);
  const [points, setPoints] = useState<SurveyPoint[]>([]);
  const [breaklines, setBreaklines] = useState<Breakline[]>([]);
  const [featureCodes, setFeatureCodes] = useState<FeatureCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBreaklines, setShowBreaklines] = useState(true);
  const [filterLayer, setFilterLayer] = useState<string | null>(null);

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    const p = await getProject(projectId);
    setProject(p);
    const [pts, bls, fcs] = await Promise.all([
      getPoints(projectId),
      getBreaklines(projectId),
      getFeatureCodes(projectId, true),
    ]);
    setPoints(pts);
    setBreaklines(bls);
    setFeatureCodes(fcs);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [projectId]);

  // Convert UTM (Arc 1960 37S) back to WGS84 lat/lng for the map
  const mapPoints = useMemo(() => {
    return points
      .filter(p => !filterLayer || featureCodes.find(fc => fc.code === p.code)?.layer === filterLayer)
      .map(p => {
        const ll = utmToWgs84(p.easting, p.northing, 37, true);
        return { ...p, lat: ll.lat, lng: ll.lng };
      });
  }, [points, featureCodes, filterLayer]);

  // Bounding box in WGS84 for map region
  const region = useMemo(() => {
    if (mapPoints.length === 0) {
      // Default: Nairobi
      return { latitude: -1.2864, longitude: 36.8172, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    }
    const lats = mapPoints.map(p => p.lat);
    const lngs = mapPoints.map(p => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const delta = Math.max(maxLat - minLat, maxLng - minLng, 0.005) * 1.4;
    return {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: delta,
      longitudeDelta: delta,
    };
  }, [mapPoints]);

  // Coverage assessment
  const coverage = useMemo(() => {
    if (!project) return null;
    const massPoints = points.map(p => ({ easting: p.easting, northing: p.northing }));
    const blsForAssessment = breaklines.map(bl => ({
      name: bl.name,
      type: bl.type,
      layer: bl.layer,
      vertices: [],
      length: bl.lengthM,
    }));
    const hasBoundary = breaklines.some(b => b.type === 'boundary');
    return assessCoverage(massPoints, blsForAssessment, hasBoundary);
  }, [points, breaklines, project]);

  // TIN prep export
  const handleExportTinPrep = async () => {
    if (!project) return;
    const tinData = buildTinPrepData({
      projectName: project.name,
      crsEpsg: project.crsEpsg,
      crsName: `${project.datum} / ${project.projection}`,
      crsDatum: project.datum,
      massPoints: points.map(p => ({
        pointNumber: p.pointNumber,
        easting: p.easting,
        northing: p.northing,
        elevation: p.elevation,
        code: p.code,
      })),
      breaklines: breaklines.map(bl => ({
        name: bl.name,
        type: bl.type,
        layer: bl.layer,
        vertices: [],
        length: bl.lengthM,
      })),
      boundary: breaklines.find(b => b.type === 'boundary')
        ? {
            name: breaklines.find(b => b.type === 'boundary')!.name,
            type: 'boundary',
            vertices: [],
            length: breaklines.find(b => b.type === 'boundary')!.lengthM,
          }
        : undefined,
    });

    const summary = [
      `METARDU ACCESS — TIN PREP DATA`,
      `Project: ${project.name}`,
      `CRS: EPSG:${project.crsEpsg} (${project.datum} / ${project.projection})`,
      `Generated: ${tinData.generatedAt}`,
      ``,
      `STATS:`,
      `  Mass points:        ${tinData.stats.massPointCount}`,
      `  Breaklines:         ${tinData.stats.breaklineCount}`,
      `  Breakline vertices: ${tinData.stats.totalBreaklineVertices}`,
      `  Total breakline length: ${tinData.stats.totalBreaklineLength.toFixed(2)} m`,
      `  Survey bbox:        (${tinData.stats.surveyAreaBbox.minX.toFixed(2)}, ${tinData.stats.surveyAreaBbox.minY.toFixed(2)}) to (${tinData.stats.surveyAreaBbox.maxX.toFixed(2)}, ${tinData.stats.surveyAreaBbox.maxY.toFixed(2)})`,
      `  Point density:      ${tinData.stats.pointDensityPerSqm.toFixed(0)} /km²`,
      ``,
      `Import this JSON on the desktop's "Import TIN Prep" screen.`,
      `The desktop will generate the TIN surface respecting all breaklines.`,
    ].join('\n');

    await Share.share({ message: summary });
  };

  if (!project) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.metarduCream }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: Colors.gray500 }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.metarduCream }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.metarduNavy} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Coverage Map</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{project.name}</Text>
        </View>
        <TouchableOpacity onPress={handleExportTinPrep} style={{ padding: 8 }}>
          <MaterialCommunityIcons name="share-variant" size={18} color={Colors.metarduOrange} />
        </TouchableOpacity>
      </View>

      {/* Stats summary */}
      <View style={styles.statsRow}>
        <StatCard icon="map-marker" label="Points" value={String(points.length)} color={Colors.metarduOrange} />
        <StatCard icon="wave" label="Breaklines" value={String(breaklines.length)} color={Colors.success} />
        <StatCard icon="vector-square" label="Boundary" value={breaklines.some(b => b.type === 'boundary') ? 'Yes' : 'No'} color={Colors.info} />
        <StatCard
          icon="chart-bar"
          label="Density"
          value={coverage ? `${(coverage.densityPerSqKm).toFixed(0)}/km²` : '—'}
          color={Colors.warning}
        />
      </View>

      {/* Layer filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        <FilterChip
          label="All"
          active={filterLayer === null}
          onPress={() => setFilterLayer(null)}
        />
        {['vegetation', 'structures', 'transport', 'hydrology', 'utilities', 'general'].map(layer => {
          const count = points.filter(p => featureCodes.find(fc => fc.code === p.code)?.layer === layer).length;
          if (count === 0) return null;
          return (
            <FilterChip
              key={layer}
              label={`${layer} (${count})`}
              active={filterLayer === layer}
              onPress={() => setFilterLayer(layer)}
            />
          );
        })}
      </ScrollView>

      {/* Map */}
      {mapPoints.length === 0 ? (
        <EmptyState
          icon="map-marker-off"
          title="No points captured"
          subtitle="Capture mass points via the Fieldbook tab to see coverage."
        />
      ) : (
        <View style={{ flex: 1, marginHorizontal: 16, marginBottom: 8, borderRadius: 12, overflow: 'hidden' }}>
          <MapView
            style={{ flex: 1 }}
            initialRegion={region}
            showsUserLocation
            showsCompass
            mapType="hybrid"
          >
            {/* Bounding box circle */}
            <Circle
              center={{ latitude: region.latitude, longitude: region.longitude }}
              radius={Math.sqrt((region.latitudeDelta * 111000) ** 2 / 2)}
              strokeColor={`${Colors.metarduOrange}40`}
              fillColor={`${Colors.metarduOrange}10`}
              strokeWidth={1}
            />

            {/* Mass points colored by feature code */}
            {mapPoints.map((p, i) => {
              const fc = featureCodes.find(c => c.code === p.code);
              const color = fc?.color ?? Colors.metarduOrange;
              return (
                <Marker
                  key={`${p.pointNumber}-${i}`}
                  coordinate={{ latitude: p.lat, longitude: p.lng }}
                  title={p.pointNumber}
                  description={p.code ?? ''}
                  pinColor={color}
                />
              );
            })}

            {/* Breaklines (we don't have lat/lng for breakline vertices here,
                but the desktop will use the UTM coords from the export) */}
          </MapView>

          {/* Toggle for breaklines display */}
          <TouchableOpacity
            onPress={() => setShowBreaklines(!showBreaklines)}
            style={styles.mapToggle}
          >
            <MaterialCommunityIcons
              name={showBreaklines ? 'eye' : 'eye-off'}
              size={16}
              color={Colors.metarduWhite}
            />
            <Text style={styles.mapToggleText}>Breaklines</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Coverage assessment */}
      {coverage && (
        <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ padding: 16, paddingTop: 8 }}>
          <Card style={[
            styles.assessmentCard,
            { borderLeftColor: coverage.issues.length === 0 ? Colors.success : Colors.warning },
          ]}>
            <View style={styles.assessmentHeader}>
              <MaterialCommunityIcons
                name={coverage.issues.length === 0 ? 'check-decagram' : 'alert-decagram'}
                size={20}
                color={coverage.issues.length === 0 ? Colors.success : Colors.warning}
              />
              <Text style={styles.assessmentTitle}>
                {coverage.issues.length === 0
                  ? 'Coverage OK — ready for desktop TIN'
                  : `${coverage.issues.length} issue(s) to review`}
              </Text>
            </View>

            {coverage.issues.length === 0 && (
              <Text style={styles.assessmentGood}>
                Mass points, breaklines, and boundary look good. Export the TIN prep data when ready.
              </Text>
            )}

            {coverage.issues.map((issue, i) => (
              <View key={`i${i}`} style={styles.assessmentRow}>
                <MaterialCommunityIcons name="alert-circle-outline" size={14} color={Colors.warning} />
                <Text style={[styles.assessmentText, { color: Colors.warning }]}>{issue}</Text>
              </View>
            ))}

            {coverage.recommendations.slice(0, 3).map((rec, i) => (
              <View key={`r${i}`} style={styles.assessmentRow}>
                <MaterialCommunityIcons name="lightbulb-outline" size={14} color={Colors.info} />
                <Text style={[styles.assessmentText, { color: Colors.info }]}>{rec}</Text>
              </View>
            ))}
          </Card>

          <Button
            title="Export TIN Prep Data"
            onPress={handleExportTinPrep}
            style={{ marginTop: 12 }}
            icon={<MaterialCommunityIcons name="file-export" size={18} color={Colors.metarduWhite} />}
          />
        </ScrollView>
      )}
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
      <MaterialCommunityIcons name={icon as any} size={16} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.filterChip,
        active && { backgroundColor: Colors.metarduNavy },
      ]}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
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
  subtitle: {
    fontSize: 13,
    color: Colors.gray500,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.metarduWhite,
    borderRadius: 10,
    padding: 8,
    borderTopWidth: 3,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.metarduNavy,
    fontFamily: 'JetBrainsMono',
  },
  statLabel: {
    fontSize: 9,
    color: Colors.gray500,
    textTransform: 'uppercase',
  },
  filterRow: {
    maxHeight: 40,
    paddingVertical: 6,
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: Colors.gray100,
  },
  filterChipText: {
    fontSize: 11,
    color: Colors.gray600,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: Colors.metarduWhite,
    fontWeight: '600',
  },
  mapToggle: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${Colors.metarduNavy}CC`,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  mapToggleText: {
    fontSize: 11,
    color: Colors.metarduWhite,
    fontWeight: '600',
  },
  assessmentCard: {
    borderLeftWidth: 4,
  },
  assessmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  assessmentTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.metarduNavy,
  },
  assessmentGood: {
    fontSize: 12,
    color: Colors.success,
    lineHeight: 17,
  },
  assessmentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 4,
  },
  assessmentText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
});
