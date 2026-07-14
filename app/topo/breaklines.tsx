/**
 * Breaklines — capture sequences of points that constrain the TIN surface.
 *
 * Surveyors walk ridges, road edges, water courses, retaining walls, etc.
 * and capture ordered point sequences. These breaklines tell the desktop's
 * TIN engine where the surface should follow sharp edges (hard) vs. smooth
 * transitions (soft) vs. the survey extent (boundary).
 *
 * Without breaklines, the desktop's TIN interpolates incorrectly across
 * valleys and ridges — producing a smooth surface where reality is sharp.
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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Share } from 'react-native';

import { Colors } from '@/theme';
import { Card } from '@/components/Card';
import { TextInput } from '@/components/TextInput';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { getProject, getPoints } from '@/lib/db/queries';
import {
  createBreakline,
  getBreaklines,
  getBreakline,
  addBreaklinePoint,
  removeBreaklinePoint,
  deleteBreakline,
  BREAKLINE_TYPES,
} from '@/lib/db/breaklines';
import { validateBreakline, type BreaklineValidation } from '@engine/breaklines';
import { wgs84ToArc1960Utm37S } from '@engine/transforms';
import type { Breakline, BreaklineWithPoints, BreaklineType, Project } from '@/types';

export default function BreaklinesScreen() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();

  const [project, setProject] = useState<Project | null>(null);
  const [breaklines, setBreaklines] = useState<Breakline[]>([]);
  const [selected, setSelected] = useState<BreaklineWithPoints | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    const p = await getProject(projectId);
    setProject(p);
    const bls = await getBreaklines(projectId);
    setBreaklines(bls);
    if (bls.length > 0 && !selected) {
      setSelected(await getBreakline(bls[0].id));
    } else if (selected) {
      // Refresh selected to reflect new points
      setSelected(await getBreakline(selected.id));
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const captureGpsPoint = async () => {
    if (!selected) return;
    setCapturing(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission required for GPS capture.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const utm = wgs84ToArc1960Utm37S({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      });
      const pointNumber = `BL-${selected.pointCount + 1}`;
      await addBreaklinePoint({
        breaklineId: selected.id,
        pointNumber,
        easting: utm.easting,
        northing: utm.northing,
        elevation: loc.coords.altitude ?? 0,
      });
      await load();
      Alert.alert('Point captured', `${pointNumber} added to ${selected.name}.`);
    } catch (err: any) {
      Alert.alert('Capture failed', err.message);
    } finally {
      setCapturing(false);
    }
  };

  const addManualPoint = async (pointNumber: string, easting: number, northing: number, elevation: number) => {
    if (!selected) return;
    await addBreaklinePoint({
      breaklineId: selected.id,
      pointNumber,
      easting,
      northing,
      elevation,
    });
    await load();
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

  // Compute live validation if we have points
  const validation: BreaklineValidation | null = selected && selected.points.length > 0
    ? validateBreakline(selected.points.map(p => ({
        pointNumber: p.pointNumber,
        easting: p.easting,
        northing: p.northing,
        elevation: p.elevation,
      })))
    : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.metarduCream }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.metarduNavy} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Breaklines</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{project.name}</Text>
        </View>
        <Button title="+ New" size="sm" onPress={() => setShowNew(true)} />
      </View>

      {breaklines.length === 0 ? (
        <EmptyState
          icon="wave"
          title="No breaklines captured"
          subtitle="Breaklines constrain the TIN surface. Capture ridges, road edges, water courses, and walls so the desktop generates an accurate surface model."
          action={<Button title="Create Breakline" onPress={() => setShowNew(true)} />}
        />
      ) : (
        <View style={{ flex: 1 }}>
          {/* Breakline selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selector} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            {breaklines.map((bl) => {
              const typeConfig = BREAKLINE_TYPES.find(t => t.value === bl.type);
              const isActive = selected?.id === bl.id;
              return (
                <TouchableOpacity
                  key={bl.id}
                  onPress={async () => setSelected(await getBreakline(bl.id))}
                  style={[styles.blChip, isActive && { backgroundColor: typeConfig?.color ?? Colors.metarduNavy }]}
                >
                  <MaterialCommunityIcons
                    name={typeConfig?.icon as any ?? 'wave'}
                    size={12}
                    color={isActive ? Colors.metarduWhite : typeConfig?.color ?? Colors.gray600}
                  />
                  <Text style={[styles.blChipText, isActive && styles.blChipTextActive]}>
                    {bl.name} ({bl.pointCount})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {selected && (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
              {/* Selected breakline header */}
              <Card style={{ marginBottom: 12 }}>
                <View style={styles.selectedHeader}>
                  <View style={[styles.selectedIcon, { backgroundColor: `${BREAKLINE_TYPES.find(t => t.value === selected.type)?.color ?? Colors.gray500}20` }]}>
                    <MaterialCommunityIcons
                      name={BREAKLINE_TYPES.find(t => t.value === selected.type)?.icon as any ?? 'wave'}
                      size={22}
                      color={BREAKLINE_TYPES.find(t => t.value === selected.type)?.color ?? Colors.gray500}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedName}>{selected.name}</Text>
                    <Text style={styles.selectedType}>
                      {BREAKLINE_TYPES.find(t => t.value === selected.type)?.label}
                    </Text>
                  </View>
                </View>
                <View style={styles.statsRow}>
                  <Stat label="Points" value={String(selected.pointCount)} />
                  <Stat label="Length" value={`${selected.lengthM.toFixed(1)} m`} />
                  <Stat label="Segments" value={String(Math.max(0, selected.pointCount - 1))} />
                </View>
              </Card>

              {/* Validation feedback */}
              {validation && (
                <Card style={[
                  styles.validationCard,
                  { borderLeftColor: validation.isValid ? Colors.success : Colors.danger },
                ]}>
                  <View style={styles.validationHeader}>
                    <MaterialCommunityIcons
                      name={validation.isValid ? 'check-circle' : 'alert-circle'}
                      size={20}
                      color={validation.isValid ? Colors.success : Colors.danger}
                    />
                    <Text style={styles.validationTitle}>
                      {validation.isValid ? 'Valid breakline' : 'Validation issues'}
                    </Text>
                  </View>
                  {validation.errors.map((err, i) => (
                    <View key={`e${i}`} style={styles.validationRow}>
                      <MaterialCommunityIcons name="alert" size={14} color={Colors.danger} />
                      <Text style={[styles.validationText, { color: Colors.danger }]}>{err}</Text>
                    </View>
                  ))}
                  {validation.warnings.slice(0, 3).map((warn, i) => (
                    <View key={`w${i}`} style={styles.validationRow}>
                      <MaterialCommunityIcons name="alert-outline" size={14} color={Colors.warning} />
                      <Text style={[styles.validationText, { color: Colors.warning }]}>{warn}</Text>
                    </View>
                  ))}
                  {validation.warnings.length > 3 && (
                    <Text style={styles.validationMore}>
                      +{validation.warnings.length - 3} more warnings
                    </Text>
                  )}
                </Card>
              )}

              {/* Capture actions */}
              <View style={styles.captureRow}>
                <Button
                  title="Capture GPS Point"
                  onPress={captureGpsPoint}
                  loading={capturing}
                  style={{ flex: 1 }}
                  icon={<MaterialCommunityIcons name="crosshairs-gps" size={18} color={Colors.metarduWhite} />}
                />
                <ManualPointButton onAdd={addManualPoint} />
              </View>

              {/* Points list */}
              <Text style={styles.sectionTitle}>Vertices ({selected.points.length})</Text>
              {selected.points.length === 0 ? (
                <Card variant="outline" style={{ alignItems: 'center', padding: 20 }}>
                  <MaterialCommunityIcons name="map-marker-plus" size={32} color={Colors.gray400} />
                  <Text style={styles.emptyTitle}>No vertices yet</Text>
                  <Text style={styles.emptySub}>
                    Walk along the feature and tap "Capture GPS Point" at each vertex.
                  </Text>
                </Card>
              ) : (
                <View style={{ gap: 6 }}>
                  {selected.points.map((p, i) => (
                    <VertexRow
                      key={p.id}
                      seq={i}
                      pointNumber={p.pointNumber}
                      easting={p.easting}
                      northing={p.northing}
                      elevation={p.elevation}
                      isLast={i === selected.points.length - 1}
                      onDelete={async () => {
                        Alert.alert(
                          'Remove vertex?',
                          `Remove vertex ${p.pointNumber}?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Remove',
                              style: 'destructive',
                              onPress: async () => {
                                await removeBreaklinePoint(selected.id, p.seq);
                                await load();
                              },
                            },
                          ]
                        );
                      }}
                    />
                  ))}
                </View>
              )}

              {/* Delete breakline */}
              <Button
                title="Delete Breakline"
                variant="danger"
                size="sm"
                onPress={() => {
                  Alert.alert(
                    'Delete breakline?',
                    `Delete "${selected.name}" and all its vertices?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                          await deleteBreakline(selected.id);
                          setSelected(null);
                          await load();
                        },
                      },
                    ]
                  );
                }}
                style={{ marginTop: 16 }}
              />
            </ScrollView>
          )}
        </View>
      )}

      <NewBreaklineModal
        visible={showNew}
        onClose={() => setShowNew(false)}
        onCreate={async (name, type, layer, notes) => {
          const bl = await createBreakline({ projectId, name, type, layer, notes });
          await load();
          setSelected(await getBreakline(bl.id));
          setShowNew(false);
        }}
      />
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function VertexRow({
  seq,
  pointNumber,
  easting,
  northing,
  elevation,
  isLast,
  onDelete,
}: {
  seq: number;
  pointNumber: string;
  easting?: number;
  northing?: number;
  elevation?: number;
  isLast: boolean;
  onDelete: () => void;
}) {
  return (
    <Card style={{ padding: 10 }}>
      <View style={styles.vertexRow}>
        <View style={styles.vertexSeq}>
          <Text style={styles.vertexSeqText}>{seq + 1}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.vertexPoint}>{pointNumber}</Text>
          {easting != null && northing != null && (
            <Text style={styles.vertexCoords}>
              E: {easting.toFixed(3)}    N: {northing.toFixed(3)}
              {elevation != null && `    Elev: ${elevation.toFixed(2)}`}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={onDelete} style={{ padding: 4 }}>
          <MaterialCommunityIcons name="delete-outline" size={18} color={Colors.danger} />
        </TouchableOpacity>
      </View>
    </Card>
  );
}

function ManualPointButton({
  onAdd,
}: {
  onAdd: (pointNumber: string, easting: number, northing: number, elevation: number) => Promise<void>;
}) {
  const [showModal, setShowModal] = useState(false);
  const [pointNumber, setPointNumber] = useState('');
  const [easting, setEasting] = useState('');
  const [northing, setNorthing] = useState('');
  const [elevation, setElevation] = useState('');

  return (
    <>
      <Button
        title="Manual"
        variant="outline"
        onPress={() => setShowModal(true)}
        style={{ flex: 1 }}
        icon={<MaterialCommunityIcons name="pencil" size={18} color={Colors.metarduNavy} />}
      />
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add Vertex Manually</Text>
            <TextInput
              label="Point Number"
              value={pointNumber}
              onChangeText={setPointNumber}
              placeholder="e.g. BL-5"
              required
            />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <TextInput
                  label="Easting"
                  value={easting}
                  onChangeText={setEasting}
                  placeholder="254500.000"
                  keyboardType="decimal-pad"
                  required
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextInput
                  label="Northing"
                  value={northing}
                  onChangeText={setNorthing}
                  placeholder="9857200.000"
                  keyboardType="decimal-pad"
                  required
                />
              </View>
            </View>
            <TextInput
              label="Elevation (m)"
              value={elevation}
              onChangeText={setElevation}
              placeholder="1795.500"
              keyboardType="decimal-pad"
            />
            <View style={styles.modalActions}>
              <Button title="Cancel" variant="ghost" onPress={() => setShowModal(false)} style={{ flex: 1 }} />
              <Button
                title="Add"
                onPress={async () => {
                  if (!pointNumber.trim() || !easting || !northing) {
                    Alert.alert('Required', 'Point number, easting, and northing are required.');
                    return;
                  }
                  const e = parseFloat(easting);
                  const n = parseFloat(northing);
                  const el = parseFloat(elevation) || 0;
                  if (isNaN(e) || isNaN(n)) {
                    Alert.alert('Invalid', 'Easting and northing must be numbers.');
                    return;
                  }
                  await onAdd(pointNumber.trim(), e, n, el);
                  setShowModal(false);
                  setPointNumber('');
                  setEasting('');
                  setNorthing('');
                  setElevation('');
                }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function NewBreaklineModal({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, type: BreaklineType, layer: string | undefined, notes: string | undefined) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<BreaklineType>('soft');
  const [layer, setLayer] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <ScrollView style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>New Breakline</Text>

          <TextInput
            label="Breakline Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Main Ridge Line"
            required
          />

          <Text style={styles.modalLabel}>Type</Text>
          <View style={{ gap: 8 }}>
            {BREAKLINE_TYPES.map(t => (
              <TouchableOpacity
                key={t.value}
                onPress={() => setType(t.value)}
                style={[
                  styles.typeCard,
                  type === t.value && { borderColor: t.color, backgroundColor: `${t.color}10` },
                ]}
              >
                <View style={[styles.typeIcon, { backgroundColor: `${t.color}20` }]}>
                  <MaterialCommunityIcons name={t.icon as any} size={20} color={t.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.typeLabel}>{t.label}</Text>
                  <Text style={styles.typeDesc}>{t.description}</Text>
                </View>
                {type === t.value && (
                  <MaterialCommunityIcons name="check-circle" size={20} color={t.color} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            label="Layer (optional)"
            value={layer}
            onChangeText={setLayer}
            placeholder="e.g. ridge, road-edge, water"
          />
          <TextInput
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Captured from south to north"
            multiline
          />

          <View style={styles.modalActions}>
            <Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
            <Button
              title="Create"
              onPress={() => {
                if (!name.trim()) {
                  Alert.alert('Required', 'Name is required.');
                  return;
                }
                onCreate(name.trim(), type, layer.trim() || undefined, notes.trim() || undefined);
                setName('');
                setType('soft');
                setLayer('');
                setNotes('');
              }}
              style={{ flex: 1 }}
            />
          </View>
        </ScrollView>
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
  selector: {
    maxHeight: 44,
    paddingVertical: 6,
    backgroundColor: Colors.metarduWhite,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  blChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.gray100,
  },
  blChipText: {
    fontSize: 12,
    color: Colors.gray600,
    fontWeight: '500',
  },
  blChipTextActive: {
    color: Colors.metarduWhite,
    fontWeight: '600',
  },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  selectedIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.metarduNavy,
  },
  selectedType: {
    fontSize: 12,
    color: Colors.gray500,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.gray200,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.metarduNavy,
    fontFamily: 'JetBrainsMono',
  },
  statLabel: {
    fontSize: 10,
    color: Colors.gray500,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  validationCard: {
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  validationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  validationTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.metarduNavy,
  },
  validationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 4,
  },
  validationText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  validationMore: {
    fontSize: 11,
    color: Colors.gray400,
    fontStyle: 'italic',
    marginTop: 4,
  },
  captureRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.metarduNavy,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.metarduNavy,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.gray500,
    textAlign: 'center',
    marginTop: 4,
  },
  vertexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  vertexSeq: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.metarduNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vertexSeqText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.metarduWhite,
  },
  vertexPoint: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.metarduNavy,
    fontFamily: 'JetBrainsMono',
  },
  vertexCoords: {
    fontSize: 11,
    color: Colors.gray500,
    fontFamily: 'JetBrainsMono',
    marginTop: 2,
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
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.gray200,
    backgroundColor: Colors.metarduWhite,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.metarduNavy,
  },
  typeDesc: {
    fontSize: 11,
    color: Colors.gray500,
    marginTop: 2,
    lineHeight: 15,
  },
});
