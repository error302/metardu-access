/**
 * GNSS / RTK Settings — configure NTRIP corrections + connect external receivers.
 *
 * This is the critical screen for cm-level accuracy:
 *   1. Configure NTRIP credentials (KENCORS or custom)
 *   2. Test NTRIP connection
 *   3. Scan for BLE GNSS receivers (u-blox, Emlid Reach, Trimble)
 *   4. Connect to a receiver
 *   5. View live position with solution type (fixed/float/single)
 *
 * Without this screen, the app only has phone GPS accuracy (3-5m).
 * With RTK: 1-2cm horizontal, 2-3cm vertical — survey-grade.
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
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Colors } from '@/theme';
import { Card } from '@/components/Card';
import { TextInput } from '@/components/TextInput';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { getGnssRtkDriver, type GnssReceiver, type GnssPosition } from '@/lib/drivers/gnss-rtk';
import { KENYA_CORS_PRESETS } from '@/lib/drivers/ntrip-client';
import { field as haptics } from '@/lib/haptics';
import * as SecureStore from 'expo-secure-store';

const NTRIP_STORAGE = 'metardu_ntrip_creds';

export default function GnssSettingsScreen() {
  const router = useRouter();
  const driver = getGnssRtkDriver();

  const [host, setHost] = useState('');
  const [port, setPort] = useState('2101');
  const [mountpoint, setMountpoint] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [receivers, setReceivers] = useState<GnssReceiver[]>([]);
  const [connectedReceiver, setConnectedReceiver] = useState<GnssReceiver | null>(null);

  const [livePosition, setLivePosition] = useState<GnssPosition | null>(null);

  useEffect(() => {
    loadCredentials();
    // Subscribe to position updates
    const unsub = driver.onPosition((pos) => {
      setLivePosition(pos);
    });
    return () => {
      unsub();
    };
  }, []);

  const loadCredentials = async () => {
    try {
      const raw = await SecureStore.getItemAsync(NTRIP_STORAGE);
      if (raw) {
        const creds = JSON.parse(raw);
        setHost(creds.host ?? '');
        setPort(String(creds.port ?? '2101'));
        setMountpoint(creds.mountpoint ?? '');
        setUsername(creds.username ?? '');
        setPassword(creds.password ?? '');
        driver.setNtripCredentials(creds);
      }
    } catch {}
  };

  const saveCredentials = async () => {
    if (!host.trim() || !mountpoint.trim()) {
      Alert.alert('Required', 'Host and mountpoint are required.');
      return;
    }
    const creds = {
      host: host.trim(),
      port: parseInt(port) || 2101,
      mountpoint: mountpoint.trim(),
      username: username.trim() || undefined,
      password: password || undefined,
    };
    driver.setNtripCredentials(creds);
    await SecureStore.setItemAsync(NTRIP_STORAGE, JSON.stringify(creds));
    await haptics.success();
    Alert.alert('Saved', 'NTRIP credentials saved.');
  };

  const testConnection = async () => {
    if (!host.trim() || !mountpoint.trim()) {
      Alert.alert('Required', 'Enter host and mountpoint first.');
      return;
    }
    setTesting(true);
    try {
      driver.setNtripCredentials({
        host: host.trim(),
        port: parseInt(port) || 2101,
        mountpoint: mountpoint.trim(),
        username: username.trim() || undefined,
        password: password || undefined,
      });
      await driver.getNtripClient().connect();
      setConnected(true);
      await haptics.success();
      Alert.alert(
        'Connected',
        `NTRIP stream active.\nMountpoint: ${mountpoint}\nMessages received: ${driver.getNtripClient().stats.messagesReceived}`
      );
    } catch (err: any) {
      await haptics.error();
      Alert.alert('Connection failed', err.message);
      setConnected(false);
    } finally {
      setTesting(false);
    }
  };

  const scanForReceivers = async () => {
    setScanning(true);
    setReceivers([]);
    try {
      await driver.scanForReceivers((receiver) => {
        setReceivers((prev) => {
          if (prev.find(r => r.id === receiver.id)) return prev;
          return [...prev, receiver];
        });
      }, 10000);
    } catch (err: any) {
      Alert.alert('Scan failed', err.message);
    } finally {
      setScanning(false);
    }
  };

  const connectReceiver = async (receiver: GnssReceiver) => {
    try {
      await driver.connectReceiver(receiver);
      setConnectedReceiver(receiver);
      await haptics.success();
      Alert.alert('Connected', `Connected to ${receiver.name}.\nReceiving NTRIP corrections.`);
    } catch (err: any) {
      await haptics.error();
      Alert.alert('Connection failed', err.message);
    }
  };

  const applyPreset = (preset: typeof KENYA_CORS_PRESETS[0]) => {
    setHost(preset.host);
    setPort(String(preset.port));
    setMountpoint(preset.mountpoint);
  };

  const solutionColor = livePosition?.solutionType === 'fixed' ? Colors.success :
                        livePosition?.solutionType === 'float' ? Colors.warning :
                        livePosition?.solutionType === 'dgps' ? Colors.info :
                        Colors.danger;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.metarduCream }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.metarduNavy} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>GNSS / RTK</Text>
          <Text style={styles.subtitle}>NTRIP corrections + external receivers</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Live position card */}
        <Card style={[styles.positionCard, { borderLeftColor: solutionColor }]}>
          <View style={styles.positionHeader}>
            <MaterialCommunityIcons name="crosshairs-gps" size={22} color={solutionColor} />
            <Text style={styles.positionTitle}>Live Position</Text>
            {livePosition && (
              <View style={[styles.solBadge, { backgroundColor: `${solutionColor}20` }]}>
                <Text style={[styles.solText, { color: solutionColor }]}>
                  {livePosition.solutionType.toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          {livePosition ? (
            <View>
              <Text style={styles.positionCoords}>
                {livePosition.latitude.toFixed(7)}, {livePosition.longitude.toFixed(7)}
              </Text>
              <View style={styles.positionStats}>
                <PosStat label="Height" value={`${livePosition.height.toFixed(2)}m`} />
                <PosStat label="Accuracy" value={`±${livePosition.accuracy.toFixed(2)}m`} />
                <PosStat label="Sats" value={String(livePosition.numSatellites)} />
                <PosStat label="HDOP" value={livePosition.hdop?.toFixed(1) ?? '—'} />
              </View>
              {livePosition.receiver && (
                <Text style={styles.positionReceiver}>
                  Source: {livePosition.receiver}
                </Text>
              )}
            </View>
          ) : (
            <Text style={styles.positionWaiting}>
              Waiting for position... {connectedReceiver ? 'Receiving from external receiver' : 'Using phone GPS'}
            </Text>
          )}
        </Card>

        {/* NTRIP settings */}
        <Text style={styles.sectionTitle}>NTRIP Source</Text>
        <Card style={{ marginBottom: 16 }}>
          <Text style={styles.cardTitle}>Kenya CORS Presets</Text>
          <View style={{ gap: 8 }}>
            {KENYA_CORS_PRESETS.map((preset, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => applyPreset(preset)}
                style={styles.presetRow}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.presetName}>{preset.name}</Text>
                  <Text style={styles.presetNote}>{preset.note}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.gray400} />
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <Text style={styles.cardTitle}>NTRIP Credentials</Text>
          <TextInput
            label="Host"
            value={host}
            onChangeText={setHost}
            placeholder="ntrip.ardhiasasa.land.go.ke"
            autoCapitalize="none"
            autoCorrect={false}
            required
          />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <TextInput
                label="Port"
                value={port}
                onChangeText={setPort}
                placeholder="2101"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 2 }}>
              <TextInput
                label="Mountpoint"
                value={mountpoint}
                onChangeText={setMountpoint}
                placeholder="RTCM31"
                autoCapitalize="none"
                autoCorrect={false}
                required
              />
            </View>
          </View>
          <TextInput
            label="Username (optional)"
            value={username}
            onChangeText={setUsername}
            placeholder="KENCORS username"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            label="Password (optional)"
            value={password}
            onChangeText={setPassword}
            placeholder="KENCORS password"
            secureTextEntry
          />

          <View style={styles.buttonRow}>
            <Button
              title="Save"
              variant="outline"
              onPress={saveCredentials}
              style={{ flex: 1 }}
            />
            <Button
              title={testing ? 'Testing...' : 'Test Connection'}
              onPress={testConnection}
              loading={testing}
              style={{ flex: 1 }}
            />
          </View>

          {connected && (
            <View style={styles.connectedBanner}>
              <MaterialCommunityIcons name="check-circle" size={16} color={Colors.success} />
              <Text style={styles.connectedText}>NTRIP stream active</Text>
            </View>
          )}
        </Card>

        {/* BLE receivers */}
        <Text style={styles.sectionTitle}>External GNSS Receiver</Text>
        <Card style={{ marginBottom: 16 }}>
          <Text style={styles.cardTitle}>Bluetooth Receivers</Text>
          <Text style={styles.helpText}>
            Pair your GNSS receiver (u-blox, Emlid Reach, Trimble R2) in Bluetooth settings first,
            then scan to connect.
          </Text>

          <Button
            title={scanning ? 'Scanning...' : 'Scan for Receivers'}
            onPress={scanForReceivers}
            loading={scanning}
            fullWidth
            icon={<MaterialCommunityIcons name="bluetooth-search" size={18} color={Colors.metarduWhite} />}
          />

          {receivers.length > 0 && (
            <View style={{ gap: 8, marginTop: 12 }}>
              {receivers.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  onPress={() => connectReceiver(r)}
                  style={[
                    styles.receiverRow,
                    connectedReceiver?.id === r.id && { borderColor: Colors.success, borderWidth: 2 },
                  ]}
                >
                  <View style={[styles.receiverIcon, { backgroundColor: `${Colors.info}15` }]}>
                    <MaterialCommunityIcons name="antenna" size={20} color={Colors.info} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.receiverName}>{r.name}</Text>
                    <Text style={styles.receiverBrand}>{r.brand}</Text>
                  </View>
                  {connectedReceiver?.id === r.id ? (
                    <MaterialCommunityIcons name="check-circle" size={20} color={Colors.success} />
                  ) : (
                    <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.gray400} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {connectedReceiver && (
            <View style={styles.connectedBanner}>
              <MaterialCommunityIcons name="check-circle" size={16} color={Colors.success} />
              <Text style={styles.connectedText}>
                Connected to {connectedReceiver.name} — receiving corrections
              </Text>
            </View>
          )}
        </Card>

        {/* Accuracy comparison */}
        <Card variant="outline">
          <Text style={styles.cardTitle}>Accuracy Comparison</Text>
          <View style={styles.compareRow}>
            <MaterialCommunityIcons name="cellphone" size={20} color={Colors.danger} />
            <View style={{ flex: 1 }}>
              <Text style={styles.compareLabel}>Phone GPS only</Text>
              <Text style={styles.compareValue}>3-5m horizontal</Text>
            </View>
          </View>
          <View style={styles.compareRow}>
            <MaterialCommunityIcons name="antenna" size={20} color={Colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.compareLabel}>External receiver, no NTRIP</Text>
              <Text style={styles.compareValue}>1-3m horizontal</Text>
            </View>
          </View>
          <View style={styles.compareRow}>
            <MaterialCommunityIcons name="check-decagram" size={20} color={Colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.compareLabel}>RTK Fixed (receiver + NTRIP)</Text>
              <Text style={styles.compareValue}>1-2cm horizontal ✓ survey-grade</Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function PosStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.posStat}>
      <Text style={styles.posStatValue}>{value}</Text>
      <Text style={styles.posStatLabel}>{label}</Text>
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
    color: Colors.metarduNavy,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.gray500,
    marginTop: 2,
  },
  positionCard: {
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  positionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  positionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.metarduNavy,
  },
  solBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  solText: {
    fontSize: 10,
    fontWeight: '700',
  },
  positionCoords: {
    fontSize: 14,
    color: Colors.metarduNavy,
    fontFamily: 'JetBrainsMono',
    marginBottom: 8,
  },
  positionStats: {
    flexDirection: 'row',
    gap: 8,
  },
  posStat: {
    flex: 1,
  },
  posStatValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.metarduNavy,
    fontFamily: 'JetBrainsMono',
  },
  posStatLabel: {
    fontSize: 9,
    color: Colors.gray500,
    textTransform: 'uppercase',
  },
  positionReceiver: {
    fontSize: 11,
    color: Colors.metarduOrange,
    marginTop: 8,
    fontStyle: 'italic',
  },
  positionWaiting: {
    fontSize: 13,
    color: Colors.gray500,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.metarduNavy,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.gray200,
  },
  presetName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.metarduNavy,
  },
  presetNote: {
    fontSize: 11,
    color: Colors.gray500,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  connectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${Colors.success}15`,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
  },
  connectedText: {
    flex: 1,
    fontSize: 12,
    color: Colors.success,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 12,
    color: Colors.gray500,
    lineHeight: 17,
    marginBottom: 12,
  },
  receiverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.gray200,
    backgroundColor: Colors.metarduWhite,
  },
  receiverIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiverName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.metarduNavy,
  },
  receiverBrand: {
    fontSize: 11,
    color: Colors.gray500,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.gray200,
  },
  compareLabel: {
    fontSize: 13,
    color: Colors.metarduNavy,
    fontWeight: '500',
  },
  compareValue: {
    fontSize: 11,
    color: Colors.gray500,
    marginTop: 2,
    fontFamily: 'JetBrainsMono',
  },
});
