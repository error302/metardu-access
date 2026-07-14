/**
 * New Project screen — survey type selection + project details form.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Colors, SurveyTypeConfig } from '@/theme';
import { Card } from '@/components/Card';
import { TextInput } from '@/components/TextInput';
import { Button } from '@/components/Button';
import { useProjectStore } from '@/stores/projectStore';
import type { SurveyType } from '@/types';

const KENYA_COUNTIES = [
  'Nairobi', 'Kiambu', 'Machakos', 'Kajiado', 'Murang\'a', 'Nyandarua',
  'Nakuru', 'Uasin Gishu', 'Kakamega', 'Kisumu', 'Mombasa', 'Kilifi',
  'Nyeri', 'Meru', 'Kericho', 'Bomet', 'Bungoma', 'Busia', 'Embu',
  'Tharaka-Nithi', 'Trans Nzoia', 'West Pokot', 'Turkana', 'Marsabit',
  'Isiolo', 'Garissa', 'Wajir', 'Mandera', 'Tana River', 'Lamu',
  'Taita-Taveta', 'Kwale', 'Narok', 'Baringo', 'Elgeyo-Marakwet',
  'Nandi', 'Laikipia', 'Vihiga', 'Siaya', 'Homa Bay', 'Migori',
  'Kisii', 'Nyamira', 'Kirinyaga', 'Samburu', 'Kitui', 'Makueni',
];

export default function NewProjectScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const create = useProjectStore((s) => s.create);

  const [step, setStep] = useState<'type' | 'details'>(params.type ? 'details' : 'type');
  const [surveyType, setSurveyType] = useState<SurveyType | null>(
    (params.type as SurveyType) ?? null
  );
  const [name, setName] = useState('');
  const [county, setCounty] = useState('');
  const [subCounty, setSubCounty] = useState('');
  const [lrNumber, setLrNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (params.type) {
      setSurveyType(params.type as SurveyType);
      setStep('details');
    }
  }, [params.type]);

  const handleCreate = async () => {
    if (!surveyType) {
      Alert.alert('Select survey type', 'Please choose a survey type first.');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Project name required', 'Please enter a project name.');
      return;
    }
    setCreating(true);
    try {
      const project = await create({
        name: name.trim(),
        surveyType,
        county: county.trim() || undefined,
        subCounty: subCounty.trim() || undefined,
        lrNumber: lrNumber.trim() || undefined,
        clientName: clientName.trim() || undefined,
        clientContact: clientContact.trim() || undefined,
      });
      router.replace(`/projects/${project.id}`);
    } catch (err: any) {
      Alert.alert('Failed', err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.metarduCream }} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {/* Step indicator */}
          <View style={styles.stepsRow}>
            <StepIndicator number={1} label="Survey Type" active={step === 'type'} done={step === 'details'} />
            <View style={styles.stepDivider} />
            <StepIndicator number={2} label="Project Details" active={step === 'details'} done={false} />
          </View>

          {step === 'type' && (
            <View style={{ gap: 12 }}>
              <Text style={styles.sectionTitle}>{t('projects.selectSurveyType')}</Text>
              {(['cadastral', 'engineering', 'topographic', 'sectional'] as SurveyType[]).map((type) => {
                const config = SurveyTypeConfig[type];
                const selected = surveyType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    onPress={() => {
                      setSurveyType(type);
                      setStep('details');
                    }}
                  >
                    <Card variant={selected ? 'elevated' : 'default'} style={[
                      styles.typeCard,
                      selected && { borderColor: config.color, borderWidth: 2 },
                    ]}>
                      <View style={styles.typeRow}>
                        <View style={[styles.typeIcon, { backgroundColor: `${config.color}20` }]}>
                          <MaterialCommunityIcons name={config.icon as any} size={28} color={config.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.typeLabel}>{config.label}</Text>
                          <Text style={styles.typeDesc}>
                            {type === 'cadastral' && 'Boundary surveys, parcel definition, deed plans, NLIMS submission'}
                            {type === 'engineering' && 'Road design, leveling, setting out, as-built verification, earthworks'}
                            {type === 'topographic' && 'Feature survey, TIN, contours, GNSS RTK, drone support'}
                            {type === 'sectional' && 'Sectional Properties Act 2020 — units, floors, exclusive use areas'}
                          </Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={22} color={Colors.gray400} />
                      </View>
                    </Card>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {step === 'details' && (
            <View>
              <Card style={{ marginBottom: 16 }}>
                <View style={styles.selectedTypeRow}>
                  {surveyType && (
                    <>
                      <MaterialCommunityIcons
                        name={SurveyTypeConfig[surveyType].icon as any}
                        size={20}
                        color={SurveyTypeConfig[surveyType].color}
                      />
                      <Text style={styles.selectedTypeText}>
                        {SurveyTypeConfig[surveyType].label}
                      </Text>
                    </>
                  )}
                  <TouchableOpacity onPress={() => setStep('type')}>
                    <Text style={styles.changeText}>Change</Text>
                  </TouchableOpacity>
                </View>
              </Card>

              <TextInput
                label={t('projects.projectName')}
                value={name}
                onChangeText={setName}
                placeholder="e.g. LR 12345/6 Boundary Survey"
                required
              />

              <Text style={styles.label}>{t('projects.county')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {KENYA_COUNTIES.slice(0, 12).map((c) => (
                    <TouchableOpacity
                      key={c}
                      onPress={() => setCounty(c)}
                      style={[
                        styles.chip,
                        county === c && styles.chipActive,
                      ]}
                    >
                      <Text style={[styles.chipText, county === c && styles.chipTextActive]}>
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              {county && (
                <TextInput
                  label={t('projects.subCounty')}
                  value={subCounty}
                  onChangeText={setSubCounty}
                  placeholder="e.g. Kasarani"
                />
              )}

              {surveyType === 'cadastral' && (
                <TextInput
                  label={t('projects.lrNumber')}
                  value={lrNumber}
                  onChangeText={setLrNumber}
                  placeholder="e.g. 2090/12345"
                  hint="Land Reference number from the mother title"
                />
              )}

              <TextInput
                label={t('projects.clientName')}
                value={clientName}
                onChangeText={setClientName}
                placeholder="Optional"
              />
              <TextInput
                label={t('projects.clientContact')}
                value={clientContact}
                onChangeText={setClientContact}
                placeholder="Phone or email"
                keyboardType="phone-pad"
              />

              <View style={styles.buttonRow}>
                <Button
                  title={t('common.back')}
                  variant="outline"
                  onPress={() => setStep('type')}
                  style={{ flex: 1 }}
                />
                <Button
                  title={t('projects.create')}
                  onPress={handleCreate}
                  loading={creating}
                  style={{ flex: 2 }}
                />
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StepIndicator({ number, label, active, done }: { number: number; label: string; active: boolean; done: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <View
        style={[
          styles.stepCircle,
          active && styles.stepCircleActive,
          done && styles.stepCircleDone,
        ]}
      >
        <Text style={[
          styles.stepNumber,
          (active || done) && styles.stepNumberActive,
        ]}>
          {done ? '✓' : number}
        </Text>
      </View>
      <Text style={[
        styles.stepLabel,
        (active || done) && styles.stepLabelActive,
      ]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.gray200,
  },
  stepCircleActive: {
    borderColor: Colors.metarduOrange,
    backgroundColor: `${Colors.metarduOrange}20`,
  },
  stepCircleDone: {
    backgroundColor: Colors.metarduOrange,
    borderColor: Colors.metarduOrange,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gray500,
  },
  stepNumberActive: {
    color: Colors.metarduWhite,
  },
  stepLabel: {
    fontSize: 11,
    color: Colors.gray500,
  },
  stepLabelActive: {
    color: Colors.metarduNavy,
    fontWeight: '600',
  },
  stepDivider: {
    width: 60,
    height: 2,
    backgroundColor: Colors.gray200,
    marginHorizontal: 12,
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.metarduNavy,
    marginBottom: 8,
  },
  typeCard: {
    padding: 16,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  typeIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.metarduNavy,
    marginBottom: 2,
  },
  typeDesc: {
    fontSize: 12,
    color: Colors.gray500,
    lineHeight: 16,
  },
  selectedTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedTypeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.metarduNavy,
  },
  changeText: {
    color: Colors.metarduOrange,
    fontSize: 13,
    fontWeight: '500',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.metarduNavy,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: Colors.metarduWhite,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  chipActive: {
    backgroundColor: Colors.metarduNavy,
    borderColor: Colors.metarduNavy,
  },
  chipText: {
    fontSize: 13,
    color: Colors.metarduNavy,
  },
  chipTextActive: {
    color: Colors.metarduWhite,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
});
