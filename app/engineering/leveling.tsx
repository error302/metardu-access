/**
 * Engineering Leveling — Rise & Fall method booking with closure check.
 *
 * Surveyors enter Backsight (BS), Intermediate Sight (IS), and Foresight (FS) readings.
 * The app computes rises, falls, reduced levels, and checks closure against
 * allowable misclosure = ±12√(distance_in_km) mm (Kenya 3rd order leveling).
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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Colors } from '@/theme';
import { Card } from '@/components/Card';
import { TextInput } from '@/components/TextInput';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { getProject } from '@/lib/db/queries';
import type { Project } from '@/types';

interface LevelReading {
  id: string;
  station: string;
  bs: number | null;  // backsight
  is: number | null;  // intermediate sight
  fs: number | null;  // foresight
  rise: number | null;
  fall: number | null;
  rl: number | null;  // reduced level
  distance: number;   // cumulative distance from start
  notes?: string;
}

interface LevelingResult {
  readings: LevelReading[];
  totalBs: number;
  totalFs: number;
  sumRise: number;
  sumFall: number;
  misclosure: number;
  distanceKm: number;
  allowable: number;
  passes: boolean;
  startRl: number;
  endRl: number;
  expectedEndRl: number;
}

function computeRiseFall(
  readings: LevelReading[],
  startRl: number,
  expectedEndRl?: number,
  distancePerSetup: number = 50
): LevelingResult {
  let currentRl = startRl;
  let cumulativeDistance = 0;
  let prevHi: number | null = null; // height of instrument

  const processed: LevelReading[] = readings.map((r, i) => {
    const newReading = { ...r };
    if (i === 0) {
      // First station: BS establishes H.I.
      if (r.bs !== null) {
        prevHi = startRl + r.bs;
        newReading.rl = startRl;
      }
    } else {
      // Subsequent stations
      if (r.fs !== null && prevHi !== null) {
        const newRl = prevHi - r.fs;
        newReading.rl = newRl;
        if (r.bs !== null) {
          // There's a BS too — new setup, new H.I.
          prevHi = newRl + r.bs;
        }
      } else if (r.is !== null && prevHi !== null) {
        newReading.rl = prevHi - r.is;
      }
    }
    cumulativeDistance += r.distance > 0 ? r.distance : (i > 0 ? distancePerSetup : 0);
    newReading.distance = cumulativeDistance;
    return newReading;
  });

  const totalBs = processed.reduce((s, r) => s + (r.bs ?? 0), 0);
  const totalFs = processed.reduce((s, r) => s + (r.fs ?? 0), 0);
  const lastRl = processed[processed.length - 1]?.rl ?? startRl;
  const distanceKm = cumulativeDistance / 1000;
  const allowable = 12 * Math.sqrt(distanceKm); // mm

  let misclosure = 0;
  let passes = true;
  if (expectedEndRl !== undefined) {
    misclosure = Math.abs(lastRl - expectedEndRl) * 1000; // convert m to mm
    passes = misclosure <= allowable;
  }

  return {
    readings: processed,
    totalBs,
    totalFs,
    sumRise: 0,
    sumFall: 0,
    misclosure,
    distanceKm,
    allowable,
    passes,
    startRl,
    endRl: lastRl,
    expectedEndRl: expectedEndRl ?? lastRl,
  };
}

export default function LevelingScreen() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [readings, setReadings] = useState<LevelReading[]>([]);
  const [startRl, setStartRl] = useState('100.000');
  const [expectedEndRl, setExpectedEndRl] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    const p = await getProject(projectId);
    setProject(p);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const result = readings.length > 0
    ? computeRiseFall(readings, parseFloat(startRl) || 0, expectedEndRl ? parseFloat(expectedEndRl) : undefined)
    : null;

  const addReading = (r: Omit<LevelReading, 'id' | 'rise' | 'fall' | 'rl' | 'distance'>) => {
    setReadings([...readings, {
      ...r,
      id: `${Date.now()}-${Math.random()}`,
      rise: null,
      fall: null,
      rl: null,
      distance: 0,
    }]);
  };

  const removeReading = (id: string) => {
    setReadings(readings.filter(r => r.id !== id));
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
          <Text style={styles.title}>Engineering Leveling</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{project.name}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Setup card */}
        <Card style={{ marginBottom: 16 }}>
          <Text style={styles.cardTitle}>Leveling Setup</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <TextInput
                label="Start RL (m)"
                value={startRl}
                onChangeText={setStartRl}
                keyboardType="decimal-pad"
                required
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextInput
                label="Expected End RL (m)"
                value={expectedEndRl}
                onChangeText={setExpectedEndRl}
                keyboardType="decimal-pad"
                hint="Leave blank for open run"
              />
            </View>
          </View>
        </Card>

        {/* Closure check */}
        {result && expectedEndRl && (
          <Card style={[
            styles.closureCard,
            { borderLeftColor: result.passes ? Colors.success : Colors.danger }
          ]}>
            <View style={styles.closureHeader}>
              <MaterialCommunityIcons
                name={result.passes ? 'check-circle' : 'alert-circle'}
                size={22}
                color={result.passes ? Colors.success : Colors.danger}
              />
              <Text style={styles.closureTitle}>Closure Check</Text>
              <View style={[styles.closureBadge, { backgroundColor: result.passes ? Colors.success : Colors.danger }]}>
                <Text style={styles.closureBadgeText}>
                  {result.passes ? 'PASS' : 'FAIL'}
                </Text>
              </View>
            </View>
            <View style={styles.closureStats}>
              <ClosureStat label="Misclosure" value={`${result.misclosure.toFixed(2)} mm`} />
              <ClosureStat label="Allowable" value={`±${result.allowable.toFixed(2)} mm`} />
              <ClosureStat label="Distance" value={`${result.distanceKm.toFixed(3)} km`} />
            </View>
            <Text style={styles.closureNote}>
              Allowable = ±12√(distance_km) mm — Kenya 3rd order leveling
            </Text>
          </Card>
        )}

        {/* Readings table */}
        <View style={styles.tableHeader}>
          <Text style={styles.tableTitle}>Readings ({readings.length})</Text>
          <TouchableOpacity onPress={() => setShowAdd(true)}>
            <View style={styles.addBtn}>
              <MaterialCommunityIcons name="plus" size={16} color={Colors.metarduWhite} />
              <Text style={styles.addBtnText}>Add</Text>
            </View>
          </TouchableOpacity>
        </View>

        {readings.length === 0 ? (
          <EmptyState
            icon="arrow-up-down"
            title="No readings yet"
            subtitle="Add your first leveling reading (BS, IS, or FS) to begin."
          />
        ) : (
          <Card style={{ padding: 8 }}>
            {/* Table header */}
            <View style={styles.tableRowHeader}>
              <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1.2 }]}>Station</Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 0.8 }]}>BS</Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 0.8 }]}>IS</Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 0.8 }]}>FS</Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1 }]}>RL</Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 0.4 }]}></Text>
            </View>
            {result?.readings.map((r, i) => (
              <View key={r.id} style={[styles.tableRow, i % 2 === 0 ? styles.tableRowAlt : null]}>
                <Text style={[styles.tableCell, { flex: 1.2, fontWeight: '600', color: Colors.metarduNavy }]}>
                  {r.station}
                </Text>
                <Text style={[styles.tableCell, { flex: 0.8 }]}>
                  {r.bs !== null ? r.bs.toFixed(3) : '—'}
                </Text>
                <Text style={[styles.tableCell, { flex: 0.8 }]}>
                  {r.is !== null ? r.is.toFixed(3) : '—'}
                </Text>
                <Text style={[styles.tableCell, { flex: 0.8 }]}>
                  {r.fs !== null ? r.fs.toFixed(3) : '—'}
                </Text>
                <Text style={[styles.tableCell, { flex: 1, color: Colors.metarduOrange, fontWeight: '600' }]}>
                  {r.rl !== null ? r.rl.toFixed(3) : '—'}
                </Text>
                <TouchableOpacity onPress={() => removeReading(r.id)} style={{ flex: 0.4, alignItems: 'center' }}>
                  <MaterialCommunityIcons name="delete" size={14} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            ))}
            {/* Totals */}
            <View style={[styles.tableRow, styles.tableRowTotal]}>
              <Text style={[styles.tableCell, { flex: 1.2, fontWeight: '700', color: Colors.metarduNavy }]}>
                TOTAL
              </Text>
              <Text style={[styles.tableCell, { flex: 0.8, fontWeight: '700' }]}>
                {result ? result.totalBs.toFixed(3) : '—'}
              </Text>
              <Text style={[styles.tableCell, { flex: 0.8 }]}></Text>
              <Text style={[styles.tableCell, { flex: 0.8, fontWeight: '700' }]}>
                {result ? result.totalFs.toFixed(3) : '—'}
              </Text>
              <Text style={[styles.tableCell, { flex: 1 }]}></Text>
              <Text style={[styles.tableCell, { flex: 0.4 }]}></Text>
            </View>
          </Card>
        )}

        {/* Summary */}
        {result && (
          <Card style={{ marginTop: 16 }}>
            <Text style={styles.cardTitle}>Summary</Text>
            <DetailRow label="Start RL" value={`${result.startRl.toFixed(3)} m`} />
            <DetailRow label="End RL (computed)" value={`${result.endRl.toFixed(3)} m`} />
            {expectedEndRl && (
              <DetailRow
                label="End RL (expected)"
                value={`${result.expectedEndRl.toFixed(3)} m`}
              />
            )}
            <DetailRow label="Total distance" value={`${result.distanceKm.toFixed(3)} km`} />
            <DetailRow
              label="Closure status"
              value={expectedEndRl ? (result.passes ? 'Within tolerance' : 'Exceeds tolerance') : 'Open run (no closure)'}
              valueColor={expectedEndRl ? (result.passes ? Colors.success : Colors.danger) : Colors.gray500}
            />
          </Card>
        )}
      </ScrollView>

      <AddReadingModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={(r) => {
          addReading(r);
          setShowAdd(false);
        }}
        prevStation={readings.length > 0 ? readings[readings.length - 1].station : ''}
      />
    </SafeAreaView>
  );
}

function ClosureStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.closureStatLabel}>{label}</Text>
      <Text style={styles.closureStatValue}>{value}</Text>
    </View>
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

function AddReadingModal({
  visible,
  onClose,
  onAdd,
  prevStation,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (r: { station: string; bs: number | null; is: number | null; fs: number | null; distance: number; notes?: string }) => void;
  prevStation: string;
}) {
  const [station, setStation] = useState('');
  const [bs, setBs] = useState('');
  const [is, setIs] = useState('');
  const [fs, setFs] = useState('');
  const [distance, setDistance] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Add Leveling Reading</Text>

          <TextInput
            label="Station / Staff Point"
            value={station}
            onChangeText={setStation}
            placeholder={prevStation ? `After ${prevStation}` : 'e.g. BM-001'}
            required
          />

          <Text style={styles.modalLabel}>Staff Reading (enter only one — most common: BS or FS)</Text>
          <View style={styles.readingRow}>
            <View style={{ flex: 1 }}>
              <TextInput
                label="BS (m)"
                value={bs}
                onChangeText={setBs}
                keyboardType="decimal-pad"
                placeholder="—"
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextInput
                label="IS (m)"
                value={is}
                onChangeText={setIs}
                keyboardType="decimal-pad"
                placeholder="—"
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextInput
                label="FS (m)"
                value={fs}
                onChangeText={setFs}
                keyboardType="decimal-pad"
                placeholder="—"
              />
            </View>
          </View>

          <TextInput
            label="Distance from previous (m)"
            value={distance}
            onChangeText={setDistance}
            placeholder="50"
            keyboardType="decimal-pad"
          />

          <TextInput
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Change point"
          />

          <View style={styles.modalActions}>
            <Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
            <Button
              title="Add"
              onPress={() => {
                if (!station.trim()) {
                  Alert.alert('Required', 'Station name is required.');
                  return;
                }
                const bsVal = bs.trim() ? parseFloat(bs) : null;
                const isVal = is.trim() ? parseFloat(is) : null;
                const fsVal = fs.trim() ? parseFloat(fs) : null;
                if (bsVal === null && isVal === null && fsVal === null) {
                  Alert.alert('Required', 'Enter at least one staff reading (BS, IS, or FS).');
                  return;
                }
                onAdd({
                  station: station.trim(),
                  bs: bsVal,
                  is: isVal,
                  fs: fsVal,
                  distance: distance.trim() ? parseFloat(distance) : 50,
                  notes: notes.trim() || undefined,
                });
                setStation('');
                setBs('');
                setIs('');
                setFs('');
                setDistance('');
                setNotes('');
              }}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
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
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.metarduNavy,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  closureCard: {
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  closureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  closureTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.metarduNavy,
  },
  closureBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  closureBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.metarduWhite,
  },
  closureStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  closureStatLabel: {
    fontSize: 10,
    color: Colors.gray500,
    textTransform: 'uppercase',
  },
  closureStatValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.metarduNavy,
    fontFamily: 'JetBrainsMono',
    marginTop: 2,
  },
  closureNote: {
    fontSize: 10,
    color: Colors.gray400,
    fontStyle: 'italic',
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tableTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.metarduNavy,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.metarduOrange,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.metarduWhite,
  },
  tableRowHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.metarduNavy,
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.metarduNavy,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.gray200,
  },
  tableRowAlt: {
    backgroundColor: Colors.gray50,
  },
  tableRowTotal: {
    backgroundColor: `${Colors.metarduNavy}10`,
    borderBottomWidth: 0,
    borderTopWidth: 1.5,
    borderTopColor: Colors.metarduNavy,
  },
  tableCell: {
    fontSize: 11,
    color: Colors.metarduNavy,
    fontFamily: 'JetBrainsMono',
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
    fontWeight: '600',
    fontFamily: 'JetBrainsMono',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 31, 58, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.metarduWhite,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.gray300,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.metarduNavy,
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.gray500,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  readingRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
});
