/**
 * Sectional Properties — Units Registry (Sectional Properties Act 2020, Kenya).
 *
 * Register individual units with floor, area, and exclusive use areas.
 * Each unit gets a unique number for the sectional plan.
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
import { getDatabase, generateId, nowISO } from '@/lib/db/schema';
import { getProject } from '@/lib/db/queries';
import type { Project, SectionalUnit, ExclusiveUseArea } from '@/types';
import { useThemeColors } from '@/hooks/useThemeColors';

interface SectionalPropertyWithUnits {
  id: string;
  projectId: string;
  developmentName: string;
  parcelNumber: string;
  totalUnits: number;
  totalFloors: number;
  status: string;
  units: UnitWithEUAs[];
}

interface UnitWithEUAs extends SectionalUnit {
  euas: ExclusiveUseArea[];
}

export default function UnitsScreen() {
  const Colors = useThemeColors();
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();

  const [project, setProject] = useState<Project | null>(null);
  const [properties, setProperties] = useState<SectionalPropertyWithUnits[]>([]);
  const [selected, setSelected] = useState<SectionalPropertyWithUnits | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewProp, setShowNewProp] = useState(false);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitWithEUAs | null>(null);

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    const p = await getProject(projectId);
    setProject(p);
    const db = await getDatabase();
    const propRows = await db.getAllAsync<any>(
      `SELECT * FROM sectional_properties WHERE project_id = ? ORDER BY development_name`,
      [projectId]
    );
    const props: SectionalPropertyWithUnits[] = [];
    for (const pr of propRows) {
      const unitRows = await db.getAllAsync<any>(
        `SELECT * FROM sectional_units WHERE sectional_property_id = ? ORDER BY floor ASC, unit_number ASC`,
        [pr.id]
      );
      const units: UnitWithEUAs[] = [];
      for (const u of unitRows) {
        const euaRows = await db.getAllAsync<any>(
          `SELECT * FROM exclusive_use_areas WHERE sectional_unit_id = ?`,
          [u.id]
        );
        units.push({
          id: u.id,
          sectionalPropertyId: u.sectional_property_id,
          unitNumber: u.unit_number,
          floor: u.floor,
          areaSqm: u.area_sqm,
          floorPlanUri: u.floor_plan_uri,
          euas: euaRows.map((e: any) => ({
            id: e.id,
            sectionalUnitId: e.sectional_unit_id,
            type: e.type,
            areaSqm: e.area_sqm,
            description: e.description,
          })),
        });
      }
      props.push({
        id: pr.id,
        projectId: pr.project_id,
        developmentName: pr.development_name,
        parcelNumber: pr.parcel_number,
        totalUnits: pr.total_units,
        totalFloors: pr.total_floors,
        status: pr.status,
        units,
      });
    }
    setProperties(props);
    if (props.length > 0 && !selected) setSelected(props[0]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const totalArea = selected?.units.reduce((s, u) => s + u.areaSqm, 0) ?? 0;
  const totalEuaArea = selected?.units.reduce(
    (s, u) => s + u.euas.reduce((ss, e) => ss + e.areaSqm, 0),
    0
  ) ?? 0;

  if (!project) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: Colors.fgMuted }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={'#0B1F3A'} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Sectional Units</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{project.name}</Text>
        </View>
        <Button title="+ Dev" size="sm" onPress={() => setShowNewProp(true)} />
      </View>

      {properties.length === 0 ? (
        <EmptyState
          icon="home-city"
          title="No sectional developments"
          subtitle="Register a development to start adding units."
          action={<Button title="Create Development" onPress={() => setShowNewProp(true)} />}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
          {/* Property selector */}
          {properties.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {properties.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => setSelected(p)}
                    style={[styles.chip, selected?.id === p.id && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, selected?.id === p.id && styles.chipTextActive]}>
                      {p.developmentName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          {selected && (
            <>
              {/* Development summary */}
              <Card style={{ marginBottom: 16 }}>
                <View style={styles.devHeader}>
                  <View style={styles.devIcon}>
                    <MaterialCommunityIcons name="home-city" size={24} color={'#F59E0B'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.devName}>{selected.developmentName}</Text>
                    <Text style={styles.devParcel}>Parent Parcel: {selected.parcelNumber}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: #F59E0B20 }]}>
                    <Text style={[styles.statusText, { color: '#F59E0B' }]}>
                      {selected.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <View style={styles.devStatsRow}>
                  <DevStat label="Units" value={String(selected.units.length)} target={selected.totalUnits || undefined} />
                  <DevStat label="Floors" value={String(selected.totalFloors)} />
                  <DevStat label="Total Area" value={`${totalArea.toFixed(1)} m²`} />
                  <DevStat label="EUA Area" value={`${totalEuaArea.toFixed(1)} m²`} />
                </View>
              </Card>

              {/* Units list */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Units ({selected.units.length})</Text>
                <TouchableOpacity onPress={() => setShowAddUnit(true)}>
                  <View style={styles.addBtn}>
                    <MaterialCommunityIcons name="plus" size={16} color={Colors.bgCard} />
                    <Text style={styles.addBtnText}>Add Unit</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {selected.units.length === 0 ? (
                <Card variant="outline" style={{ alignItems: 'center', padding: 20 }}>
                  <Text style={styles.emptyTitle}>No units registered</Text>
                  <Text style={styles.emptySub}>
                    Add units with floor, area, and exclusive use areas per the Sectional Properties Act 2020.
                  </Text>
                </Card>
              ) : (
                <View style={{ gap: 8 }}>
                  {selected.units.map((unit) => (
                    <UnitCard
                      key={unit.id}
                      unit={unit}
                      onEdit={() => setEditingUnit(unit)}
                    />
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      <NewPropModal
        visible={showNewProp}
        onClose={() => setShowNewProp(false)}
        onCreate={async (developmentName, parcelNumber, totalFloors) => {
          const db = await getDatabase();
          const id = generateId();
          const now = nowISO();
          await db.runAsync(
            `INSERT INTO sectional_properties (id, project_id, development_name, parcel_number, total_units, total_floors, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, 0, ?, 'draft', ?, ?)`,
            [id, projectId, developmentName, parcelNumber, totalFloors, now, now]
          );
          await load();
          setShowNewProp(false);
        }}
      />

      {selected && (
        <AddUnitModal
          visible={showAddUnit}
          onClose={() => setShowAddUnit(false)}
          totalFloors={selected.totalFloors}
          existingUnitNumbers={selected.units.map(u => u.unitNumber)}
          onAdd={async (unitNumber, floor, area) => {
            const db = await getDatabase();
            const id = generateId();
            await db.runAsync(
              `INSERT INTO sectional_units (id, sectional_property_id, unit_number, floor, area_sqm)
               VALUES (?, ?, ?, ?, ?)`,
              [id, selected.id, unitNumber, floor, area]
            );
            await db.runAsync(
              `UPDATE sectional_properties SET total_units = total_units + 1, updated_at = ? WHERE id = ?`,
              [nowISO(), selected.id]
            );
            await load();
            setShowAddUnit(false);
          }}
        />
      )}
    </SafeAreaView>
  );
}

function UnitCard({ unit, onEdit }: { unit: UnitWithEUAs; onEdit: () => void }) {
  const euaIcons: Record<string, string> = {
    balcony: 'balcony',
    parking: 'car',
    garden: 'flower',
    storage: 'package-variant-closed',
    terrace: 'table-chair',
  };

  return (
    <Card style={{ padding: 12 }}>
      <TouchableOpacity onPress={onEdit}>
        <View style={styles.unitRow}>
          <View style={styles.unitNumberBox}>
            <Text style={styles.unitFloorLabel}>F{unit.floor}</Text>
            <Text style={styles.unitNumber}>{unit.unitNumber}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.unitTitle}>Unit {unit.unitNumber}</Text>
            <Text style={styles.unitMeta}>Floor {unit.floor} · {unit.areaSqm.toFixed(2)} m²</Text>
            {unit.euas.length > 0 && (
              <View style={styles.euaRow}>
                {unit.euas.map((e) => (
                  <View key={e.id} style={[styles.euaBadge, { backgroundColor: #F59E0B20 }]}>
                    <MaterialCommunityIcons name={(euaIcons[e.type] ?? 'crop') as any} size={11} color={'#F59E0B'} />
                    <Text style={[styles.euaText, { color: '#F59E0B' }]}>
                      {e.type}: {e.areaSqm.toFixed(1)}m²
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.fgSubtle} />
        </View>
      </TouchableOpacity>
    </Card>
  );
}

function DevStat({ label, value, target }: { label: string; value: string; target?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.devStatValue}>{value}</Text>
      {target && <Text style={styles.devStatTarget}>/ {target}</Text>}
      <Text style={styles.devStatLabel}>{label}</Text>
    </View>
  );
}

function NewPropModal({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (developmentName: string, parcelNumber: string, totalFloors: number) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [parcel, setParcel] = useState('');
  const [floors, setFloors] = useState('5');

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>New Sectional Development</Text>

          <TextInput
            label="Development Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Riverside Apartments"
            required
          />
          <TextInput
            label="Parent Parcel Number"
            value={parcel}
            onChangeText={setParcel}
            placeholder="e.g. LR 2090/12345"
            required
          />
          <TextInput
            label="Total Floors"
            value={floors}
            onChangeText={setFloors}
            placeholder="5"
            keyboardType="decimal-pad"
            required
          />

          <View style={styles.modalActions}>
            <Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
            <Button
              title="Create"
              onPress={() => {
                if (!name.trim() || !parcel.trim()) {
                  Alert.alert('Required', 'Development name and parcel number are required.');
                  return;
                }
                onCreate(name.trim(), parcel.trim(), parseInt(floors) || 1);
              }}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AddUnitModal({
  visible,
  onClose,
  onAdd,
  totalFloors,
  existingUnitNumbers,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (unitNumber: string, floor: number, area: number) => Promise<void>;
  totalFloors: number;
  existingUnitNumbers: string[];
}) {
  const [unitNumber, setUnitNumber] = useState('');
  const [floor, setFloor] = useState('1');
  const [area, setArea] = useState('');

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Add Unit</Text>

          <TextInput
            label="Unit Number"
            value={unitNumber}
            onChangeText={setUnitNumber}
            placeholder="e.g. A-101"
            hint={existingUnitNumbers.length > 0 ? `Existing: ${existingUnitNumbers.slice(0, 5).join(', ')}${existingUnitNumbers.length > 5 ? '...' : ''}` : undefined}
            required
          />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <TextInput
                label="Floor"
                value={floor}
                onChangeText={setFloor}
                placeholder={`1-${totalFloors}`}
                keyboardType="decimal-pad"
                required
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextInput
                label="Area (m²)"
                value={area}
                onChangeText={setArea}
                placeholder="e.g. 85.50"
                keyboardType="decimal-pad"
                required
              />
            </View>
          </View>

          <View style={styles.modalActions}>
            <Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
            <Button
              title="Add Unit"
              onPress={() => {
                if (!unitNumber.trim()) {
                  Alert.alert('Required', 'Unit number is required.');
                  return;
                }
                const f = parseInt(floor);
                const a = parseFloat(area);
                if (isNaN(f) || f < 1 || f > totalFloors) {
                  Alert.alert('Invalid floor', `Floor must be between 1 and ${totalFloors}.`);
                  return;
                }
                if (isNaN(a) || a <= 0) {
                  Alert.alert('Invalid area', 'Area must be a positive number.');
                  return;
                }
                onAdd(unitNumber.trim(), f, a);
                setUnitNumber('');
                setArea('');
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
    color: '#0B1F3A',
  },
  subtitle: {
    fontSize: 13,
    color: Colors.fgMuted,
    marginTop: 2,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.bgSubtle,
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
    color: Colors.bgCard,
    fontWeight: '600',
  },
  devHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  devIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: #F59E0B15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0B1F3A',
  },
  devParcel: {
    fontSize: 12,
    color: Colors.fgMuted,
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
  devStatsRow: {
    flexDirection: 'row',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  devStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0B1F3A',
  },
  devStatTarget: {
    fontSize: 10,
    color: Colors.fgSubtle,
    fontFamily: 'JetBrainsMono',
  },
  devStatLabel: {
    fontSize: 10,
    color: Colors.fgMuted,
    textTransform: 'uppercase',
    marginTop: 2,
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
    color: Colors.bgCard,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0B1F3A',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.fgMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  unitNumberBox: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#0B1F3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitFloorLabel: {
    fontSize: 9,
    color: Colors.bg,
    fontWeight: '600',
  },
  unitNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.bgCard,
  },
  unitTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0B1F3A',
  },
  unitMeta: {
    fontSize: 12,
    color: Colors.fgMuted,
    marginTop: 2,
  },
  euaRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
    marginTop: 6,
  },
  euaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  euaText: {
    fontSize: 10,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 31, 58, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.bgCard,
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
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
});
