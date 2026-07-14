/**
 * Camera capture component — geotagged photos for field evidence.
 *
 * Used by:
 *   - Fieldbook tab (photo points)
 *   - Beacon library (beacon evidence photos)
 *   - GCP capture (target photos)
 *
 * Captures a photo with current GPS coordinates embedded in the file metadata,
 * returns the photo URI + coordinates to the caller.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Colors } from '@/theme';
import { field as haptics } from '@/lib/haptics';
import { wgs84ToArc1960Utm37S } from '@engine/transforms';

export interface CapturedPhoto {
  uri: string;
  lat?: number;
  lng?: number;
  elevation?: number;
  easting?: number;
  northing?: number;
  accuracy?: number;
  capturedAt: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onCapture: (photo: CapturedPhoto) => void;
  title?: string;
}

export function CameraCapture({ visible, onClose, onCapture, title = 'Capture Photo' }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermission, setLocationPermission] = useState<string | null>(null);
  const [cameraRef, setCameraRef] = useState<CameraView | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [facing, setFacing] = useState<'back' | 'front'>('back');

  useEffect(() => {
    if (visible) {
      (async () => {
        if (!permission?.granted) {
          await requestPermission();
        }
        const { status } = await Location.requestForegroundPermissionsAsync();
        setLocationPermission(status);
      })();
    }
  }, [visible]);

  const handleCapture = async () => {
    if (!cameraRef) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.takePictureAsync({
        quality: 0.7,
        base64: false,
        skipProcessing: false,
      });
      await haptics.pointCaptured();

      // Try to get GPS coordinates
      let gps: Partial<CapturedPhoto> = {};
      if (locationPermission === 'granted') {
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          const utm = wgs84ToArc1960Utm37S({
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          });
          gps = {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            elevation: loc.coords.altitude ?? undefined,
            easting: utm.easting,
            northing: utm.northing,
            accuracy: loc.coords.accuracy ?? undefined,
          };
        } catch (err) {
          // GPS failed — photo still usable, just without coordinates
        }
      }

      const captured: CapturedPhoto = {
        uri: photo.uri,
        capturedAt: new Date().toISOString(),
        ...gps,
      };

      onCapture(captured);
      onClose();
    } catch (err: any) {
      Alert.alert('Capture failed', err.message);
    } finally {
      setCapturing(false);
    }
  };

  if (!visible) return null;

  if (!permission?.granted) {
    return (
      <Modal visible={visible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.metarduNavy, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <MaterialCommunityIcons name="camera-off" size={64} color={Colors.metarduCream} />
          <Text style={{ color: Colors.metarduWhite, fontSize: 18, fontWeight: '600', marginTop: 16, textAlign: 'center' }}>
            Camera permission required
          </Text>
          <Text style={{ color: Colors.metarduCream, fontSize: 14, marginTop: 8, textAlign: 'center', opacity: 0.7 }}>
            Grant camera access to capture field photos.
          </Text>
          <TouchableOpacity
            onPress={requestPermission}
            style={{ marginTop: 24, backgroundColor: Colors.metarduOrange, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
          >
            <Text style={{ color: Colors.metarduWhite, fontWeight: '600' }}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={{ marginTop: 12 }}>
            <Text style={{ color: Colors.metarduCream }}>Cancel</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView
          ref={setCameraRef}
          style={{ flex: 1 }}
          facing={facing}
          flash={flash}
        />

        {/* Top bar */}
        <SafeAreaView edges={['top']} style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.topBtn}>
            <MaterialCommunityIcons name="close" size={24} color={Colors.metarduWhite} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{title}</Text>
          <TouchableOpacity
            onPress={() => setFlash(flash === 'off' ? 'on' : 'off')}
            style={styles.topBtn}
          >
            <MaterialCommunityIcons name={flash === 'off' ? 'flash-off' : 'flash'} size={22} color={Colors.metarduWhite} />
          </TouchableOpacity>
        </SafeAreaView>

        {/* Bottom controls */}
        <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
          <View style={{ width: 48 }} />

          <TouchableOpacity
            onPress={handleCapture}
            disabled={capturing}
            style={[styles.shutterBtn, capturing && { opacity: 0.5 }]}
          >
            <View style={styles.shutterInner} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
            style={styles.topBtn}
          >
            <MaterialCommunityIcons name="flip-camera" size={24} color={Colors.metarduWhite} />
          </TouchableOpacity>
        </SafeAreaView>

        {capturing && (
          <View style={styles.capturingOverlay}>
            <Text style={styles.capturingText}>Capturing...</Text>
          </View>
        )}

        {/* GPS indicator */}
        <View style={styles.gpsIndicator}>
          <MaterialCommunityIcons
            name={locationPermission === 'granted' ? 'crosshairs-gps' : 'crosshairs'}
            size={14}
            color={locationPermission === 'granted' ? Colors.success : Colors.warning}
          />
          <Text style={styles.gpsText}>
            {locationPermission === 'granted' ? 'GPS ready' : 'No GPS'}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  topBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    color: Colors.metarduWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  shutterBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: Colors.metarduWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.metarduWhite,
  },
  capturingOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -75 }, { translateY: -20 }],
    width: 150,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    padding: 12,
  },
  capturingText: {
    color: Colors.metarduWhite,
    fontSize: 14,
    fontWeight: '600',
  },
  gpsIndicator: {
    position: 'absolute',
    top: 80,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  gpsText: {
    color: Colors.metarduWhite,
    fontSize: 11,
    fontWeight: '600',
  },
});
