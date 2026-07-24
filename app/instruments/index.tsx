/**
 * Instrument Connection — connect to total stations via Bluetooth.
 *
 * Surveyors connect their total station (Trimble, Leica, Topcon, Sokkia, Nikon)
 * via Bluetooth. Once connected, the app receives measurements directly from
 * the instrument — no manual entry needed.
 *
 * Workflow:
 *   1. Pair total station in OS Bluetooth settings
 *   2. Scan for the instrument here
 *   3. Connect
 *   4. Measurements stream into the observation form automatically
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import {
  getTotalStationDriver,
  type Instrument,
  type ObservationReading,
} from '@/lib/drivers/total-station';
import { field as haptics } from '@/lib/haptics';

export default function InstrumentsScreen() {
  const router = useRouter();
  const driver = getTotalStationDriver();

  const [scanning, setScanning] = useState(false);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [connected, setConnected] = useState<Instrument | null>(null);
  const [readings, setReadings] = useState<ObservationReading[]>([]);

  const scan = async () => {
    setScanning(true);
    setInstruments([]);
    try {
      await driver.scanForDevices((instrument) => {
        setInstruments((prev) => {
          if (prev.find(i => i.id === instrument.id)) return prev;
          return [...prev, instrument];
        });
      }, 10000);
    } catch (err: any) {
      Alert.alert('Scan failed', err.message);
    } finally {
      setScanning(false);
    }
  };

  const connectInstrument = async (instrument: Instrument) => {
    try {
      await driver.connect(instrument.id);
      setConnected(instrument);
      await haptics.success();

      // Subscribe to incoming measurements
      await driver.subscribeToMeasurements(async (reading) => {
        setReadings((prev) => [reading, ...prev].slice(0, 50));
        await haptics.pointCaptured();
      });

      Alert.alert('Connected', `Connected to ${instrument.name}.\nMeasurements will stream automatically.`);
    } catch (err: any) {
      await haptics.error();
      Alert.alert('Connection failed', err.message);
    }
  };

  const disconnect = async () => {
    await driver.disconnect();
    setConnected(null);
    setReadings([]);
    await haptics.medium();
  };

  const sendMeasureCommand = async () => {
    try {
      await driver.sendCommand('MEASURE');
      await haptics.tap();
    } catch (err: any) {
      Alert.alert('Command failed', err.message);
    }
  };

  const brandColor = (brand: string) => {
    const colors: Record<string, string> = {
      trimble: '#3B82F6',
      leica: '#EF4444',
      topcon: '#10B981',
      sokkia: '#F59E0B',
      nikon: '#A21CAF',
      generic: '#6B7280',
    };
    return colors[brand] ?? '#6B7280';
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF7F2' }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={'#0B1F3A'} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Instruments</Text>
          <Text style={styles.subtitle}>Connect total stations via Bluetooth</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Connection status */}
        {connected && (
          <Card style={[styles.connectedCard, { borderLeftColor: brandColor(connected.brand) }]}>
            <View style={styles.connectedHeader}>
              <View style={[styles.connectedIcon, { backgroundColor: `${brandColor(connected.brand)}20` }]}>
                <MaterialCommunityIcons name="radio-tower" size={24} color={brandColor(connected.brand)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.connectedName}>{connected.name}</Text>
                <Text style={styles.connectedBrand}>{connected.brand} · {connected.protocol.toUpperCase()}</Text>
              </View>
              <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
            </View>

            <View style={styles.commandRow}>
              <Button
                title="Measure"
                onPress={sendMeasureCommand}
                style={{ flex: 1 }}
                icon={<MaterialCommunityIcons name="target" size={18} color={'#FFFFFF'} />}
              />
              <Button
                title="Disconnect"
                variant="danger"
                size="sm"
                onPress={disconnect}
              />
            </View>
          </Card>
        )}

        {/* Scan button */}
        {!connected && (
          <Button
            title={scanning ? 'Scanning...' : 'Scan for Instruments'}
            onPress={scan}
            loading={scanning}
            fullWidth
            size="lg"
            icon={<MaterialCommunityIcons name="bluetooth-search" size={20} color={'#FFFFFF'} />}
          />
        )}

        {/* Found instruments */}
        {!connected && instruments.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.sectionTitle}>Found Instruments ({instruments.length})</Text>
            <View style={{ gap: 8 }}>
              {instruments.map((inst) => (
                <TouchableOpacity
                  key={inst.id}
                  onPress={() => connectInstrument(inst)}
                  style={styles.instrumentRow}
                >
                  <View style={[styles.instrumentIcon, { backgroundColor: `${brandColor(inst.brand)}20` }]}>
                    <MaterialCommunityIcons name="radio-tower" size={20} color={brandColor(inst.brand)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.instrumentName}>{inst.name}</Text>
                    <Text style={styles.instrumentBrand}>
                      {inst.brand} · {inst.protocol.toUpperCase()}
                      {inst.rssi ? ` · ${inst.rssi}dB` : ''}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={'#9CA3AF'} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Live readings */}
        {connected && readings.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.sectionTitle}>Live Measurements ({readings.length})</Text>
            <View style={{ gap: 6 }}>
              {readings.map((r, i) => (
                <Card key={i} style={{ padding: 10 }}>
                  <View style={styles.readingRow}>
                    <View style={styles.readingIcon}>
                      <MaterialCommunityIcons name="angle-acute" size={16} color={'#F97316'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      {r.pointNumber && (
                        <Text style={styles.readingPoint}>{r.pointNumber}</Text>
                      )}
                      <Text style={styles.readingValues}>
                        {r.horizontalAngle != null && `HA: ${r.horizontalAngle.toFixed(4)}°  `}
                        {r.verticalAngle != null && `VA: ${r.verticalAngle.toFixed(4)}°  `}
                        {r.slopeDistance != null && `SD: ${r.slopeDistance.toFixed(3)}m`}
                      </Text>
                      <Text style={styles.readingTime}>
                        {new Date(r.timestamp).toLocaleTimeString()}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          </View>
        )}

        {/* Empty state */}
        {!connected && instruments.length === 0 && !scanning && (
          <View style={{ marginTop: 24 }}>
            <EmptyState
              icon="bluetooth"
              title="No instruments found"
              subtitle="Pair your total station in Bluetooth settings first, then tap Scan."
            />
          </View>
        )}

        {/* Supported instruments */}
        <Card variant="outline" style={{ marginTop: 24 }}>
          <Text style={styles.cardTitle}>Supported Instruments</Text>
          <SupportedRow brand="Trimble" models="S5, S7, S9, C5" color={brandColor('trimble')} />
          <SupportedRow brand="Leica" models="TS, Nova, FlexLine" color={brandColor('leica')} />
          <SupportedRow brand="Topcon" models="GT, GPT, OS" color={brandColor('topcon')} />
          <SupportedRow brand="Sokkia" models="CX, FX, SRX" color={brandColor('sokkia')} />
          <SupportedRow brand="Nikon" models="DTM, Nivo" color={brandColor('nikon')} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function SupportedRow({ brand, models, color }: { brand: string; models: string; color: string }) {
  return (
    <View style={styles.supportedRow}>
      <View style={[styles.supportedDot, { backgroundColor: color }]} />
      <Text style={styles.supportedBrand}>{brand}</Text>
      <Text style={styles.supportedModels}>{models}</Text>
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
  connectedCard: {
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  connectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  connectedIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectedName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0B1F3A',
  },
  connectedBrand: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  commandRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  instrumentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  instrumentIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instrumentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0B1F3A',
  },
  instrumentBrand: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  readingIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: #F9731615,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readingPoint: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F97316',
    fontFamily: 'JetBrainsMono',
  },
  readingValues: {
    fontSize: 12,
    color: '#0B1F3A',
    fontFamily: 'JetBrainsMono',
    marginTop: 2,
  },
  readingTime: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0B1F3A',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  supportedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  supportedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  supportedBrand: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0B1F3A',
    width: 80,
  },
  supportedModels: {
    flex: 1,
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'JetBrainsMono',
  },
});
