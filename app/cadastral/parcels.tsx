/**
 * Parcel Definition — define parcel boundary, attach points, view area/perimeter.
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

import { Card } from '@/components/Card';
import { TextInput } from '@/components/TextInput';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { getProject } from '@/lib/db/queries';
import {
  createParcel,
  getParcels,
  getParcel,
  addParcelPoint,
  removeParcelPoint,
  deleteParcel,
} from '@/lib/db/parcels';
import { getTraverses, getTraverse } from '@/lib/db/traverses';
import type { Parcel, Project, ParcelPoint } from '@/types';
import type { TraverseWithLegs } from '@/lib/db/traverses';

export default function ParcelsScreen() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();

  const [project, setProject] = useState<Project | null>(null);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [traverses, setTraverses] = useState<TraverseWithLegs[]>([]);
  const [selected, setSelected] = useState<Parcel | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showAddPoint, setShowAddPoint] = useState(false);

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    const p = await getProject(projectId);
    setProject(p);
    const pars = await getParcels(projectId);
    setParcels(pars);
    // Load traverses for the link dropdown
    const travs = await getTraverses(projectId);
    const full: TraverseWithLegs[] = [];
    for (const t of travs) {
      const f = await getTraverse(t.id);
      if (f) full.push(f);
    }
    setTraverses(full);
    if (pars.length > 0 && !selected) {
      const fresh = await getParcel(pars[0].id);
      setSelected(fresh);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const refreshSelected = async () => {
    if (selected) {
      const fresh = await getParcel(selected.id);
      setSelected(fresh);
    }
    await load();
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
          <Text style={styles.title}>Parcels</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{project.name}</Text>
        </View>
        <Button title="+ New" size="sm" onPress={() => setShowNew(true)} />
      </View>

      {parcels.length === 0 ? (
        <EmptyState
          icon="vector-square"
          title="No parcels defined"
          subtitle="Create a parcel to define its boundary and compute area."
          action={<Button title="Create Parcel" onPress={() => setShowNew(true)} />}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
          {/* Parcel selector */}
          {parcels.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {parcels.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={async () => setSelected(await getParcel(p.id))}
                    style={[styles.chip, selected?.id === p.id && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, selected?.id === p.id && styles.chipTextActive]}>
                      {p.parcelNumber}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          {selected && (
            <>
              {/* Parcel details card */}
              <Card style={{ marginBottom: 16 }}>
                <View style={styles.parcelHeader}>
                  <View style={styles.parcelIcon}>
                    <MaterialCommunityIcons name="vector-square" size={22} color={'#F97316'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.parcelNumber}>{selected.parcelNumber}</Text>
                    {selected.lrNumber && (
                      <Text style={styles.parcelLr}>LR {selected.lrNumber}</Text>
                    )}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: #F9731620 }]}>
                    <Text style={[styles.statusText, { color: '#F97316' }]}>
                      {selected.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
                {selected.registry && (
                  <Text style={styles.parcelMeta}>Registry: {selected.registry}</Text>
                )}
                {selected.traverseId && (
                  <Text style={styles.parcelMeta}>
                    Linked traverse: {traverses.find(t => t.id === selected.traverseId)?.name ?? '—'}
                  </Text>
                )}
              </Card>

              {/* Area & perimeter stats */}
              <View style={styles.statsRow}>
                <StatCard
                  icon="vector-square"
                  label="Area"
                  value={selected.areaSqm > 0 ? `${selected.areaSqm.toFixed(2)} m²` : '—'}
                  subValue={selected.areaSqm > 0 ? `${(selected.areaSqm / 10000).toFixed(4)} ha` : ''}
                  color={'#F97316'}
                />
                <StatCard
                  icon="ruler"
                  label="Perimeter"
                  value={selected.perimeterM > 0 ? `${selected.perimeterM.toFixed(2)} m` : '—'}
                  color={'#3B82F6'}
                />
                <StatCard
                  icon="map-marker-multiple"
                  label="Points"
                  value={String(selected.points.length)}
                  color={'#10B981'}
                />
              </View>

              {/* Points list */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Boundary Points ({selected.points.length})</Text>
                <TouchableOpacity onPress={() => setShowAddPoint(true)}>
                  <View style={styles.addBtn}>
                    <MaterialCommunityIcons name="plus" size={16} color={'#FFFFFF'} />
                    <Text style={styles.addBtnText}>Add Point</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {selected.points.length === 0 ? (
                <Card variant="outline" style={{ alignItems: 'center', padding: 20 }}>
                  <Text style={styles.emptyTitle}>No boundary points</Text>
                  <Text style={styles.emptySub}>
                    Add points from your traverse to define the parcel boundary.
                  </Text>
                </Card>
              ) : (
                <View style={{ gap: 8 }}>
                  {selected.points.map((pt, i) => (
                    <ParcelPointRow
                      key={i}
                      seq={i}
                      point={pt}
                      onDelete={async () => {
                        Alert.alert(
                          'Remove point?',
                          `Remove point ${pt.pointNumber} from this parcel?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Remove',
                              style: 'destructive',
                              onPress: async () => {
                                await removeParcelPoint(selected.id, pt.seq);
                                await refreshSelected();
                              },
                            },
                          ]
                        );
                      }}
                    />
                  ))}
                </View>
              )}

              {selected.points.length < 3 && (
                <Text style={styles.hint}>
                  Add at least 3 boundary points to compute area and perimeter.
                </Text>
              )}

              <Button
                title="Delete Parcel"
                variant="danger"
                size="sm"
                onPress={() => {
                  Alert.alert(
                    'Delete parcel?',
                    `Delete parcel ${selected.parcelNumber}?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                          await deleteParcel(selected.id);
                          setSelected(null);
                          await load();
                        },
                      },
                    ]
                  );
                }}
                style={{ marginTop: 16 }}
              />
            </>
          )}
        </ScrollView>
      )}

      <NewParcelModal
        visible={showNew}
        traverses={traverses}
        onClose={() => setShowNew(false)}
        onCreate={async (parcelNumber, lrNumber, registry, traverseId) => {
          const parcel = await createParcel({
            projectId,
            parcelNumber,
            lrNumber,
            registry,
            traverseId,
          });
          await load();
          setSelected(await getParcel(parcel.id));
          setShowNew(false);
        }}
      />

      {selected && (
        <AddPointModal
          visible={showAddPoint}
          onClose={() => setShowAddPoint(false)}
          onAdd={async (pointNumber, isBeacon, beaconType, condition) => {
            await addParcelPoint(
              selected.id,
              selected.points.length,
              pointNumber,
              isBeacon,
              beaconType,
              condition
            );
            await refreshSelected();
            setShowAddPoint(false);
          }}
          availablePoints={selected.traverseId
            ? (() => {
                const trav = traverses.find(t => t.id === selected.traverseId);
                if (!trav) return [];
                const pts = new Set<string>();
                trav.legs.forEach(l => { pts.add(l.fromPoint); pts.add(l.toPoint); });
                return Array.from(pts);
              })()
            : []
          }
        />
      )}
    </SafeAreaView>
  );
}

function ParcelPointRow({
  seq,
  point,
  onDelete,
}: {
  seq: number;
  point: ParcelPoint;
  onDelete: () => void;
}) {
  return (
    <Card style={{ padding: 12 }}>
      <View style={styles.pointRow}>
        <View style={styles.seqBadge}>
          <Text style={styles.seqText}>{seq + 1}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.pointNumber}>{point.pointNumber}</Text>
          <View style={styles.pointMetaRow}>
            {point.isBeacon && (
              <View style={[styles.badge, { backgroundColor: #F9731620 }]}>
                <MaterialCommunityIcons name="map-marker" size={11} color={'#F97316'} />
                <Text style={[styles.badgeText, { color: '#F97316' }]}>
                  {point.beaconType ?? 'beacon'}
                </Text>
              </View>
            )}
            {point.condition && point.condition !== 'good' && (
              <View style={[styles.badge, { backgroundColor: #F59E0B20 }]}>
                <Text style={[styles.badgeText, { color: '#F59E0B' }]}>
                  {point.condition}
                </Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity onPress={onDelete} style={{ padding: 4 }}>
          <MaterialCommunityIcons name="delete-outline" size={20} color={'#EF4444'} />
        </TouchableOpacity>
      </View>
    </Card>
  );
}

function StatCard({
  icon,
  label,
  value,
  subValue,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  subValue?: string;
  color: string;
}) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <MaterialCommunityIcons name={icon as any} size={18} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      {subValue ? <Text style={styles.statSubValue}>{subValue}</Text> : null}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function NewParcelModal({
  visible,
  traverses,
  onClose,
  onCreate,
}: {
  visible: boolean;
  traverses: TraverseWithLegs[];
  onClose: () => void;
  onCreate: (parcelNumber: string, lrNumber?: string, registry?: string, traverseId?: string) => void;
}) {
  const [parcelNumber, setParcelNumber] = useState('');
  const [lrNumber, setLrNumber] = useState('');
  const [registry, setRegistry] = useState('');
  const [traverseId, setTraverseId] = useState<string | undefined>(undefined);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>New Parcel</Text>

          <TextInput
            label="Parcel Number"
            value={parcelNumber}
            onChangeText={setParcelNumber}
            placeholder="e.g. LR 12345/6"
            required
          />
          <TextInput
            label="LR Number (optional)"
            value={lrNumber}
            onChangeText={setLrNumber}
            placeholder="e.g. 2090/12345"
          />
          <TextInput
            label="Registry (optional)"
            value={registry}
            onChangeText={setRegistry}
            placeholder="e.g. Nairobi"
          />

          {traverses.length > 0 && (
            <>
              <Text style={styles.modalLabel}>Link to Traverse (optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => setTraverseId(undefined)}
                    style={[styles.chip, !traverseId && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, !traverseId && styles.chipTextActive]}>None</Text>
                  </TouchableOpacity>
                  {traverses.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => setTraverseId(t.id)}
                      style={[styles.chip, traverseId === t.id && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, traverseId === t.id && styles.chipTextActive]}>
                        {t.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </>
          )}

          <View style={styles.modalActions}>
            <Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
            <Button
              title="Create"
              onPress={() => {
                if (!parcelNumber.trim()) {
                  Alert.alert('Required', 'Parcel number is required.');
                  return;
                }
                onCreate(parcelNumber.trim(), lrNumber.trim() || undefined, registry.trim() || undefined, traverseId);
              }}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AddPointModal({
  visible,
  onClose,
  onAdd,
  availablePoints,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (pointNumber: string, isBeacon: boolean, beaconType?: ParcelPoint['beaconType'], condition?: ParcelPoint['condition']) => void;
  availablePoints: string[];
}) {
  const [pointNumber, setPointNumber] = useState('');
  const [isBeacon, setIsBeacon] = useState(true);
  const [beaconType, setBeaconType] = useState<NonNullable<ParcelPoint['beaconType']>>('concrete');
  const [condition, setCondition] = useState<NonNullable<ParcelPoint['condition']>>('good');

  const beaconTypes: { value: NonNullable<ParcelPoint['beaconType']>; label: string }[] = [
    { value: 'concrete', label: 'Concrete' },
    { value: 'iron_pin', label: 'Iron Pin' },
    { value: 'stone', label: 'Stone' },
    { value: 'natural', label: 'Natural' },
  ];
  const conditions: { value: NonNullable<ParcelPoint['condition']>; label: string }[] = [
    { value: 'good', label: 'Good' },
    { value: 'disturbed', label: 'Disturbed' },
    { value: 'destroyed', label: 'Destroyed' },
    { value: 'missing', label: 'Missing' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <ScrollView style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Add Boundary Point</Text>

          {availablePoints.length > 0 && (
            <>
              <Text style={styles.modalLabel}>Select from traverse points</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {availablePoints.map((pt) => (
                    <TouchableOpacity
                      key={pt}
                      onPress={() => setPointNumber(pt)}
                      style={[styles.chip, pointNumber === pt && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, pointNumber === pt && styles.chipTextActive]}>
                        {pt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </>
          )}

          <TextInput
            label="Point Number"
            value={pointNumber}
            onChangeText={setPointNumber}
            placeholder="e.g. P-001"
            required
          />

          <Text style={styles.modalLabel}>Beacon?</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              onPress={() => setIsBeacon(true)}
              style={[styles.toggleBtn, isBeacon && styles.toggleBtnActive]}
            >
              <Text style={[styles.toggleBtnText, isBeacon && styles.toggleBtnTextActive]}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setIsBeacon(false)}
              style={[styles.toggleBtn, !isBeacon && styles.toggleBtnActive]}
            >
              <Text style={[styles.toggleBtnText, !isBeacon && styles.toggleBtnTextActive]}>No</Text>
            </TouchableOpacity>
          </View>

          {isBeacon && (
            <>
              <Text style={styles.modalLabel}>Beacon Type</Text>
              <View style={styles.toggleRow}>
                {beaconTypes.map((bt) => (
                  <TouchableOpacity
                    key={bt.value}
                    onPress={() => setBeaconType(bt.value)}
                    style={[styles.chip, beaconType === bt.value && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, beaconType === bt.value && styles.chipTextActive]}>
                      {bt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>Condition</Text>
              <View style={styles.toggleRow}>
                {conditions.map((c) => (
                  <TouchableOpacity
                    key={c.value}
                    onPress={() => setCondition(c.value)}
                    style={[styles.chip, condition === c.value && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, condition === c.value && styles.chipTextActive]}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <View style={styles.modalActions}>
            <Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
            <Button
              title="Add"
              onPress={() => {
                if (!pointNumber.trim()) {
                  Alert.alert('Required', 'Point number is required.');
                  return;
                }
                onAdd(pointNumber.trim(), isBeacon, isBeacon ? beaconType : undefined, isBeacon ? condition : undefined);
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
    color: '#0B1F3A',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
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
  parcelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  parcelIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: #F9731615,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parcelNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0B1F3A',
  },
  parcelLr: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  parcelMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderTopWidth: 3,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B1F3A',
    fontFamily: 'JetBrainsMono',
  },
  statSubValue: {
    fontSize: 10,
    color: '#6B7280',
  },
  statLabel: {
    fontSize: 10,
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0B1F3A',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F97316',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0B1F3A',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  hint: {
    fontSize: 11,
    color: '#F59E0B',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 12,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  seqBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0B1F3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seqText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pointNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0B1F3A',
    fontFamily: 'JetBrainsMono',
  },
  pointMetaRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 31, 58, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0B1F3A',
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  toggleBtnActive: {
    borderColor: '#0B1F3A',
    backgroundColor: '#0B1F3A',
  },
  toggleBtnText: {
    fontSize: 13,
    color: '#0B1F3A',
    fontWeight: '500',
  },
  toggleBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
