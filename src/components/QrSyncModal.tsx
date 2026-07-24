/**
 * QR Sync — scan a QR code displayed by the desktop app to quickly
 * configure the sync server URL + auth credentials.
 * Theme-aware.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  Share,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useThemeColors';
import { Button } from '@/components/Button';
import { TextInput } from '@/components/TextInput';
import { useAuthStore } from '@/stores/authStore';
import { getSyncEngine } from '@/lib/sync/engine';
import { field as haptics } from '@/lib/haptics';
import * as SecureStore from 'expo-secure-store';

export function QrSyncModal({
  visible,
  onClose,
  onConfigured,
}: {
  visible: boolean;
  onClose: () => void;
  onConfigured?: () => void;
}) {
  const Colors = useThemeColors();
  const [manualSyncUrl, setManualSyncUrl] = useState('');
  const [manualAuthUrl, setManualAuthUrl] = useState('');
  const [manualApiKey, setManualApiKey] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [configuring, setConfiguring] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: Colors.overlay,
          justifyContent: 'flex-end',
        },
        sheet: {
          backgroundColor: Colors.bgElevated,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: 24,
          maxHeight: '90%',
        },
        handle: {
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: Colors.borderStrong,
          alignSelf: 'center',
          marginBottom: 16,
        },
        title: {
          fontSize: 20,
          fontWeight: '700',
          color: Colors.fg,
          marginBottom: 8,
        },
        subtitle: {
          fontSize: 13,
          color: Colors.fgMuted,
          lineHeight: 18,
          marginBottom: 24,
        },
        qrPlaceholder: {
          height: 240,
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor: Colors.borderStrong,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        },
        placeholderText: {
          fontSize: 12,
          color: Colors.fgMuted,
          textAlign: 'center',
          marginTop: 12,
        },
        orRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginVertical: 16,
        },
        divider: {
          flex: 1,
          height: 1,
          backgroundColor: Colors.border,
        },
        orText: {
          fontSize: 12,
          color: Colors.fgMuted,
          marginHorizontal: 12,
          fontWeight: '600',
        },
        generateRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          marginTop: 16,
          padding: 8,
        },
        generateText: {
          fontSize: 12,
          color: Colors.metarduOrange,
          fontWeight: '500',
        },
        buttonRow: {
          flexDirection: 'row',
          gap: 12,
          marginTop: 16,
        },
      }),
    [Colors]
  );

  const configure = async (payload: {
    syncUrl: string;
    authUrl: string;
    apiKey?: string;
    serverName?: string;
  }) => {
    setConfiguring(true);
    try {
      const engine = getSyncEngine();
      if (payload.apiKey) {
        await engine.setApiKey(payload.apiKey);
        const auth = useAuthStore.getState();
        if (auth.profile) {
          await auth.updateProfile({ apiKey: payload.apiKey });
        }
      }

      await SecureStore.setItemAsync('metardu_sync_api_url', payload.syncUrl);
      await SecureStore.setItemAsync('metardu_sync_auth_url', payload.authUrl);
      if (payload.serverName) {
        await SecureStore.setItemAsync('metardu_server_name', payload.serverName);
      }

      await haptics.success();
      Alert.alert(
        'Sync configured',
        `Server: ${payload.serverName ?? payload.syncUrl}\n${payload.apiKey ? 'API key set — you can sync now.' : 'Sign in to get an API key.'}`,
        [
          {
            text: 'OK',
            onPress: () => {
              onConfigured?.();
              onClose();
            },
          },
        ]
      );
    } catch (err: any) {
      await haptics.error();
      Alert.alert('Configuration failed', err.message);
    } finally {
      setConfiguring(false);
    }
  };

  const handleScanQR = async () => {
    try {
      const { default: BarCodeScanner } = await import('expo-barcode-scanner').catch(() => ({ default: null })) as any;
      if (!BarCodeScanner) {
        setShowManual(true);
        return;
      }
      Alert.alert(
        'QR Scanner',
        'Camera-based QR scanning requires expo-barcode-scanner. Using manual entry for now.',
        [{ text: 'OK', onPress: () => setShowManual(true) }]
      );
    } catch {
      setShowManual(true);
    }
  };

  const handleManualSave = () => {
    if (!manualSyncUrl.trim()) {
      Alert.alert('Required', 'Sync URL is required.');
      return;
    }
    configure({
      syncUrl: manualSyncUrl.trim(),
      authUrl: manualAuthUrl.trim() || manualSyncUrl.trim().replace(/\/sync\/?$/, '') + '/auth',
      apiKey: manualApiKey.trim() || undefined,
      serverName: 'Manual Config',
    });
  };

  const handleGeneratePayload = async () => {
    const engine = getSyncEngine();
    const syncUrl = (engine as any).apiUrl || 'http://localhost:8080/sync';
    const authUrl = syncUrl.replace(/\/sync\/?$/, '') + '/auth';
    const profile = useAuthStore.getState().profile;
    const payload = {
      type: 'metardu-sync',
      version: 1,
      syncUrl,
      authUrl,
      apiKey: profile?.apiKey,
      serverName: 'Metardu Access (this phone)',
    };
    await Share.share({ message: JSON.stringify(payload, null, 2) });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Configure Sync</Text>
          <Text style={styles.subtitle}>
            Scan the QR code displayed by the desktop app or mock server to
            configure sync automatically — no typing URLs required.
          </Text>

          {!showManual ? (
            <>
              <View style={styles.qrPlaceholder}>
                <MaterialCommunityIcons name="qr-code-scan" size={80} color={Colors.fg} />
                <Text style={styles.placeholderText}>
                  QR scanner would appear here{'\n'}(requires camera permission)
                </Text>
              </View>

              <Button
                title="Scan QR Code"
                onPress={handleScanQR}
                fullWidth
                size="lg"
                icon={<MaterialCommunityIcons name="camera" size={20} color={Colors.metarduWhite} />}
              />

              <View style={styles.orRow}>
                <View style={styles.divider} />
                <Text style={styles.orText}>OR</Text>
                <View style={styles.divider} />
              </View>

              <Button
                title="Enter Manually"
                variant="outline"
                onPress={() => setShowManual(true)}
                fullWidth
              />

              <TouchableOpacity onPress={handleGeneratePayload} style={styles.generateRow}>
                <MaterialCommunityIcons name="share-variant" size={14} color={Colors.metarduOrange} />
                <Text style={styles.generateText}>
                  Share this phone's config (for desktop pairing)
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TextInput
                label="Sync API URL"
                value={manualSyncUrl}
                onChangeText={setManualSyncUrl}
                placeholder="http://192.168.1.42:8080/sync"
                autoCapitalize="none"
                autoCorrect={false}
                required
              />
              <TextInput
                label="Auth URL (optional)"
                value={manualAuthUrl}
                onChangeText={setManualAuthUrl}
                placeholder="http://192.168.1.42:8080/auth"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                label="API Key (optional — skip login)"
                value={manualApiKey}
                onChangeText={setManualApiKey}
                placeholder="key_..."
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={styles.buttonRow}>
                <Button
                  title="Back"
                  variant="ghost"
                  onPress={() => setShowManual(false)}
                  style={{ flex: 1 }}
                />
                <Button
                  title={configuring ? 'Saving...' : 'Save'}
                  onPress={handleManualSave}
                  loading={configuring}
                  style={{ flex: 1 }}
                />
              </View>
            </>
          )}

          <Button
            title="Cancel"
            variant="ghost"
            onPress={onClose}
            style={{ marginTop: 8 }}
          />
        </View>
      </View>
    </Modal>
  );
}
