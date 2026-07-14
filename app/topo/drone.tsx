/**
 * Drone / GCP Capture — Ground Control Points for drone photogrammetry.
 *
 * Surveyors capture GCPs with cm-level GNSS RTK accuracy. Each GCP has:
 *   - A target on the ground (checkerboard, cross, or natural feature)
 *   - High-accuracy WGS84 + local grid coordinates
 *   - A photo of the target for desktop verification
 *   - Solution type (fixed/float/dgps/single) for quality tracking
 *
 * The desktop's WebODM / Pix4D pipeline consumes these GCPs to georeference
 * drone imagery with cm-level accuracy.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  FlatList,
  Image,
  Share,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

import { Colors } from '@/theme';
import { Card } from '@/components/Card';
import { TextInput } from '@/components/TextInput';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { getProject } from '@/lib/db/queries';
import {
  createGCP,
  getGCPs,
  deleteGCP,
  TARGET_TYPES,
  SOLUTION_TYPES,
} from '@/lib/db/gcps';
import {
  wgs84ToArc1960Utm37S,
  wgs84ToArc1960,
} from '@engine/transforms';
import {
  assessGCPDistribution,
  gcpsToCsv,
  gcpsToWebODM,
  gcpsToGeoJSON,
  nextGcpId,
} from '@engine/gcps';
import type { GCP, Project, TargetType } from '@/types';

export default function GcpScreen() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();

  const [project, setProject] = useState<Project | null>(null);
  const [gcps, setGcps] = useState<GCP[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    const p = await getProject(projectId);
    setProject(p);
    const gs = await getGCPs(projectId);
    setGcps(gs);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const captureGcp = async () => {
    if (!project) return;
    setCapturing(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission required for GCP capture.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });

      // Convert WGS84 → Arc 1960 / UTM 37S (Kenya default)
      const utm = wgs84ToArc1960Utm37S({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      });
      const arcLatLng = wgs84ToArc1960({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      });

      const gcpId = nextGcpId(gcps.map(g => g.gcpId));
      const accuracyMm = loc.coords.accuracy
        ? Math.round(loc.coords.accuracy * 1000)
        : undefined;

      // Determine solution type from accuracy
      let solutionType: GCP['solutionType'] = 'single';
      if (loc.coords.accuracy != null) {
        if (loc.coords.accuracy <= 0.02) solutionType = 'fixed';
        else if (loc.coords.accuracy <= 0.5) solutionType = 'float';
        else if (loc.coords.accuracy <= 3) solutionType = 'dgps';
      }

      const gcp = await createGCP({
        projectId,
        gcpId,
        easting: utm.easting,
        northing: utm.northing,
        elevation: loc.coords.altitude ?? 0,
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        height: loc.coords.altitude ?? 0,
        accuracyMm,
        solutionType,
        targetType: 'checkerboard',
        targetSizeM: 0.6,
      });

      await load();
      Alert.alert(
        'GCP captured',
        `${gcpId}\nLat: ${loc.coords.latitude.toFixed(7)}\nLng: ${loc.coords.longitude.toFixed(7)}\nElev: ${(loc.coords.altitude ?? 0).toFixed(2)}m\nAccuracy: ±${(loc.coords.accuracy ?? 0).toFixed(2)}m (${solutionType})`
      );
    } catch (err: any) {
      Alert.alert('Capture failed', err.message);
    } finally {
      setCapturing(false);
    }
  };

  const handleExportCsv = async () => {
    if (gcps.length === 0) return;
    const csv = gcpsToCsv(gcps, true);
    await Share.share({
      message: `METARDU ACCESS — GCP FILE (CSV)\nProject: ${project?.name}\nGenerated: ${new Date().toISOString()}\n\n${csv}`,
    });
  };

  const handleExportWebODM = async () => {
    if (gcps.length === 0) return;
    const txt = gcpsToWebODM(gcps);
    await Share.share({
      message: `# Metardu Access GCP file for WebODM\n# Project: ${project?.name}\n# Generated: ${new Date().toISOString()}\n# Format: lat lng height "gcp_id"\n\n${txt}`,
    });
  };

  const handleExportGeoJSON = async () => {
    if (gcps.length === 0) return;
    const geojson = gcpsToGeoJSON(gcps);
    await Share.share({
      message: JSON.stringify(geojson, null, 2),
    });
  };

  const assessment = gcps.length > 0 ? assessGCPDistribution(gcps) : null;

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
          <Text style={styles.title}>Drone / GCPs</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{project.name}</Text>
        </View>
      </View>

      {/* Stats summary */}
      <View style={styles.statsRow}>
        <StatCard icon="map-marker-multiple" label="GCPs" value={String(gcps.length)} color={Colors.metarduOrange} />
        <StatCard
          icon="check-decagram"
          label="Fixed"
          value={String(gcps.filter(g => g.solutionType === 'fixed').length)}
          color={Colors.success}
        />
        <StatCard
          icon="crosshairs"
          label="Avg Accuracy"
          value={gcps.length > 0 && gcps[0].accuracyMm != null
            ? `${Math.round(gcps.reduce((s, g) => s + (g.accuracyMm ?? 0), 0) / gcps.length)}mm`
            : '—'}
          color={Colors.info}
        />
        <StatCard
          icon="swap-vertical"
          label="Spacing"
          value={assessment ? `${assessment.spacing.toFixed(0)}m` : '—'}
          color={Colors.warning}
        />
      </View>

      {/* Capture button */}
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <Button
          title="Capture GCP (GNSS RTK)"
          onPress={captureGcp}
          loading={capturing}
          fullWidth
          size="lg"
          icon={<MaterialCommunityIcons name="crosshairs-gps" size={20} color={Colors.metarduWhite} />}
        />
      </View>

      {/* Assessment card */}
      {assessment && (
        <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
          <Card style={[
            styles.assessmentCard,
            { borderLeftColor: assessment.issues.length === 0 ? Colors.success : Colors.warning },
          ]}>
            <View style={styles.assessmentHeader}>
              <MaterialCommunityIcons
                name={assessment.issues.length === 0 ? 'check-decagram' : 'alert-decagram'}
                size={18}
                color={assessment.issues.length === 0 ? Colors.success : Colors.warning}
              />
              <Text style={styles.assessmentTitle}>
                {assessment.issues.length === 0
                  ? 'GCP distribution OK — ready for drone flight'
                  : `${assessment.issues.length} issue(s) to review`}
              </Text>
            </View>
            {assessment.issues.map((issue, i) => (
              <View key={`i${i}`} style={styles.assessmentRow}>
                <MaterialCommunityIcons name="alert-circle-outline" size={12} color={Colors.warning} />
                <Text style={[styles.assessmentText, { color: Colors.warning }]}>{issue}</Text>
              </View>
            ))}
            {assessment.recommendations.slice(0, 2).map((rec, i) => (
              <View key={`r${i}`} style={styles.assessmentRow}>
                <MaterialCommunityIcons name="lightbulb-outline" size={12} color={Colors.info} />
                <Text style={[styles.assessmentText, { color: Colors.info }]}>{rec}</Text>
              </View>
            ))}
          </Card>
        </View>
      )}

      {/* GCP list */}
      {gcps.length === 0 ? (
        <EmptyState
          icon="map-marker-multiple"
          title="No GCPs captured"
          subtitle="Place GCP targets (checkerboards) across the survey area and capture each with GNSS RTK. The desktop's photogrammetry pipeline uses these for cm-level accuracy."
        />
      ) : (
        <FlatList
          data={gcps}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingTop: 0 }}
          renderItem={({ item }) => <GcpCard gcp={item} onDelete={async () => {
            Alert.alert(
              'Delete GCP?',
              `Delete ${item.gcpId}?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    await deleteGCP(item.id);
                    await load();
                  },
                },
              ]
            );
          }} />}
        />
      )}

      {/* Export buttons */}
      {gcps.length > 0 && (
        <View style={styles.exportBar}>
          <Button title="CSV" variant="outline" size="sm" onPress={handleExportCsv} style={{ flex: 1 }} />
          <Button title="WebODM" variant="outline" size="sm" onPress={handleExportWebODM} style={{ flex: 1 }} />
          <Button title="GeoJSON" variant="outline" size="sm" onPress={handleExportGeoJSON} style={{ flex: 1 }} />
        </View>
      )}
    </SafeAreaView>
  );
}

function GcpCard({ gcp, onDelete }: { gcp: GCP; onDelete: () => void }) {
  const solConfig = SOLUTION_TYPES.find(s => s.value === gcp.solutionType);
  const targetConfig = TARGET_TYPES.find(t => t.value === gcp.targetType);

  return (
    <Card style={{ marginBottom: 10 }}>
      <View style={styles.gcpRow}>
        {gcp.photoUri ? (
          <Image source={{ uri: gcp.photoUri }} style={styles.gcpPhoto} />
        ) : (
          <View style={[styles.gcpPhoto, styles.noPhoto]}>
            <MaterialCommunityIcons name={targetConfig?.icon as any ?? 'map-marker'} size={22} color={Colors.gray400} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={styles.gcpHeader}>
            <Text style={styles.gcpId}>{gcp.gcpId}</Text>
            {solConfig && (
              <View style={[styles.solBadge, { backgroundColor: `${solConfig.color}20` }]}>
                <Text style={[styles.solText, { color: solConfig.color }]}>{solConfig.label}</Text>
              </View>
            )}
          </View>
          <Text style={styles.gcpCoords}>
            E: {gcp.easting.toFixed(3)}    N: {gcp.northing.toFixed(3)}    Elev: {gcp.elevation.toFixed(2)}
          </Text>
          {gcp.lat != null && gcp.lng != null && (
            <Text style={styles.gcpWgs}>
              Lat: {gcp.lat.toFixed(7)}    Lng: {gcp.lng.toFixed(7)}
            </Text>
          )}
          {gcp.accuracyMm != null && (
            <Text style={styles.gcpAcc}>Accuracy: ±{gcp.accuracyMm}mm</Text>
          )}
        </View>
        <TouchableOpacity onPress={onDelete} style={{ padding: 4 }}>
          <MaterialCommunityIcons name="delete-outline" size={20} color={Colors.danger} />
        </TouchableOpacity>
      </View>
    </Card>
  );
}

function StatCard({
  icon, label, value, color,
}: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <MaterialCommunityIcons name={icon as any} size={14} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
  subtitle: {
    fontSize: 13,
    color: Colors.gray500,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
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
    fontSize: 13,
    fontWeight: '700',
    color: Colors.metarduNavy,
    fontFamily: 'JetBrainsMono',
  },
  statLabel: {
    fontSize: 9,
    color: Colors.gray500,
    textTransform: 'uppercase',
  },
  assessmentCard: {
    borderLeftWidth: 4,
  },
  assessmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  assessmentTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.metarduNavy,
  },
  assessmentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 3,
  },
  assessmentText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 14,
  },
  gcpRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  gcpPhoto: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: Colors.gray100,
  },
  noPhoto: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gcpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  gcpId: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.metarduNavy,
    fontFamily: 'JetBrainsMono',
  },
  solBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  solText: {
    fontSize: 9,
    fontWeight: '700',
  },
  gcpCoords: {
    fontSize: 11,
    color: Colors.metarduNavy,
    fontFamily: 'JetBrainsMono',
  },
  gcpWgs: {
    fontSize: 10,
    color: Colors.gray500,
    fontFamily: 'JetBrainsMono',
    marginTop: 2,
  },
  gcpAcc: {
    fontSize: 10,
    color: Colors.metarduOrange,
    marginTop: 2,
    fontWeight: '600',
  },
  exportBar: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: Colors.metarduWhite,
    borderTopWidth: 1,
    borderTopColor: Colors.gray200,
  },
});
