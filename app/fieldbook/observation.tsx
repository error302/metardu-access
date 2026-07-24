/**
 * Observation entry — total station observation form.
 * Records: from-station, to-station, horizontal angle, vertical angle, slope distance, face.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/Card';
import { TextInput } from '@/components/TextInput';
import { Button } from '@/components/Button';
import { addObservation, getProject } from '@/lib/db/queries';
import { useProjectStore } from '@/stores/projectStore';
import type { ObservationFace } from '@/types';

export default function ObservationEntryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();

  const [fromPoint, setFromPoint] = useState('');
  const [toPoint, setToPoint] = useState('');
  const [horizontalAngle, setHorizontalAngle] = useState('');
  const [verticalAngle, setVerticalAngle] = useState('');
  const [slopeDistance, setSlopeDistance] = useState('');
  const [face, setFace] = useState<ObservationFace>('left');
  const [instrumentHeight, setInstrumentHeight] = useState('1.500');
  const [targetHeight, setTargetHeight] = useState('1.500');
  const [temperature, setTemperature] = useState('20');
  const [pressure, setPressure] = useState('1013');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!projectId) {
      Alert.alert('Error', 'No project selected');
      return;
    }
    if (!fromPoint.trim() || !toPoint.trim()) {
      Alert.alert('Required', 'From and To station numbers are required.');
      return;
    }

    setSaving(true);
    try {
      await addObservation({
        sessionId: projectId, // use project id as session placeholder
        projectId,
        fromPoint: fromPoint.trim(),
        toPoint: toPoint.trim(),
        type: 'angle_distance',
        rawHorizontalAngle: horizontalAngle ? parseFloat(horizontalAngle) : undefined,
        rawVerticalAngle: verticalAngle ? parseFloat(verticalAngle) : undefined,
        rawSlopeDistance: slopeDistance ? parseFloat(slopeDistance) : undefined,
        face,
        instrumentHeight: instrumentHeight ? parseFloat(instrumentHeight) : undefined,
        targetHeight: targetHeight ? parseFloat(targetHeight) : undefined,
        temperatureC: temperature ? parseFloat(temperature) : undefined,
        pressurehPa: pressure ? parseFloat(pressure) : undefined,
      });
      Alert.alert('Saved', `Observation ${fromPoint} → ${toPoint} recorded.`);
      // Reset for next observation
      setToPoint('');
      setHorizontalAngle('');
      setVerticalAngle('');
      setSlopeDistance('');
      // Keep from-point and instrument setup
    } catch (err: any) {
      Alert.alert('Failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF7F2' }} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <MaterialCommunityIcons name="arrow-left" size={22} color={'#0B1F3A'} />
            </TouchableOpacity>
            <Text style={styles.title}>{t('fieldbook.addObservation')}</Text>
          </View>

          {/* Station setup */}
          <Card style={{ marginBottom: 16 }}>
            <Text style={styles.cardTitle}>Station Setup</Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <TextInput
                  label={t('fieldbook.fromPoint')}
                  value={fromPoint}
                  onChangeText={setFromPoint}
                  placeholder="STN-001"
                  required
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextInput
                  label={t('fieldbook.toPoint')}
                  value={toPoint}
                  onChangeText={setToPoint}
                  placeholder="STN-002"
                  required
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <TextInput
                  label="Instrument Height (m)"
                  value={instrumentHeight}
                  onChangeText={setInstrumentHeight}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextInput
                  label="Target Height (m)"
                  value={targetHeight}
                  onChangeText={setTargetHeight}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </Card>

          {/* Measurements */}
          <Card style={{ marginBottom: 16 }}>
            <Text style={styles.cardTitle}>Measurements</Text>

            {/* Face selector */}
            <Text style={styles.label}>{t('fieldbook.face')}</Text>
            <View style={styles.faceRow}>
              {(['left', 'right'] as ObservationFace[]).map((f) => (
                <TouchableOpacity
                  key={f}
                  onPress={() => setFace(f)}
                  style={[styles.faceBtn, face === f && styles.faceBtnActive]}
                >
                  <Text style={[styles.faceBtnText, face === f && styles.faceBtnTextActive]}>
                    {f === 'left' ? t('fieldbook.faceLeft') : t('fieldbook.faceRight')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              label={`${t('fieldbook.horizontalAngle')} (°)`}
              value={horizontalAngle}
              onChangeText={setHorizontalAngle}
              placeholder="e.g. 145.3214"
              keyboardType="decimal-pad"
            />
            <TextInput
              label={`${t('fieldbook.verticalAngle')} (°)`}
              value={verticalAngle}
              onChangeText={setVerticalAngle}
              placeholder="e.g. 90.0125"
              keyboardType="decimal-pad"
            />
            <TextInput
              label={`${t('fieldbook.slopeDistance')} (m)`}
              value={slopeDistance}
              onChangeText={setSlopeDistance}
              placeholder="e.g. 45.327"
              keyboardType="decimal-pad"
            />
          </Card>

          {/* Meteorological */}
          <Card style={{ marginBottom: 16 }}>
            <Text style={styles.cardTitle}>Meteorological Corrections</Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <TextInput
                  label="Temperature (°C)"
                  value={temperature}
                  onChangeText={setTemperature}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextInput
                  label="Pressure (hPa)"
                  value={pressure}
                  onChangeText={setPressure}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </Card>

          <Button
            title={t('fieldbook.saveObservation')}
            onPress={handleSave}
            loading={saving}
            fullWidth
            size="lg"
          />

          <Button
            title="Done"
            variant="ghost"
            onPress={() => router.back()}
            style={{ marginTop: 8 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0B1F3A',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0B1F3A',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0B1F3A',
    marginBottom: 6,
  },
  faceRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  faceBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceBtnActive: {
    borderColor: '#F97316',
    backgroundColor: #F9731615,
  },
  faceBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  faceBtnTextActive: {
    color: '#F97316',
    fontWeight: '600',
  },
});
