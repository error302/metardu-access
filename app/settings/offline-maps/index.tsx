/**
 * Offline Maps — manage MBTiles basemaps for field use.
 *
 * Kenya rural areas have no internet. Surveyors need offline basemaps.
 * Import .mbtiles files (exported from QGIS or metardu-desktop) and the
 * map screens will automatically use them when active.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  FlatList,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import {
  importMBtiles,
  getOfflineMaps,
  setActiveMap,
  deleteOfflineMap,
  formatFileSize,
  type OfflineMap,
} from '@/lib/offline-maps';

export default function OfflineMapsScreen() {
  const router = useRouter();
  const [maps, setMaps] = useState<OfflineMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  const load = async () => {
    setLoading(true);
    setMaps(await getOfflineMaps());
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleImport = async () => {
    setImporting(true);
    try {
      const map = await importMBtiles();
      if (map) {
        await load();
        Alert.alert('Imported', `${map.name} (${formatFileSize(map.fileSizeBytes)}) imported successfully.`);
      }
    } catch (err: any) {
      Alert.alert('Import failed', err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleSetActive = async (id: string) => {
    await setActiveMap(id);
    await load();
  };

  const handleDelete = (map: OfflineMap) => {
    Alert.alert(
      'Delete offline map?',
      `Delete "${map.name}"? This frees up ${formatFileSize(map.fileSizeBytes)} of storage.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteOfflineMap(map.id);
            await load();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF7F2' }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={'#0B1F3A'} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Offline Maps</Text>
          <Text style={styles.subtitle}>MBTiles basemaps for field use</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Info card */}
        <Card style={{ marginBottom: 16 }}>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="information-outline" size={20} color={'#3B82F6'} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Why offline maps?</Text>
              <Text style={styles.infoText}>
                Kenya rural areas often have no internet. Import an MBTiles file
                (satellite imagery or topographic map) exported from QGIS or the
                metardu-desktop app, and the map screens will use it automatically.
              </Text>
            </View>
          </View>
        </Card>

        {/* Import button */}
        <Button
          title="Import .mbtiles File"
          onPress={handleImport}
          loading={importing}
          fullWidth
          size="lg"
          icon={<MaterialCommunityIcons name="file-import" size={20} color={'#FFFFFF'} />}
        />

        {/* Maps list */}
        <Text style={styles.sectionTitle}>Imported Maps ({maps.length})</Text>

        {maps.length === 0 ? (
          <EmptyState
            icon="map-outline"
            title="No offline maps"
            subtitle="Import an .mbtiles file to enable offline basemaps in the field."
          />
        ) : (
          <View style={{ gap: 12 }}>
            {maps.map((map) => (
              <Card key={map.id} style={[
                styles.mapCard,
                map.isActive && { borderColor: '#F97316', borderWidth: 2 },
              ]}>
                <View style={styles.mapHeader}>
                  <View style={[styles.mapIcon, { backgroundColor: #F9731615 }]}>
                    <MaterialCommunityIcons name="map" size={22} color={'#F97316'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mapName} numberOfLines={1}>{map.name}</Text>
                    <Text style={styles.mapMeta}>
                      {formatFileSize(map.fileSizeBytes)} · imported {new Date(map.importedAt).toLocaleDateString()}
                    </Text>
                  </View>
                  {map.isActive && (
                    <View style={[styles.activeBadge, { backgroundColor: '#F97316' }]}>
                      <Text style={styles.activeBadgeText}>ACTIVE</Text>
                    </View>
                  )}
                </View>

                <View style={styles.mapActions}>
                  {!map.isActive && (
                    <Button
                      title="Set Active"
                      variant="outline"
                      size="sm"
                      onPress={() => handleSetActive(map.id)}
                      style={{ flex: 1 }}
                    />
                  )}
                  <Button
                    title="Delete"
                    variant="danger"
                    size="sm"
                    onPress={() => handleDelete(map)}
                    style={{ flex: 1 }}
                  />
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* How-to card */}
        <Card variant="outline" style={{ marginTop: 24 }}>
          <Text style={styles.howtoTitle}>How to create MBTiles files</Text>
          <Text style={styles.howtoStep}>1. In QGIS: Web → Tile creation → Generate MBTiles</Text>
          <Text style={styles.howtoStep}>2. Or in metardu-desktop: File → Export → MBTiles</Text>
          <Text style={styles.howtoStep}>3. Select the survey area bounding box</Text>
          <Text style={styles.howtoStep}>4. Choose zoom levels (12-18 typical for fieldwork)</Text>
          <Text style={styles.howtoStep}>5. Transfer the .mbtiles file to your phone</Text>
          <Text style={styles.howtoStep}>6. Tap "Import .mbtiles File" above</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
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
  infoRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0B1F3A',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 12,
    marginLeft: 4,
  },
  mapCard: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  mapIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0B1F3A',
  },
  mapMeta: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  mapActions: {
    flexDirection: 'row',
    gap: 8,
  },
  howtoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0B1F3A',
    marginBottom: 8,
  },
  howtoStep: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
});
