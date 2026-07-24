/**
 * Beacon Library — catalog of beacons with photos, type, and condition.
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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';

import { Card } from '@/components/Card';
import { TextInput } from '@/components/TextInput';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { getProject } from '@/lib/db/queries';
import {
  createBeacon,
  getBeacons,
  deleteBeacon,
  BEACON_TYPES,
  BEACON_CONDITIONS,
  type Beacon,
} from '@/lib/db/beacons';
import { wgs84ToArc1960Utm37S } from '@engine/transforms';
import type { Project, ParcelPoint } from '@/types';

export default function BeaconsScreen() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();

  const [project, setProject] = useState<Project | null>(null);
  const [beacons, setBeacons] = useState<Beacon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    const p = await getProject(projectId);
    setProject(p);
    const bs = await getBeacons(projectId);
    setBeacons(bs);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [projectId]);

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
          <Text style={styles.title}>Beacon Library</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{project.name}</Text>
        </View>
        <Button title="+ Add" size="sm" onPress={() => setShowAdd(true)} />
      </View>

      {beacons.length === 0 ? (
        <EmptyState
          icon="map-marker-multiple"
          title="No beacons cataloged"
          subtitle="Add beacons with photos for statutory survey records."
          action={<Button title="Add Beacon" onPress={() => setShowAdd(true)} />}
        />
      ) : (
        <FlatList
          data={beacons}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          renderItem={({ item }) => (
            <BeaconCard beacon={item} onDelete={async () => {
              Alert.alert(
                'Delete beacon?',
                `Delete beacon ${item.pointNumber}?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      await deleteBeacon(item.id);
                      await load();
                    },
                  },
                ]
              );
            }} />
          )}
        />
      )}

      <AddBeaconModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={async (input) => {
          await createBeacon({
            projectId,
            ...input,
          });
          await load();
          setShowAdd(false);
        }}
      />
    </SafeAreaView>
  );
}

function BeaconCard({ beacon, onDelete }: { beacon: Beacon; onDelete: () => void }) {
  const typeConfig = BEACON_TYPES.find(t => t.value === beacon.beaconType);
  const condConfig = BEACON_CONDITIONS.find(c => c.value === beacon.condition);

  return (
    <Card style={{ marginBottom: 12 }}>
      <View style={styles.beaconRow}>
        {beacon.photoUri ? (
          <Image source={{ uri: beacon.photoUri }} style={styles.beaconPhoto} />
        ) : (
          <View style={[styles.beaconPhoto, styles.noPhoto]}>
            <MaterialCommunityIcons name={typeConfig?.icon as any ?? 'map-marker'} size={28} color={'#9CA3AF'} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.beaconPoint}>{beacon.pointNumber}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: #F9731620 }]}>
              <MaterialCommunityIcons name={typeConfig?.icon as any ?? 'cube-outline'} size={11} color={'#F97316'} />
              <Text style={[styles.badgeText, { color: '#F97316' }]}>
                {typeConfig?.label ?? beacon.beaconType}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: `${condConfig?.color ?? '#6B7280'}20` }]}>
              <MaterialCommunityIcons name="circle-medium" size={11} color={condConfig?.color ?? '#6B7280'} />
              <Text style={[styles.badgeText, { color: condConfig?.color ?? '#6B7280' }]}>
                {condConfig?.label ?? beacon.condition}
              </Text>
            </View>
          </View>
          {beacon.description && (
            <Text style={styles.beaconDesc} numberOfLines={2}>{beacon.description}</Text>
          )}
          <Text style={styles.beaconDate}>
            {new Date(beacon.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <TouchableOpacity onPress={onDelete} style={{ padding: 4 }}>
          <MaterialCommunityIcons name="delete-outline" size={20} color={'#EF4444'} />
        </TouchableOpacity>
      </View>
    </Card>
  );
}

function AddBeaconModal({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (input: {
    pointNumber: string;
    beaconType: NonNullable<ParcelPoint['beaconType']>;
    condition: NonNullable<ParcelPoint['condition']>;
    photoUri?: string;
    description?: string;
    easting?: number;
    northing?: number;
    elevation?: number;
  }) => Promise<void>;
}) {
  const [pointNumber, setPointNumber] = useState('');
  const [beaconType, setBeaconType] = useState<NonNullable<ParcelPoint['beaconType']>>('concrete');
  const [condition, setCondition] = useState<NonNullable<ParcelPoint['condition']>>('good');
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);
  const [description, setDescription] = useState('');
  const [coords, setCoords] = useState<{ easting: number; northing: number; elevation: number } | undefined>(undefined);
  const [capturing, setCapturing] = useState(false);

  const reset = () => {
    setPointNumber('');
    setBeaconType('concrete');
    setCondition('good');
    setPhotoUri(undefined);
    setDescription('');
    setCoords(undefined);
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Camera permission is required for beacon photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const captureGps = async () => {
    setCapturing(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const utm = wgs84ToArc1960Utm37S({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      });
      setCoords({
        easting: utm.easting,
        northing: utm.northing,
        elevation: loc.coords.altitude ?? 0,
      });
    } catch (err: any) {
      Alert.alert('GPS failed', err.message);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <ScrollView style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Add Beacon</Text>

          <TextInput
            label="Point Number"
            value={pointNumber}
            onChangeText={setPointNumber}
            placeholder="e.g. P-001"
            required
          />

          <Text style={styles.modalLabel}>Beacon Type</Text>
          <View style={styles.toggleRow}>
            {BEACON_TYPES.map((bt) => (
              <TouchableOpacity
                key={bt.value}
                onPress={() => setBeaconType(bt.value)}
                style={[styles.typeChip, beaconType === bt.value && styles.typeChipActive]}
              >
                <MaterialCommunityIcons
                  name={bt.icon as any}
                  size={14}
                  color={beaconType === bt.value ? '#FFFFFF' : '#0B1F3A'}
                />
                <Text style={[styles.typeChipText, beaconType === bt.value && styles.typeChipTextActive]}>
                  {bt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.modalLabel}>Condition</Text>
          <View style={styles.toggleRow}>
            {BEACON_CONDITIONS.map((c) => (
              <TouchableOpacity
                key={c.value}
                onPress={() => setCondition(c.value)}
                style={[styles.typeChip, condition === c.value && { backgroundColor: c.color, borderColor: c.color }]}
              >
                <Text style={[styles.typeChipText, condition === c.value && styles.typeChipTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            label="Description (optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. North-east corner of parcel"
            multiline
          />

          {/* Photo capture */}
          <Text style={styles.modalLabel}>Photo Evidence</Text>
          <TouchableOpacity onPress={pickPhoto} style={styles.photoPicker}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoPreview} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <MaterialCommunityIcons name="camera" size={32} color={'#9CA3AF'} />
                <Text style={styles.photoPlaceholderText}>Tap to take photo</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* GPS capture */}
          <Text style={styles.modalLabel}>GPS Coordinates (optional)</Text>
          {coords ? (
            <View style={styles.coordsCard}>
              <MaterialCommunityIcons name="check-circle" size={16} color={'#10B981'} />
              <Text style={styles.coordsText}>
                E: {coords.easting.toFixed(3)}  N: {coords.northing.toFixed(3)}  Elev: {coords.elevation.toFixed(2)}m
              </Text>
              <TouchableOpacity onPress={captureGps}>
                <MaterialCommunityIcons name="refresh" size={16} color={'#F97316'} />
              </TouchableOpacity>
            </View>
          ) : (
            <Button
              title="Capture GPS"
              variant="outline"
              size="sm"
              onPress={captureGps}
              loading={capturing}
              icon={<MaterialCommunityIcons name="crosshairs-gps" size={16} color={'#0B1F3A'} />}
            />
          )}

          <View style={styles.modalActions}>
            <Button title="Cancel" variant="ghost" onPress={() => { reset(); onClose(); }} style={{ flex: 1 }} />
            <Button
              title="Save"
              onPress={async () => {
                if (!pointNumber.trim()) {
                  Alert.alert('Required', 'Point number is required.');
                  return;
                }
                await onAdd({
                  pointNumber: pointNumber.trim(),
                  beaconType,
                  condition,
                  photoUri,
                  description: description.trim() || undefined,
                  easting: coords?.easting,
                  northing: coords?.northing,
                  elevation: coords?.elevation,
                });
                reset();
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
  beaconRow: {
    flexDirection: 'row',
    gap: 12,
  },
  beaconPhoto: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  noPhoto: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  beaconPoint: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0B1F3A',
    fontFamily: 'JetBrainsMono',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
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
  beaconDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  beaconDate: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 4,
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
    marginTop: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  typeChipActive: {
    backgroundColor: '#0B1F3A',
    borderColor: '#0B1F3A',
  },
  typeChipText: {
    fontSize: 12,
    color: '#0B1F3A',
    fontWeight: '500',
  },
  typeChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  photoPicker: {
    marginBottom: 8,
  },
  photoPreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
  photoPlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoPlaceholderText: {
    fontSize: 13,
    color: '#6B7280',
  },
  coordsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: #10B98115,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  coordsText: {
    flex: 1,
    fontSize: 12,
    color: '#0B1F3A',
    fontFamily: 'JetBrainsMono',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
});
