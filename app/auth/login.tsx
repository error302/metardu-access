/**
 * Login screen — surveyor sign-in.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Colors } from '@/theme';
import { LogoMark } from '@/components/LogoMark';
import { TextInput } from '@/components/TextInput';
import { Button } from '@/components/Button';
import { useAuthStore } from '@/stores/authStore';

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const signIn = useAuthStore((s) => s.signIn);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    setLoading(true);
    setError(null);
    const result = await signIn({ email, password });
    setLoading(false);
    if (result.ok) {
      router.replace('/(tabs)');
    } else {
      setError(result.error ?? 'Sign in failed');
    }
  };

  return (
    <LinearGradient
      colors={[Colors.metarduNavy, Colors.metarduNavyDark]}
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
              <LogoMark size={88} withWordmark />
              <Text style={styles.tagline}>{t('app.tagline')}</Text>
            </View>

            <View style={styles.form}>
              <Text style={styles.title}>{t('auth.welcomeBack')}</Text>
              <Text style={styles.subtitle}>{t('auth.signInSubtitle')}</Text>

              <TextInput
                label={t('auth.email')}
                value={email}
                onChangeText={setEmail}
                placeholder="surveyor@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TextInput
                label={t('auth.password')}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
              />

              {error && (
                <View style={styles.errorBox}>
                  <MaterialCommunityIcons name="alert-circle" size={18} color={Colors.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Button
                title={t('auth.signIn')}
                onPress={handleSignIn}
                loading={loading}
                fullWidth
                size="lg"
              />

              <View style={styles.demoNotice}>
                <MaterialCommunityIcons name="information-outline" size={14} color={Colors.metarduCream} />
                <Text style={styles.demoText}>{t('auth.demoModeNotice')}</Text>
              </View>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Don't have an account?</Text>
                <Button
                  title={t('auth.signUp')}
                  variant="ghost"
                  size="sm"
                  onPress={() => router.push('/auth/register')}
                  textStyle={{ color: Colors.metarduOrange }}
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
    paddingVertical: 32,
  },
  tagline: {
    color: Colors.metarduCream,
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 12,
    opacity: 0.7,
  },
  form: {
    flex: 1,
  },
  title: {
    color: Colors.metarduWhite,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: Colors.metarduCream,
    fontSize: 14,
    marginBottom: 32,
    opacity: 0.7,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${Colors.danger}20`,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 14,
    flex: 1,
  },
  demoNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    padding: 10,
    backgroundColor: `${Colors.metarduOrange}20`,
    borderRadius: 8,
  },
  demoText: {
    color: Colors.metarduCream,
    fontSize: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
  },
  footerText: {
    color: Colors.metarduCream,
    fontSize: 14,
  },
});
