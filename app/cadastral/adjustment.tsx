/**
 * Traverse Adjustment Results — detailed view of Bowditch / Transit / LSA output.
 * Shows: misclosures, precision, per-leg corrections, adjusted coordinates, corrections log.
 */

import React, { useState, useEffect } from 'react';
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
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { getTraverses, getTraverse, computePreview } from '@/lib/db/traverses';
import { getProject } from '@/lib/db/queries';
import type { TraverseWithLegs } from '@/lib/db/traverses';
import type { TraverseAdjustmentResult } from '@engine/traverse';
import type { Project } from '@/types';

export default function AdjustmentScreen() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();

  const [project, setProject] = useState<Project | null>(null);
  const [traverses, setTraverses] = useState<TraverseWithLegs[]>([]);
  const [selected, setSelected] = useState<TraverseWithLegs | null>(null);
  const [preview, setPreview] = useState<TraverseAdjustmentResult | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    const p = await getProject(projectId);
    setProject(p);
    const travs = await getTraverses(projectId);
    const full: TraverseWithLegs[] = [];
    for (const t of travs) {
      const f = await getTraverse(t.id);
      if (f) full.push(f);
    }
    setTraverses(full);
    if (full.length > 0) setSelected(full[0]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [projectId]);

  useEffect(() => {
    if (selected && selected.legs.length > 0 && selected.startEasting !== undefined) {
      const result = computePreview(
        selected.legs,
        selected.startEasting,
        selected.startNorthing!,
        selected.closeEasting,
        selected.closeNorthing
      );
      setPreview(result);
    } else {
      setPreview(null);
    }
  }, [selected]);

  const handleShare = async () => {
    if (!preview || !selected) return;
    const lines = [
      `METARDU ACCESS — TRAVERSE ADJUSTMENT REPORT`,
      `Project: ${project?.name ?? '—'}`,
      `Traverse: ${selected.name}`,
      `Method: Bowditch (Compass)`,
      ``,
      `SUMMARY`,
      `  Perimeter:          ${preview.perimeter.toFixed(3)} m`,
      `  Linear misclosure:  ${preview.linearMisclosure.toFixed(4)} m`,
      `  Angular misclosure: ${preview.angularMisclosure.toFixed(4)}°`,
      `  Precision ratio:    ${preview.precisionRatio}`,
      `  Kenya 3rd order:    ${preview.precisionPasses ? 'PASS (≥1:5000)' : 'FAIL (<1:5000)'}`,
      ``,
      `ADJUSTED COORDINATES`,
      ...Object.entries(preview.adjustedCoordinates).map(
        ([pt, c]) => `  ${pt.padEnd(10)} E: ${c.easting.toFixed(3).padStart(12)}  N: ${c.northing.toFixed(3).padStart(12)}`
      ),
      ``,
      `Sealed: ${new Date().toISOString()}`,
    ].join('\n');
    await Share.share({ message: lines });
  };

  if (!project) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF7F2' }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#6B7280' }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF7F2' }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={'#0B1F3A'} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Adjustment Results</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{project.name}</Text>
        </View>
        {preview && (
          <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
            <MaterialCommunityIcons name="share-variant" size={18} color={'#F97316'} />
          </TouchableOpacity>
        )}
      </View>

      {traverses.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selector} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {traverses.map((t) => (
            <TouchableOpacity
              key={t.id}
              onPress={() => setSelected(t)}
              style={[styles.chip, selected?.id === t.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, selected?.id === t.id && styles.chipTextActive]}>
                {t.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {!selected || selected.legs.length === 0 ? (
          <EmptyState
            icon="chart-line"
            title="No traverses to adjust"
            subtitle="Create a traverse and add legs first."
          />
        ) : !preview ? (
          <EmptyState
            icon="alert-circle"
            title="Cannot compute adjustment"
            subtitle="Traverse needs start coordinates (set during creation)."
          />
        ) : (
          <>
            {/* Summary card */}
            <Card style={[styles.summaryCard, { borderLeftColor: preview.precisionPasses ? '#10B981' : '#EF4444' }]}>
              <View style={styles.summaryHeader}>
                <MaterialCommunityIcons
                  name={preview.precisionPasses ? 'check-decagram' : 'alert-decagram'}
                  size={28}
                  color={preview.precisionPasses ? '#10B981' : '#EF4444'}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryTitle}>{preview.precisionRatio}</Text>
                  <Text style={styles.summarySubtitle}>Precision Ratio</Text>
                </View>
                <View style={[styles.passBadge, { backgroundColor: preview.precisionPasses ? '#10B981' : '#EF4444' }]}>
                  <Text style={styles.passBadgeText}>
                    {preview.precisionPasses ? 'PASS' : 'FAIL'}
                  </Text>
                </View>
              </View>
              <Text style={styles.summaryNote}>
                Kenya 3rd order minimum: 1:5000 (Survey Regulations 1994)
              </Text>
            </Card>

            {/* Misclosure details */}
            <Card style={{ marginBottom: 12 }}>
              <Text style={styles.cardTitle}>Misclosure Analysis</Text>
              <DetailRow label="Perimeter" value={`${preview.perimeter.toFixed(3)} m`} />
              <DetailRow label="Linear misclosure" value={`${preview.linearMisclosure.toFixed(4)} m`} />
              <DetailRow label="Angular misclosure" value={`${preview.angularMisclosure.toFixed(4)}°`} />
              <DetailRow
                label="Allowable (3rd order)"
                value={`${(preview.perimeter / 5000).toFixed(4)} m`}
              />
              <DetailRow
                label="Status"
                value={preview.precisionPasses ? 'Within tolerance' : 'Exceeds tolerance'}
                valueColor={preview.precisionPasses ? '#10B981' : '#EF4444'}
              />
            </Card>

            {/* Per-leg corrections */}
            <Card style={{ marginBottom: 12 }}>
              <Text style={styles.cardTitle}>Per-Leg Corrections</Text>
              <View style={styles.legTableHeader}>
                <Text style={[styles.legTableHeaderCell, { flex: 1.5 }]}>Leg</Text>
                <Text style={[styles.legTableHeaderCell, { flex: 1 }]}>ΔE corr</Text>
                <Text style={[styles.legTableHeaderCell, { flex: 1 }]}>ΔN corr</Text>
                <Text style={[styles.legTableHeaderCell, { flex: 1 }]}>Dist</Text>
              </View>
              {preview.legs.map((leg, i) => (
                <View key={i} style={styles.legTableRow}>
                  <Text style={[styles.legTableCell, { flex: 1.5, color: '#F97316', fontWeight: '600' }]}>
                    {leg.fromPoint}→{leg.toPoint}
                  </Text>
                  <Text style={[styles.legTableCell, { flex: 1 }]}>
                    {leg.correctionEasting >= 0 ? '+' : ''}{leg.correctionEasting.toFixed(4)}
                  </Text>
                  <Text style={[styles.legTableCell, { flex: 1 }]}>
                    {leg.correctionNorthing >= 0 ? '+' : ''}{leg.correctionNorthing.toFixed(4)}
                  </Text>
                  <Text style={[styles.legTableCell, { flex: 1 }]}>
                    {leg.correctedDistance.toFixed(3)}
                  </Text>
                </View>
              ))}
            </Card>

            {/* Adjusted coordinates */}
            <Card style={{ marginBottom: 12 }}>
              <Text style={styles.cardTitle}>Adjusted Coordinates</Text>
              <View style={styles.legTableHeader}>
                <Text style={[styles.legTableHeaderCell, { flex: 1 }]}>Point</Text>
                <Text style={[styles.legTableHeaderCell, { flex: 1.5 }]}>Easting</Text>
                <Text style={[styles.legTableHeaderCell, { flex: 1.5 }]}>Northing</Text>
              </View>
              {Object.entries(preview.adjustedCoordinates).map(([pt, c]) => (
                <View key={pt} style={styles.legTableRow}>
                  <Text style={[styles.legTableCell, { flex: 1, color: '#F97316', fontWeight: '600' }]}>
                    {pt}
                  </Text>
                  <Text style={[styles.legTableCell, { flex: 1.5 }]}>
                    {c.easting.toFixed(3)}
                  </Text>
                  <Text style={[styles.legTableCell, { flex: 1.5 }]}>
                    {c.northing.toFixed(3)}
                  </Text>
                </View>
              ))}
            </Card>

            {/* Corrections log */}
            <Card>
              <Text style={styles.cardTitle}>Corrections Log</Text>
              <Text style={styles.logText}>
                {JSON.stringify(preview.correctionsLog, null, 2)}
              </Text>
            </Card>

            <Button
              title="Share Report"
              onPress={handleShare}
              style={{ marginTop: 16 }}
              icon={<MaterialCommunityIcons name="share-variant" size={18} color={'#FFFFFF'} />}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
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
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  shareBtn: {
    padding: 8,
  },
  selector: {
    maxHeight: 44,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
  },
  chipActive: {
    backgroundColor: '#0B1F3A',
  },
  chipText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  summaryCard: {
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0B1F3A',
    fontFamily: 'JetBrainsMono',
  },
  summarySubtitle: {
    fontSize: 11,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  passBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  passBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  summaryNote: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 8,
    fontStyle: 'italic',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0B1F3A',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  detailLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 13,
    color: '#0B1F3A',
    fontWeight: '600',
    fontFamily: 'JetBrainsMono',
  },
  legTableHeader: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1.5,
    borderBottomColor: '#0B1F3A',
  },
  legTableHeaderCell: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0B1F3A',
    textTransform: 'uppercase',
  },
  legTableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  legTableCell: {
    fontSize: 12,
    color: '#0B1F3A',
    fontFamily: 'JetBrainsMono',
  },
  logText: {
    fontSize: 10,
    color: '#6B7280',
    fontFamily: 'JetBrainsMono',
    lineHeight: 14,
  },
});
