/**
 * Seal & Submit — apply cryptographic seal to field sessions for statutory compliance.
 *
 * v0.2: HMAC-SHA256 seal using surveyor-specific key.
 *       Tamper-evident — any change to the session payload invalidates the seal.
 *       Survey Regulations 3(2) compliant electronic seal.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Colors } from '@/theme';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { useAuthStore } from '@/stores/authStore';
import { getProject, getPoints } from '@/lib/db/queries';
import { getTraverses, getTraverse } from '@/lib/db/traverses';
import { getParcels } from '@/lib/db/parcels';
import { getBeacons } from '@/lib/db/beacons';
import { sealSession, type SealResult } from '@/lib/crypto/seal';
import { buildSession } from '@/lib/sync/engine';
import type { Project } from '@/types';

export default function SealScreen() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const profile = useAuthStore((s) => s.profile);

  const [project, setProject] = useState<Project | null>(null);
  const [stats, setStats] = useState({
    points: 0,
    observations: 0,
    traverses: 0,
    parcels: 0,
    beacons: 0,
  });
  const [seal, setSeal] = useState<SealResult | null>(null);
  const [sealing, setSealing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!projectId || !profile) return;
    setLoading(true);
    const p = await getProject(projectId);
    setProject(p);
    const points = await getPoints(projectId);
    const traverses = await getTraverses(projectId);
    const parcels = await getParcels(projectId);
    const beacons = await getBeacons(projectId);
    setStats({
      points: points.length,
      observations: 0, // observations are session-scoped; placeholder
      traverses: traverses.length,
      parcels: parcels.length,
      beacons: beacons.length,
    });
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [projectId, profile]);

  const handleSeal = async () => {
    if (!project || !profile) return;
    if (stats.points === 0) {
      Alert.alert(
        'Cannot seal',
        'This project has no captured points. Capture field data before sealing.'
      );
      return;
    }
    if (!profile.verifiedIsk) {
      Alert.alert(
        'ISK verification required',
        'Your ISK license must be verified before you can seal sessions. Contact your administrator.',
        [
          { text: 'OK' },
          {
            text: 'Seal anyway (demo)',
            onPress: () => doSeal(),
          },
        ]
      );
      return;
    }
    doSeal();
  };

  const doSeal = async () => {
    if (!project || !profile) return;
    setSealing(true);
    try {
      // Build the full session payload
      const points = await getPoints(projectId);
      const traverses = await getTraverses(projectId);
      const parcels = await getParcels(projectId);
      const beacons = await getBeacons(projectId);

      // Build a comprehensive payload for sealing
      const payload = {
        project: {
          id: project.id,
          name: project.name,
          surveyType: project.surveyType,
          county: project.county,
          lrNumber: project.lrNumber,
          crsEpsg: project.crsEpsg,
          datum: project.datum,
          projection: project.projection,
          surveyorName: project.surveyorName,
          surveyorLicense: project.surveyorLicense,
        },
        surveyor: {
          id: profile.id,
          email: profile.email,
          fullName: profile.fullName,
          iskNumber: profile.iskNumber,
          verifiedIsk: profile.verifiedIsk,
        },
        capturedAt: new Date().toISOString(),
        points: points.map(p => ({
          pointNumber: p.pointNumber,
          easting: p.easting,
          northing: p.northing,
          elevation: p.elevation,
          code: p.code,
          source: p.source,
          timestamp: p.timestamp,
        })),
        traverses: traverses.map(t => ({
          name: t.name,
          startPoint: t.startPointNumber,
          closingPoint: t.closingPointNumber,
          perimeter: t.perimeter,
          precisionRatio: t.precisionRatio,
          status: t.status,
        })),
        parcels: parcels.map(p => ({
          parcelNumber: p.parcelNumber,
          lrNumber: p.lrNumber,
          areaSqm: p.areaSqm,
          perimeterM: p.perimeterM,
          status: p.status,
        })),
        beacons: beacons.map(b => ({
          pointNumber: b.pointNumber,
          beaconType: b.beaconType,
          condition: b.condition,
        })),
        stats: {
          pointCount: points.length,
          traverseCount: traverses.length,
          parcelCount: parcels.length,
          beaconCount: beacons.length,
        },
      };

      const result = await sealSession({
        payload,
        surveyorName: profile.fullName,
        surveyorLicense: profile.iskNumber,
        firmName: profile.firmName,
      });
      setSeal(result);
    } catch (err: any) {
      Alert.alert('Seal failed', err.message);
    } finally {
      setSealing(false);
    }
  };

  const handleShare = async () => {
    if (!seal) return;
    await Share.share({ message: seal.certificateText });
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
          <Text style={styles.title}>Seal & Submit</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{project.name}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Surveyor card */}
        <Card style={{ marginBottom: 16 }}>
          <View style={styles.surveyorRow}>
            <View style={styles.surveyorIcon}>
              <MaterialCommunityIcons name="account" size={28} color={Colors.metarduNavy} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.surveyorName}>{profile?.fullName}</Text>
              <Text style={styles.surveyorIsk}>{profile?.iskNumber}</Text>
              {profile?.firmName && (
                <Text style={styles.surveyorFirm}>{profile.firmName}</Text>
              )}
            </View>
            <View style={[
              styles.verifyBadge,
              { backgroundColor: profile?.verifiedIsk ? `${Colors.success}20` : `${Colors.warning}20` }
            ]}>
              <MaterialCommunityIcons
                name={profile?.verifiedIsk ? 'check-decagram' : 'clock-outline'}
                size={12}
                color={profile?.verifiedIsk ? Colors.success : Colors.warning}
              />
              <Text style={[
                styles.verifyText,
                { color: profile?.verifiedIsk ? Colors.success : Colors.warning }
              ]}>
                {profile?.verifiedIsk ? 'Verified' : 'Pending'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Data summary */}
        <Text style={styles.sectionTitle}>Session Data</Text>
        <View style={styles.statsGrid}>
          <StatTile icon="map-marker" label="Points" value={stats.points} color={Colors.metarduOrange} />
          <StatTile icon="shape-polygon-plus" label="Traverses" value={stats.traverses} color={Colors.info} />
          <StatTile icon="vector-square" label="Parcels" value={stats.parcels} color={Colors.success} />
          <StatTile icon="map-marker-multiple" label="Beacons" value={stats.beacons} color={Colors.warning} />
        </View>

        {/* Seal button */}
        {!seal ? (
          <Card variant="elevated" style={{ marginTop: 16, alignItems: 'center', padding: 24 }}>
            <View style={styles.sealIcon}>
              <MaterialCommunityIcons name="lock-outline" size={48} color={Colors.metarduNavy} />
            </View>
            <Text style={styles.sealTitle}>Apply Cryptographic Seal</Text>
            <Text style={styles.sealDesc}>
              Sealing the session creates a tamper-evident HMAC-SHA256 signature using your surveyor-specific key.
              The seal proves you approved this data and any modification invalidates it.
            </Text>
            <Text style={styles.sealReg}>
              Survey Regulations 3(2) compliant electronic seal
            </Text>
            <Button
              title="Seal Session"
              onPress={handleSeal}
              loading={sealing}
              size="lg"
              style={{ marginTop: 16, width: '100%' }}
              icon={<MaterialCommunityIcons name="lock" size={18} color={Colors.metarduWhite} />}
            />
          </Card>
        ) : (
          <>
            {/* Seal certificate */}
            <Card style={[styles.certCard, { borderLeftColor: Colors.success }]}>
              <View style={styles.certHeader}>
                <MaterialCommunityIcons name="lock-check" size={32} color={Colors.success} />
                <Text style={styles.certTitle}>Session Sealed</Text>
              </View>

              <View style={styles.certRow}>
                <Text style={styles.certLabel}>Method</Text>
                <Text style={styles.certValue}>{seal.method.toUpperCase()}</Text>
              </View>
              <View style={styles.certRow}>
                <Text style={styles.certLabel}>Surveyor</Text>
                <Text style={styles.certValue}>{seal.surveyorName}</Text>
              </View>
              <View style={styles.certRow}>
                <Text style={styles.certLabel}>License</Text>
                <Text style={styles.certValue}>{seal.surveyorLicense}</Text>
              </View>
              <View style={styles.certRow}>
                <Text style={styles.certLabel}>Sealed at</Text>
                <Text style={styles.certValue}>
                  {new Date(seal.sealedAt).toLocaleString()}
                </Text>
              </View>
              <View style={styles.certRow}>
                <Text style={styles.certLabel}>Document Hash</Text>
                <Text style={[styles.certValue, styles.certHash]} numberOfLines={1}>
                  {seal.documentHash.slice(0, 32)}...
                </Text>
              </View>
              <View style={styles.certRow}>
                <Text style={styles.certLabel}>Signature</Text>
                <Text style={[styles.certValue, styles.certHash]} numberOfLines={1}>
                  {seal.signature.slice(0, 32)}...
                </Text>
              </View>
            </Card>

            {/* Full certificate text */}
            <Card style={{ marginTop: 12 }}>
              <Text style={styles.certTextTitle}>Certificate Text</Text>
              <Text style={styles.certText}>{seal.certificateText}</Text>
            </Card>

            <Button
              title="Share Certificate"
              onPress={handleShare}
              style={{ marginTop: 16 }}
              icon={<MaterialCommunityIcons name="share-variant" size={18} color={Colors.metarduWhite} />}
            />

            <Button
              title="Reset Seal"
              variant="ghost"
              onPress={() => {
                Alert.alert(
                  'Reset seal?',
                  'This will clear the current seal. You can re-seal after any data modifications.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Reset', onPress: () => setSeal(null) },
                  ]
                );
              }}
              style={{ marginTop: 8 }}
            />
          </>
        )}

        {/* Regulatory note */}
        <Card variant="outline" style={{ marginTop: 16 }}>
          <View style={styles.regRow}>
            <MaterialCommunityIcons name="information" size={16} color={Colors.info} />
            <Text style={styles.regText}>
              After sealing, the session is ready for export to a .field-session JSON file.
              The desktop will pull the sealed session for deed plan generation and NLIMS submission.
            </Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatTile({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={[styles.statTile, { borderTopColor: color }]}>
      <MaterialCommunityIcons name={icon as any} size={18} color={color} />
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
  surveyorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  surveyorIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: `${Colors.metarduNavy}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  surveyorName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.metarduNavy,
  },
  surveyorIsk: {
    fontSize: 13,
    color: Colors.metarduOrange,
    fontWeight: '600',
    marginTop: 2,
  },
  surveyorFirm: {
    fontSize: 11,
    color: Colors.gray500,
    marginTop: 2,
  },
  verifyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  verifyText: {
    fontSize: 11,
    fontWeight: '600',
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
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statTile: {
    flex: 1,
    backgroundColor: Colors.metarduWhite,
    borderRadius: 10,
    padding: 12,
    borderTopWidth: 3,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.metarduNavy,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.gray500,
  },
  sealIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: `${Colors.metarduNavy}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  sealTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.metarduNavy,
    textAlign: 'center',
    marginBottom: 8,
  },
  sealDesc: {
    fontSize: 13,
    color: Colors.gray500,
    textAlign: 'center',
    lineHeight: 18,
  },
  sealReg: {
    fontSize: 11,
    color: Colors.metarduOrange,
    fontStyle: 'italic',
    marginTop: 8,
  },
  certCard: {
    borderLeftWidth: 4,
  },
  certHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  certTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.success,
  },
  certRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.gray200,
  },
  certLabel: {
    fontSize: 12,
    color: Colors.gray500,
  },
  certValue: {
    fontSize: 12,
    color: Colors.metarduNavy,
    fontWeight: '600',
    fontFamily: 'JetBrainsMono',
  },
  certHash: {
    color: Colors.gray600,
    fontWeight: '400',
  },
  certTextTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.metarduNavy,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  certText: {
    fontSize: 11,
    color: Colors.gray600,
    fontFamily: 'JetBrainsMono',
    lineHeight: 16,
  },
  regRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  regText: {
    flex: 1,
    fontSize: 12,
    color: Colors.gray600,
    lineHeight: 17,
  },
});
