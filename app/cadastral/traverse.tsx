/**
 * Cadastral Traverse Entry — multi-leg traverse with live Bowditch adjustment.
 *
 * Surveyors enter traverse legs (from→to, bearing, distance) and see:
 *  - Live Bowditch adjustment
 *  - Precision ratio (1:N)
 *  - Linear misclosure
 *  - Adjusted coordinates
 *  - Pass/fail against Kenya 3rd order (1:5000)
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Colors } from '@/theme';
import { Card } from '@/components/Card';
import { TextInput } from '@/components/TextInput';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { useProjectStore } from '@/stores/projectStore';
import { getProject } from '@/lib/db/queries';
import {
  createTraverse,
  getTraverses,
  addTraverseLeg,
  deleteTraverseLeg,
  deleteTraverse,
  computePreview,
  type TraverseWithLegs,
} from '@/lib/db/traverses';
import type { TraverseLeg } from '@engine/traverse';
import type { TraverseAdjustmentResult } from '@engine/traverse';
import type { Project } from '@/types';

export default function TraverseScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();

  const [project, setProject] = useState<Project | null>(null);
  const [traverses, setTraverses] = useState<TraverseWithLegs[]>([]);
  const [selectedTraverse, setSelectedTraverse] = useState<TraverseWithLegs | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    const p = await getProject(projectId);
    setProject(p);
    const travs = await getTraverses(projectId);
    // Load legs for each traverse
    const full: TraverseWithLegs[] = [];
    for (const trav of travs) {
      const fullTrav = await import('@/lib/db/traverses').then(m => m.getTraverse(trav.id));
      if (fullTrav) full.push(fullTrav);
    }
    setTraverses(full);
    if (full.length > 0 && !selectedTraverse) setSelectedTraverse(full[0]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [projectId]);

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
          <Text style={styles.title}>Cadastral Traverse</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{project.name}</Text>
        </View>
        <Button title="+ New" size="sm" onPress={() => setShowNewModal(true)} />
      </View>

      {traverses.length === 0 ? (
        <EmptyState
          icon="shape-polygon-plus"
          title="No traverses yet"
          subtitle="Create a traverse to start entering bearings and distances."
          action={<Button title="Create Traverse" onPress={() => setShowNewModal(true)} />}
        />
      ) : (
        <TraverseEditor
          traverse={selectedTraverse ?? traverses[0]}
          allTraverses={traverses}
          onSelect={setSelectedTraverse}
          onRefresh={load}
          projectId={projectId}
        />
      )}

      <NewTraverseModal
        visible={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreate={async (name, startPoint, startE, startN, closePoint, closeE, closeN) => {
          const trav = await createTraverse({
            projectId,
            name,
            surveyType: 'cadastral',
            startPointNumber: startPoint,
            closingPointNumber: closePoint,
            startEasting: startE,
            startNorthing: startN,
            closeEasting: closeE,
            closeNorthing: closeN,
          });
          await load();
          const fresh = await import('@/lib/db/traverses').then(m => m.getTraverse(trav.id));
          if (fresh) setSelectedTraverse(fresh);
          setShowNewModal(false);
        }}
      />
    </SafeAreaView>
  );
}

// ============================================================================
// Traverse Editor — main UI with legs, live adjustment, and add-leg form
// ============================================================================
function TraverseEditor({
  traverse,
  allTraverses,
  onSelect,
  onRefresh,
  projectId,
}: {
  traverse: TraverseWithLegs;
  allTraverses: TraverseWithLegs[];
  onSelect: (t: TraverseWithLegs) => void;
  onRefresh: () => Promise<void>;
  projectId: string;
}) {
  const [showAddLeg, setShowAddLeg] = useState(false);
  const [preview, setPreview] = useState<TraverseAdjustmentResult | null>(null);

  useEffect(() => {
    if (traverse.legs.length > 0 && traverse.startEasting !== undefined) {
      const result = computePreview(
        traverse.legs,
        traverse.startEasting,
        traverse.startNorthing!,
        traverse.closeEasting,
        traverse.closeNorthing
      );
      setPreview(result);
    } else {
      setPreview(null);
    }
  }, [traverse]);

  const handleAddLeg = async (leg: TraverseLeg) => {
    await addTraverseLeg(traverse.id, traverse.legs.length, leg);
    await onRefresh();
    setShowAddLeg(false);
  };

  const handleDeleteLeg = async (seq: number) => {
    Alert.alert(
      'Delete leg?',
      `Remove leg #${seq + 1}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteTraverseLeg(traverse.id, seq);
            await onRefresh();
          },
        },
      ]
    );
  };

  const handleDeleteTraverse = () => {
    Alert.alert(
      'Delete traverse?',
      `Delete "${traverse.name}" and all its legs?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteTraverse(traverse.id);
            await onRefresh();
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Traverse selector (if multiple) */}
      {allTraverses.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.travSelector} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {allTraverses.map((t) => (
            <TouchableOpacity
              key={t.id}
              onPress={() => onSelect(t)}
              style={[styles.travChip, t.id === traverse.id && styles.travChipActive]}
            >
              <Text style={[styles.travChipText, t.id === traverse.id && styles.travChipTextActive]}>
                {t.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Setup card */}
        <Card style={{ marginBottom: 12 }}>
          <View style={styles.setupHeader}>
            <MaterialCommunityIcons name="crosshairs-gps" size={18} color={Colors.metarduNavy} />
            <Text style={styles.setupTitle}>{traverse.name}</Text>
          </View>
          <View style={styles.setupRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.setupLabel}>Start Point</Text>
              <Text style={styles.setupValue}>{traverse.startPointNumber}</Text>
              {traverse.startEasting !== undefined && (
                <Text style={styles.setupCoords}>
                  E: {traverse.startEasting.toFixed(3)}{'\n'}N: {traverse.startNorthing!.toFixed(3)}
                </Text>
              )}
            </View>
            {traverse.closingPointNumber && (
              <View style={{ flex: 1 }}>
                <Text style={styles.setupLabel}>Closing Point</Text>
                <Text style={styles.setupValue}>{traverse.closingPointNumber}</Text>
                {traverse.closeEasting !== undefined && (
                  <Text style={styles.setupCoords}>
                    E: {traverse.closeEasting.toFixed(3)}{'\n'}N: {traverse.closeNorthing!.toFixed(3)}
                  </Text>
                )}
              </View>
            )}
          </View>
        </Card>

        {/* Live adjustment preview */}
        {preview && (
          <AdjustmentPreviewCard result={preview} status={traverse.status} />
        )}

        {/* Legs list */}
        <View style={styles.legsHeader}>
          <Text style={styles.legsTitle}>Legs ({traverse.legs.length})</Text>
          <TouchableOpacity onPress={() => setShowAddLeg(true)}>
            <View style={styles.addLegBtn}>
              <MaterialCommunityIcons name="plus" size={18} color={Colors.metarduWhite} />
              <Text style={styles.addLegBtnText}>Add Leg</Text>
            </View>
          </TouchableOpacity>
        </View>

        {traverse.legs.length === 0 ? (
          <Card variant="outline" style={{ alignItems: 'center', padding: 24 }}>
            <MaterialCommunityIcons name="vector-line" size={36} color={Colors.gray400} />
            <Text style={styles.emptyLegsTitle}>No legs yet</Text>
            <Text style={styles.emptyLegsSub}>Tap "Add Leg" to enter your first bearing and distance.</Text>
          </Card>
        ) : (
          <View style={{ gap: 8 }}>
            {traverse.legs.map((leg, i) => (
              <LegCard
                key={i}
                seq={i}
                leg={leg}
                onDelete={() => handleDeleteLeg(i)}
              />
            ))}
          </View>
        )}

        {/* Adjusted coordinates table */}
        {preview && Object.keys(preview.adjustedCoordinates).length > 0 && (
          <Card style={{ marginTop: 16 }}>
            <Text style={styles.coordsTitle}>Adjusted Coordinates</Text>
            {Object.entries(preview.adjustedCoordinates).map(([pt, c]) => (
              <View key={pt} style={styles.coordRow}>
                <Text style={styles.coordPoint}>{pt}</Text>
                <Text style={styles.coordValue}>E: {c.easting.toFixed(3)}</Text>
                <Text style={styles.coordValue}>N: {c.northing.toFixed(3)}</Text>
              </View>
            ))}
          </Card>
        )}

        <Button
          title="Delete Traverse"
          variant="danger"
          size="sm"
          onPress={handleDeleteTraverse}
          style={{ marginTop: 16 }}
        />
      </ScrollView>

      <AddLegModal
        visible={showAddLeg}
        onClose={() => setShowAddLeg(false)}
        onAdd={handleAddLeg}
        defaultFromPoint={traverse.legs.length > 0 ? traverse.legs[traverse.legs.length - 1].toPoint : traverse.startPointNumber}
      />
    </View>
  );
}

// ============================================================================
// Adjustment Preview Card
// ============================================================================
function AdjustmentPreviewCard({
  result,
  status,
}: {
  result: TraverseAdjustmentResult;
  status: string;
}) {
  const passes = result.precisionPasses;
  return (
    <Card style={[styles.previewCard, { borderLeftColor: passes ? Colors.success : Colors.danger }]}>
      <View style={styles.previewHeader}>
        <MaterialCommunityIcons
          name={passes ? 'check-circle' : 'alert-circle'}
          size={20}
          color={passes ? Colors.success : Colors.danger}
        />
        <Text style={styles.previewTitle}>Bowditch Adjustment</Text>
        <View style={[styles.previewBadge, { backgroundColor: passes ? Colors.success : Colors.danger }]}>
          <Text style={styles.previewBadgeText}>{passes ? 'PASS' : 'FAIL'}</Text>
        </View>
      </View>
      <View style={styles.previewStatsRow}>
        <PreviewStat label="Perimeter" value={`${result.perimeter.toFixed(2)} m`} />
        <PreviewStat label="Misclosure" value={`${result.linearMisclosure.toFixed(4)} m`} />
        <PreviewStat
          label="Precision"
          value={result.precisionRatio}
          highlight={passes ? Colors.success : Colors.danger}
        />
      </View>
      <Text style={styles.previewNote}>
        Kenya 3rd order minimum: 1:5000 · Survey Regulations 1994
      </Text>
    </Card>
  );
}

function PreviewStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: string;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.previewStatLabel}>{label}</Text>
      <Text style={[styles.previewStatValue, highlight ? { color: highlight } : null]}>
        {value}
      </Text>
    </View>
  );
}

// ============================================================================
// Leg Card
// ============================================================================
function LegCard({
  seq,
  leg,
  onDelete,
}: {
  seq: number;
  leg: TraverseLeg;
  onDelete: () => void;
}) {
  return (
    <Card style={{ padding: 12 }}>
      <View style={styles.legRow}>
        <View style={styles.legSeq}>
          <Text style={styles.legSeqText}>{seq + 1}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.legRoute}>
            {leg.fromPoint} → {leg.toPoint}
          </Text>
          <View style={styles.legMetaRow}>
            <Text style={styles.legMeta}>Brg: {leg.bearing.toFixed(4)}°</Text>
            <Text style={styles.legMeta}>Dist: {leg.distance.toFixed(3)} m</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onDelete} style={styles.legDelete}>
          <MaterialCommunityIcons name="delete-outline" size={20} color={Colors.danger} />
        </TouchableOpacity>
      </View>
    </Card>
  );
}

// ============================================================================
// Add Leg Modal
// ============================================================================
function AddLegModal({
  visible,
  onClose,
  onAdd,
  defaultFromPoint,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (leg: TraverseLeg) => void;
  defaultFromPoint: string;
}) {
  const [fromPoint, setFromPoint] = useState(defaultFromPoint);
  const [toPoint, setToPoint] = useState('');
  const [bearing, setBearing] = useState('');
  const [distance, setDistance] = useState('');

  useEffect(() => {
    if (visible) {
      setFromPoint(defaultFromPoint);
      setToPoint('');
      setBearing('');
      setDistance('');
    }
  }, [visible, defaultFromPoint]);

  const handleAdd = () => {
    if (!fromPoint.trim() || !toPoint.trim()) {
      Alert.alert('Required', 'From and To point numbers are required.');
      return;
    }
    const brg = parseFloat(bearing);
    const dist = parseFloat(distance);
    if (isNaN(brg) || brg < 0 || brg >= 360) {
      Alert.alert('Invalid bearing', 'Bearing must be between 0 and 360 degrees.');
      return;
    }
    if (isNaN(dist) || dist <= 0) {
      Alert.alert('Invalid distance', 'Distance must be a positive number.');
      return;
    }
    onAdd({
      fromPoint: fromPoint.trim(),
      toPoint: toPoint.trim(),
      bearing: brg,
      distance: dist,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add Traverse Leg</Text>

            <View style={styles.modalRow}>
              <View style={{ flex: 1 }}>
                <TextInput
                  label="From Point"
                  value={fromPoint}
                  onChangeText={setFromPoint}
                  placeholder="STN-001"
                  required
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextInput
                  label="To Point"
                  value={toPoint}
                  onChangeText={setToPoint}
                  placeholder="STN-002"
                  required
                />
              </View>
            </View>

            <View style={styles.modalRow}>
              <View style={{ flex: 1 }}>
                <TextInput
                  label="Bearing (°)"
                  value={bearing}
                  onChangeText={setBearing}
                  placeholder="e.g. 145.3214"
                  keyboardType="decimal-pad"
                  required
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextInput
                  label="Distance (m)"
                  value={distance}
                  onChangeText={setDistance}
                  placeholder="e.g. 45.327"
                  keyboardType="decimal-pad"
                  required
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
              <Button title="Add Leg" onPress={handleAdd} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ============================================================================
// New Traverse Modal
// ============================================================================
function NewTraverseModal({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (
    name: string,
    startPoint: string,
    startE: number,
    startN: number,
    closePoint: string | undefined,
    closeE: number | undefined,
    closeN: number | undefined
  ) => void;
}) {
  const [name, setName] = useState('');
  const [startPoint, setStartPoint] = useState('');
  const [startE, setStartE] = useState('');
  const [startN, setStartN] = useState('');
  const [isClosed, setIsClosed] = useState(true);
  const [closePoint, setClosePoint] = useState('');
  const [closeE, setCloseE] = useState('');
  const [closeN, setCloseN] = useState('');

  useEffect(() => {
    if (visible) {
      setName('');
      setStartPoint('');
      setStartE('');
      setStartN('');
      setIsClosed(true);
      setClosePoint('');
      setCloseE('');
      setCloseN('');
    }
  }, [visible]);

  const handleCreate = () => {
    if (!name.trim() || !startPoint.trim() || !startE || !startN) {
      Alert.alert('Required', 'Name, start point, and start coordinates are required.');
      return;
    }
    const sE = parseFloat(startE);
    const sN = parseFloat(startN);
    if (isNaN(sE) || isNaN(sN)) {
      Alert.alert('Invalid', 'Start coordinates must be numbers.');
      return;
    }
    let cP: string | undefined;
    let cE: number | undefined;
    let cN: number | undefined;
    if (isClosed) {
      if (!closePoint.trim() || !closeE || !closeN) {
        Alert.alert('Required', 'Closing point and coordinates required for closed traverse.');
        return;
      }
      cP = closePoint.trim();
      cE = parseFloat(closeE);
      cN = parseFloat(closeN);
      if (isNaN(cE) || isNaN(cN)) {
        Alert.alert('Invalid', 'Closing coordinates must be numbers.');
        return;
      }
    }
    onCreate(name.trim(), startPoint.trim(), sE, sN, cP, cE, cN);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalSheet} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>New Traverse</Text>

            <TextInput
              label="Traverse Name"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Main Boundary Traverse"
              required
            />

            <Text style={styles.modalSectionTitle}>Start Station</Text>
            <TextInput
              label="Start Point Number"
              value={startPoint}
              onChangeText={setStartPoint}
              placeholder="e.g. STN-001"
              required
            />
            <View style={styles.modalRow}>
              <View style={{ flex: 1 }}>
                <TextInput
                  label="Start Easting"
                  value={startE}
                  onChangeText={setStartE}
                  placeholder="e.g. 254500.123"
                  keyboardType="decimal-pad"
                  required
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextInput
                  label="Start Northing"
                  value={startN}
                  onChangeText={setStartN}
                  placeholder="e.g. 9857200.456"
                  keyboardType="decimal-pad"
                  required
                />
              </View>
            </View>

            <Text style={styles.modalSectionTitle}>Traverse Type</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                onPress={() => setIsClosed(true)}
                style={[styles.typeBtn, isClosed && styles.typeBtnActive]}
              >
                <MaterialCommunityIcons
                  name="loop"
                  size={18}
                  color={isClosed ? Colors.metarduWhite : Colors.metarduNavy}
                />
                <Text style={[styles.typeBtnText, isClosed && styles.typeBtnTextActive]}>
                  Closed (link to known point)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsClosed(false)}
                style={[styles.typeBtn, !isClosed && styles.typeBtnActive]}
              >
                <MaterialCommunityIcons
                  name="ray-end-arrow"
                  size={18}
                  color={!isClosed ? Colors.metarduWhite : Colors.metarduNavy}
                />
                <Text style={[styles.typeBtnText, !isClosed && styles.typeBtnTextActive]}>
                  Open (no closure check)
                </Text>
              </TouchableOpacity>
            </View>

            {isClosed && (
              <>
                <Text style={styles.modalSectionTitle}>Closing Station</Text>
                <TextInput
                  label="Closing Point Number"
                  value={closePoint}
                  onChangeText={setClosePoint}
                  placeholder="e.g. STN-005"
                  required
                />
                <View style={styles.modalRow}>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      label="Close Easting"
                      value={closeE}
                      onChangeText={setCloseE}
                      placeholder="e.g. 254600.789"
                      keyboardType="decimal-pad"
                      required
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      label="Close Northing"
                      value={closeN}
                      onChangeText={setCloseN}
                      placeholder="e.g. 9857300.123"
                      keyboardType="decimal-pad"
                      required
                    />
                  </View>
                </View>
              </>
            )}

            <View style={styles.modalActions}>
              <Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
              <Button title="Create" onPress={handleCreate} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
  travSelector: {
    maxHeight: 44,
    paddingVertical: 6,
    backgroundColor: Colors.metarduWhite,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  travChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.gray100,
  },
  travChipActive: {
    backgroundColor: Colors.metarduNavy,
  },
  travChipText: {
    fontSize: 13,
    color: Colors.gray600,
    fontWeight: '500',
  },
  travChipTextActive: {
    color: Colors.metarduWhite,
    fontWeight: '600',
  },
  setupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  setupTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.metarduNavy,
    flex: 1,
  },
  setupRow: {
    flexDirection: 'row',
    gap: 16,
  },
  setupLabel: {
    fontSize: 11,
    color: Colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  setupValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.metarduNavy,
    marginTop: 2,
  },
  setupCoords: {
    fontSize: 11,
    color: Colors.gray600,
    marginTop: 2,
    fontFamily: 'JetBrainsMono',
    lineHeight: 16,
  },
  previewCard: {
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  previewTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.metarduNavy,
  },
  previewBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  previewBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.metarduWhite,
  },
  previewStatsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  previewStatLabel: {
    fontSize: 10,
    color: Colors.gray500,
    textTransform: 'uppercase',
  },
  previewStatValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.metarduNavy,
    fontFamily: 'JetBrainsMono',
    marginTop: 2,
  },
  previewNote: {
    fontSize: 10,
    color: Colors.gray400,
    marginTop: 8,
    fontStyle: 'italic',
  },
  legsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  legsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.metarduNavy,
  },
  addLegBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.metarduOrange,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addLegBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.metarduWhite,
  },
  emptyLegsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.metarduNavy,
    marginTop: 8,
  },
  emptyLegsSub: {
    fontSize: 12,
    color: Colors.gray500,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 16,
  },
  legRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legSeq: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.metarduNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legSeqText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.metarduWhite,
  },
  legRoute: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.metarduNavy,
    fontFamily: 'JetBrainsMono',
  },
  legMetaRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 2,
  },
  legMeta: {
    fontSize: 11,
    color: Colors.gray500,
    fontFamily: 'JetBrainsMono',
  },
  legDelete: {
    padding: 4,
  },
  coordsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.metarduNavy,
    marginBottom: 8,
  },
  coordRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.gray200,
  },
  coordPoint: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.metarduOrange,
    fontFamily: 'JetBrainsMono',
  },
  coordValue: {
    flex: 1.5,
    fontSize: 12,
    color: Colors.metarduNavy,
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
  modalSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  modalRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  typeRow: {
    gap: 8,
  },
  typeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.gray200,
    backgroundColor: Colors.metarduWhite,
  },
  typeBtnActive: {
    borderColor: Colors.metarduNavy,
    backgroundColor: Colors.metarduNavy,
  },
  typeBtnText: {
    fontSize: 13,
    color: Colors.metarduNavy,
    fontWeight: '500',
    flex: 1,
  },
  typeBtnTextActive: {
    color: Colors.metarduWhite,
    fontWeight: '600',
  },
});
