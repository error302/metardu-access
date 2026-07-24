/**
 * Engineering Road Design — horizontal curve calculator using the engine.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Card } from '@/components/Card';
import { TextInput } from '@/components/TextInput';
import { Button } from '@/components/Button';
import { useThemeColors } from '@/hooks/useThemeColors';
import {
  horizontalCurve,
  curveDeflections,
  type HorizontalCurve,
} from '@engine/curves';

export default function RoadDesignScreen() {
  const Colors = useThemeColors();
  const router = useRouter();

  const [piEasting, setPiEasting] = useState('');
  const [piNorthing, setPiNorthing] = useState('');
  const [backBearing, setBackBearing] = useState('');
  const [forwardBearing, setForwardBearing] = useState('');
  const [radius, setRadius] = useState('200');
  const [interval, setInterval] = useState('10');
  const [curve, setCurve] = useState<HorizontalCurve | null>(null);
  const [deflections, setDeflections] = useState<
    { station: number; deflectionAngle: number; chordLength: number }[]
  >([]);

  const compute = () => {
    const pe = parseFloat(piEasting);
    const pn = parseFloat(piNorthing);
    const bb = parseFloat(backBearing);
    const fb = parseFloat(forwardBearing);
    const r = parseFloat(radius);
    const iv = parseFloat(interval);

    if ([pe, pn, bb, fb, r].some(isNaN)) return;

    const result = horizontalCurve(
      { easting: pe, northing: pn },
      bb,
      fb,
      r
    );
    setCurve(result);
    setDeflections(curveDeflections(result, isNaN(iv) ? 10 : iv));
  };

  const handleShare = async () => {
    if (!curve) return;
    const text = [
      `METARDU ACCESS — HORIZONTAL CURVE REPORT`,
      ``,
      `PI: E ${curve.PI.easting.toFixed(3)}, N ${curve.PI.northing.toFixed(3)}`,
      `Back tangent bearing:    ${curve.backTangentBearing.toFixed(4)}°`,
      `Forward tangent bearing: ${curve.forwardTangentBearing.toFixed(4)}°`,
      `Radius:                  ${curve.radius.toFixed(3)} m`,
      `Deflection angle:        ${curve.deflectionAngle.toFixed(4)}°`,
      ``,
      `GEOMETRY`,
      `  Tangent length:  ${curve.tangentLength.toFixed(3)} m`,
      `  Arc length:      ${curve.arcLength.toFixed(3)} m`,
      `  Chord length:    ${curve.chordLength.toFixed(3)} m`,
      `  Degree of curve: ${curve.degreeOfCurve.toFixed(4)}° / 30m`,
      `  Mid-ordinate:    ${curve.midOrdinate.toFixed(3)} m`,
      `  External dist:   ${curve.externalDistance.toFixed(3)} m`,
      ``,
      `PC: E ${curve.PC.easting.toFixed(3)}, N ${curve.PC.northing.toFixed(3)}`,
      `PT: E ${curve.PT.easting.toFixed(3)}, N ${curve.PT.northing.toFixed(3)}`,
      ``,
      `SETTING-OUT TABLE (deflection method, ${interval}m intervals)`,
      `Station (m)  | Deflection (°) | Chord (m)`,
      ...deflections.map(d =>
        `${d.station.toFixed(2).padStart(10)}  | ${d.deflectionAngle.toFixed(4).padStart(13)} | ${d.chordLength.toFixed(3).padStart(8)}`
      ),
    ].join('\n');
    await Share.share({ message: text });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={'#0B1F3A'} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Road Design</Text>
          <Text style={styles.subtitle}>Horizontal curve calculator</Text>
        </View>
        {curve && (
          <TouchableOpacity onPress={handleShare} style={{ padding: 8 }}>
            <MaterialCommunityIcons name="share-variant" size={18} color={'#F97316'} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Card style={{ marginBottom: 16 }}>
          <Text style={styles.cardTitle}>Point of Intersection (PI)</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <TextInput
                label="PI Easting"
                value={piEasting}
                onChangeText={setPiEasting}
                keyboardType="decimal-pad"
                placeholder="e.g. 254500.000"
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextInput
                label="PI Northing"
                value={piNorthing}
                onChangeText={setPiNorthing}
                keyboardType="decimal-pad"
                placeholder="e.g. 9857200.000"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <TextInput
                label="Back Tangent Bearing (°)"
                value={backBearing}
                onChangeText={setBackBearing}
                keyboardType="decimal-pad"
                placeholder="e.g. 45.0000"
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextInput
                label="Forward Tangent Bearing (°)"
                value={forwardBearing}
                onChangeText={setForwardBearing}
                keyboardType="decimal-pad"
                placeholder="e.g. 95.0000"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <TextInput
                label="Radius (m)"
                value={radius}
                onChangeText={setRadius}
                keyboardType="decimal-pad"
                placeholder="200"
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextInput
                label="Setting-out Interval (m)"
                value={interval}
                onChangeText={setInterval}
                keyboardType="decimal-pad"
                placeholder="10"
              />
            </View>
          </View>

          <Button title="Compute Curve" onPress={compute} fullWidth />
        </Card>

        {curve && (
          <>
            {/* Curve geometry */}
            <Card style={{ marginBottom: 16 }}>
              <Text style={styles.cardTitle}>Curve Geometry</Text>
              <DetailRow label="Deflection angle" value={`${curve.deflectionAngle.toFixed(4)}°`} />
              <DetailRow label="Tangent length (T)" value={`${curve.tangentLength.toFixed(3)} m`} />
              <DetailRow label="Arc length (L)" value={`${curve.arcLength.toFixed(3)} m`} />
              <DetailRow label="Chord length (C)" value={`${curve.chordLength.toFixed(3)} m`} />
              <DetailRow label="Degree of curve" value={`${curve.degreeOfCurve.toFixed(4)}° / 30m`} />
              <DetailRow label="Mid-ordinate (M)" value={`${curve.midOrdinate.toFixed(3)} m`} />
              <DetailRow label="External distance (E)" value={`${curve.externalDistance.toFixed(3)} m`} />
            </Card>

            {/* PC and PT */}
            <Card style={{ marginBottom: 16 }}>
              <Text style={styles.cardTitle}>Key Points</Text>
              <View style={styles.pointRow}>
                <View style={[styles.pointIcon, { backgroundColor: #F9731615 }]}>
                  <Text style={[styles.pointLetter, { color: '#F97316' }]}>PC</Text>
                </View>
                <View>
                  <Text style={styles.pointName}>Point of Curve (start)</Text>
                  <Text style={styles.pointCoords}>
                    E: {curve.PC.easting.toFixed(3)}    N: {curve.PC.northing.toFixed(3)}
                  </Text>
                </View>
              </View>
              <View style={styles.pointRow}>
                <View style={[styles.pointIcon, { backgroundColor: #3B82F615 }]}>
                  <Text style={[styles.pointLetter, { color: '#3B82F6' }]}>PI</Text>
                </View>
                <View>
                  <Text style={styles.pointName}>Point of Intersection</Text>
                  <Text style={styles.pointCoords}>
                    E: {curve.PI.easting.toFixed(3)}    N: {curve.PI.northing.toFixed(3)}
                  </Text>
                </View>
              </View>
              <View style={styles.pointRow}>
                <View style={[styles.pointIcon, { backgroundColor: #10B98115 }]}>
                  <Text style={[styles.pointLetter, { color: '#10B981' }]}>PT</Text>
                </View>
                <View>
                  <Text style={styles.pointName}>Point of Tangent (end)</Text>
                  <Text style={styles.pointCoords}>
                    E: {curve.PT.easting.toFixed(3)}    N: {curve.PT.northing.toFixed(3)}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Setting-out table */}
            <Card>
              <Text style={styles.cardTitle}>Setting-Out Table (Deflection Method)</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1 }]}>Station (m)</Text>
                <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1 }]}>Deflection (°)</Text>
                <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1 }]}>Chord (m)</Text>
              </View>
              {deflections.map((d, i) => (
                <View key={i} style={[styles.tableRow, i % 2 === 0 ? styles.tableRowAlt : null]}>
                  <Text style={[styles.tableCell, { flex: 1 }]}>{d.station.toFixed(2)}</Text>
                  <Text style={[styles.tableCell, { flex: 1, color: '#F97316', fontWeight: '600' }]}>
                    {d.deflectionAngle.toFixed(4)}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 1 }]}>{d.chordLength.toFixed(3)}</Text>
                </View>
              ))}
            </Card>

            <Button
              title="Share Report"
              onPress={handleShare}
              variant="outline"
              style={{ marginTop: 16 }}
              icon={<MaterialCommunityIcons name="share-variant" size={18} color={'#0B1F3A'} />}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
    color: Colors.fgMuted,
    marginTop: 2,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0B1F3A',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  detailLabel: {
    fontSize: 13,
    color: Colors.fgMuted,
  },
  detailValue: {
    fontSize: 13,
    color: '#0B1F3A',
    fontWeight: '600',
    fontFamily: 'JetBrainsMono',
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  pointIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointLetter: {
    fontSize: 14,
    fontWeight: '700',
  },
  pointName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0B1F3A',
  },
  pointCoords: {
    fontSize: 11,
    color: Colors.fgMuted,
    fontFamily: 'JetBrainsMono',
    marginTop: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: '#0B1F3A',
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0B1F3A',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  tableRowAlt: {
    backgroundColor: '#F9FAFB',
  },
  tableCell: {
    fontSize: 12,
    color: '#0B1F3A',
    fontFamily: 'JetBrainsMono',
  },
});
