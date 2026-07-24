/**
 * Register screen — surveyor registration with ISK license number.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { LogoMark } from '@/components/LogoMark';
import { TextInput } from '@/components/TextInput';
import { Button } from '@/components/Button';
import { useAuthStore } from '@/stores/authStore';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const register = useAuthStore((s) => s.register);

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [iskNumber, setIskNumber] = useState('');
  const [firmName, setFirmName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!email || !fullName || !iskNumber || !password) {
      setError('All fields marked with * are required');
      return;
    }
    if (!iskNumber.match(/^ISK\/\d+/i)) {
      setError('ISK number must be in format "ISK/1234"');
      return;
    }
    setLoading(true);
    setError(null);
    const result = await register({ email, fullName, iskNumber, firmName, password });
    setLoading(false);
    if (result.ok) {
      router.replace('/(tabs)');
    } else {
      setError(result.error ?? 'Registration failed');
    }
  };

  return (
    <LinearGradient
      colors={['#0B1F3A', '#061122']}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, padding: 24 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <LogoMark size={64} />
              <Text style={styles.tagline}>{t('auth.registerSubtitle')}</Text>
            </View>

            <View style={styles.form}>
              <TextInput
                label={t('auth.fullName')}
                value={fullName}
                onChangeText={setFullName}
                placeholder="John Doe"
                required
              />
              <TextInput
                label={t('auth.email')}
                value={email}
                onChangeText={setEmail}
                placeholder="surveyor@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                required
              />
              <TextInput
                label={t('auth.iskNumber')}
                value={iskNumber}
                onChangeText={setIskNumber}
                placeholder="ISK/1234"
                autoCapitalize="characters"
                hint="Your Institution of Surveyors of Kenya license number"
                required
              />
              <TextInput
                label={t('auth.firmName')}
                value={firmName}
                onChangeText={setFirmName}
                placeholder="Optional"
              />
              <TextInput
                label={t('auth.password')}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                required
              />

              {error && (
                <View style={styles.errorBox}>
                  <MaterialCommunityIcons name="alert-circle" size={18} color={'#EF4444'} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Button
                title={t('auth.signUp')}
                onPress={handleRegister}
                loading={loading}
                fullWidth
                size="lg"
              />

              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account?</Text>
                <Button
                  title={t('auth.signIn')}
                  variant="ghost"
                  size="sm"
                  onPress={() => router.back()}
                  textStyle={{ color: '#F97316' }}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  tagline: {
    color: '#FAF7F2',
    fontSize: 14,
    marginTop: 8,
    opacity: 0.7,
  },
  form: {
    flex: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: #EF444420,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
  },
  footerText: {
    color: '#FAF7F2',
    fontSize: 14,
  },
});
