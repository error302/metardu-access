/**
 * Feature Codes — manage topo point codes per project.
 *
 * Pre-loaded with Kenya standard library on first open.
 * Surveyors can add custom codes, toggle active/inactive, organize by layer.
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
  SectionList,
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
  getFeatureCodes,
  createFeatureCode,
  updateFeatureCode,
  deleteFeatureCode,
  ensureStandardCodes,
  FEATURE_LAYERS,
} from '@/lib/db/featureCodes';
import type { FeatureCode, FeatureLayer, Project } from '@/types';
import { useThemeColors } from '@/hooks/useThemeColors';

export default function FeaturesScreen() {
  const Colors = useThemeColors();
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();

  const [project, setProject] = useState<Project | null>(null);
  const [codes, setCodes] = useState<FeatureCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filterLayer, setFilterLayer] = useState<FeatureLayer | 'all'>('all');

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    const p = await getProject(projectId);
    setProject(p);
    // Pre-load Kenya standard library if empty
    await ensureStandardCodes(projectId);
    const cs = await getFeatureCodes(projectId);
    setCodes(cs);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const filteredCodes = filterLayer === 'all'
    ? codes
    : codes.filter(c => c.layer === filterLayer);

  // Group by layer for section list
  const sections = FEATURE_LAYERS
    .map(layer => ({
      layer,
      title: layer.label,
      data: filteredCodes.filter(c => c.layer === layer.value),
    }))
    .filter(s => s.data.length > 0);

  const toggleActive = async (code: FeatureCode) => {
    await updateFeatureCode(code.id, { isActive: !code.isActive });
    await load();
  };

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
          <Text style={styles.title}>Feature Codes</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{project.name}</Text>
        </View>
        <Button title="+ Add" size="sm" onPress={() => setShowAdd(true)} />
      </View>

      {/* Layer filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        <FilterChip
          label={`All (${codes.length})`}
          active={filterLayer === 'all'}
          onPress={() => setFilterLayer('all')}
        />
        {FEATURE_LAYERS.map(l => {
          const count = codes.filter(c => c.layer === l.value).length;
          if (count === 0) return null;
          return (
            <FilterChip
              key={l.value}
              label={`${l.label} (${count})`}
              active={filterLayer === l.value}
              color={l.color}
              onPress={() => setFilterLayer(l.value)}
            />
          );
        })}
      </ScrollView>

      {sections.length === 0 ? (
        <EmptyState
          icon="tag-multiple"
          title="No feature codes"
          subtitle="Kenya standard library failed to load. Add codes manually."
          action={<Button title="Add Code" onPress={() => setShowAdd(true)} />}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name={FEATURE_LAYERS.find(l => l.value === (section as any).layer.value)?.icon as any ?? 'tag'}
                size={16}
                color={FEATURE_LAYERS.find(l => l.value === (section as any).layer.value)?.color ?? Colors.fgMuted}
              />
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionCount}>{section.data.length}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <Card style={{ marginBottom: 8, padding: 12, opacity: item.isActive ? 1 : 0.5 }}>
              <View style={styles.codeRow}>
                <View style={[styles.codeIcon, { backgroundColor: `${item.color}20` }]}>
                  <MaterialCommunityIcons name={item.icon as any} size={20} color={item.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.codeHeader}>
                    <Text style={styles.codeText}>{item.code}</Text>
                    {!item.isActive && (
                      <View style={[styles.inactiveBadge, { backgroundColor: '#E5E7EB' }]}>
                        <Text style={styles.inactiveText}>INACTIVE</Text>
                      </View>
                    )}
                  </View>
                  {item.description && (
                    <Text style={styles.codeDesc}>{item.description}</Text>
                  )}
                </View>
                <View style={styles.codeActions}>
                  <TouchableOpacity
                    onPress={() => toggleActive(item)}
                    style={{ padding: 4 }}
                  >
                    <MaterialCommunityIcons
                      name={item.isActive ? 'eye' : 'eye-off'}
                      size={18}
                      color={item.isActive ? '#F97316' : Colors.fgSubtle}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(
                        'Delete code?',
                        `Delete feature code "${item.code}"?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: async () => {
                              await deleteFeatureCode(item.id);
                              await load();
                            },
                          },
                        ]
                      );
                    }}
                    style={{ padding: 4 }}
                  >
                    <MaterialCommunityIcons name="delete-outline" size={18} color={'#EF4444'} />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          )}
        />
      )}

      <AddCodeModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={async (code, description, layer, color, icon) => {
          try {
            await createFeatureCode({ projectId, code, description, layer, color, icon });
            await load();
            setShowAdd(false);
          } catch (err: any) {
            Alert.alert('Failed', err.message ?? 'Could not create code (code may already exist).');
          }
        }}
      />
    </SafeAreaView>
  );
}

function FilterChip({
  label,
  active,
  color,
  onPress,
}: {
  label: string;
  active: boolean;
  color?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.filterChip,
        active && { backgroundColor: color ?? '#0B1F3A', borderColor: color ?? '#0B1F3A' },
      ]}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function AddCodeModal({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (
    code: string,
    description: string,
    layer: FeatureLayer,
    color: string,
    icon: string
  ) => Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [layer, setLayer] = useState<FeatureLayer>('general');
  const [color, setColor] = useState('#F97316');
  const [icon, setIcon] = useState('map-marker');

  const palette = ['#F97316', '#3B82F6', '#10B981', '#06B6D4', '#A21CAF', '#EF4444', Colors.fgMuted, '#000000'];
  const icons = ['map-marker', 'tree', 'home', 'road-variant', 'waves', 'transmission-tower', 'crosshairs-gps', 'circle-multiple'];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <ScrollView style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Add Feature Code</Text>

          <TextInput
            label="Code (short, uppercase)"
            value={code}
            onChangeText={setCode}
            placeholder="e.g. SIGN"
            autoCapitalize="characters"
            required
          />
          <TextInput
            label="Description (optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. Road sign"
          />

          <Text style={styles.modalLabel}>Layer</Text>
          <View style={styles.toggleRow}>
            {FEATURE_LAYERS.map(l => (
              <TouchableOpacity
                key={l.value}
                onPress={() => { setLayer(l.value); setColor(l.color); setIcon(l.icon); }}
                style={[
                  styles.layerChip,
                  layer === l.value && { backgroundColor: l.color, borderColor: l.color },
                ]}
              >
                <MaterialCommunityIcons
                  name={l.icon as any}
                  size={14}
                  color={layer === l.value ? Colors.bgCard : l.color}
                />
                <Text style={[
                  styles.layerChipText,
                  layer === l.value && styles.layerChipTextActive,
                ]}>
                  {l.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.modalLabel}>Color</Text>
          <View style={styles.paletteRow}>
            {palette.map(c => (
              <TouchableOpacity
                key={c}
                onPress={() => setColor(c)}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: c },
                  color === c && styles.colorSwatchActive,
                ]}
              />
            ))}
          </View>

          <Text style={styles.modalLabel}>Icon</Text>
          <View style={styles.paletteRow}>
            {icons.map(i => (
              <TouchableOpacity
                key={i}
                onPress={() => setIcon(i)}
                style={[
                  styles.iconSwatch,
                  icon === i && { backgroundColor: '#F97316' },
                ]}
              >
                <MaterialCommunityIcons
                  name={i as any}
                  size={18}
                  color={icon === i ? Colors.bgCard : '#0B1F3A'}
                />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.modalActions}>
            <Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
            <Button
              title="Add Code"
              onPress={() => {
                if (!code.trim()) {
                  Alert.alert('Required', 'Code is required.');
                  return;
                }
                onAdd(code.toUpperCase().trim(), description.trim() || '', layer, color, icon);
                setCode('');
                setDescription('');
                setLayer('general');
                setColor('#F97316');
                setIcon('map-marker');
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
    color: Colors.fgMuted,
    marginTop: 2,
  },
  filterRow: {
    maxHeight: 44,
    paddingVertical: 6,
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: Colors.bgCard,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#0B1F3A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: 11,
    color: Colors.fgMuted,
    fontFamily: 'JetBrainsMono',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  codeIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B1F3A',
    fontFamily: 'JetBrainsMono',
  },
  inactiveBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  inactiveText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.fgMuted,
  },
  codeDesc: {
    fontSize: 12,
    color: Colors.fgMuted,
    marginTop: 2,
  },
  codeActions: {
    flexDirection: 'row',
    gap: 8,
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
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.fgMuted,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  layerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: Colors.bgCard,
  },
  layerChipText: {
    fontSize: 11,
    color: '#0B1F3A',
    fontWeight: '500',
  },
  layerChipTextActive: {
    color: Colors.bgCard,
    fontWeight: '600',
  },
  paletteRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: {
    borderColor: '#0B1F3A',
    borderWidth: 3,
  },
  iconSwatch: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
});
