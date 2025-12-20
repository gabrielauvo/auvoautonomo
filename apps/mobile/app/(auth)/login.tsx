/**
 * Login Screen
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Input, Card } from '../../src/design-system';
import { useColors, useSpacing } from '../../src/design-system/ThemeProvider';
import { useAuth } from '../../src/services';

export default function LoginScreen() {
  const colors = useColors();
  const router = useRouter();
  const { login, isLoading, error } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLocalError(null);

    if (!email.trim()) {
      setLocalError('Digite seu email');
      return;
    }

    if (!password) {
      setLocalError('Digite sua senha');
      return;
    }

    try {
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (err) {
      // Error is handled by AuthProvider
    }
  };

  const displayError = localError || error;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={[styles.logoCircle, { backgroundColor: colors.primary[100] }]}>
              <Ionicons name="briefcase" size={48} color={colors.primary[500]} />
            </View>
            <Text variant="h2" style={styles.title}>
              ProDesign
            </Text>
            <Text variant="body" color="secondary" style={styles.subtitle}>
              Gestão para autônomos
            </Text>
          </View>

          {/* Form */}
          <Card variant="outlined" padding={6} style={styles.formCard}>
            <Text variant="h4" style={styles.formTitle}>
              Entrar
            </Text>

            {displayError && (
              <View style={[styles.errorBox, { backgroundColor: colors.error[50] }]}>
                <Ionicons name="alert-circle" size={20} color={colors.error[500]} />
                <Text variant="bodySmall" color="error" style={styles.errorText}>
                  {displayError}
                </Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Input
                label="Email"
                placeholder="seu@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                leftIcon={
                  <Ionicons name="mail-outline" size={20} color={colors.text.tertiary} />
                }
              />
            </View>

            <View style={styles.inputGroup}>
              <Input
                label="Senha"
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                leftIcon={
                  <Ionicons name="lock-closed-outline" size={20} color={colors.text.tertiary} />
                }
                rightIcon={
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.text.tertiary}
                  />
                }
                onRightIconPress={() => setShowPassword(!showPassword)}
              />
            </View>

            <TouchableOpacity style={styles.forgotPassword}>
              <Text variant="bodySmall" color="primary" style={{ color: colors.primary[500] }}>
                Esqueceu a senha?
              </Text>
            </TouchableOpacity>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={isLoading}
              onPress={handleLogin}
            >
              Entrar
            </Button>
          </Card>

          {/* Footer */}
          <View style={styles.footer}>
            <Text variant="bodySmall" color="tertiary">
              Não tem conta?{' '}
            </Text>
            <TouchableOpacity>
              <Text variant="bodySmall" style={{ color: colors.primary[500] }}>
                Criar conta
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    textAlign: 'center',
  },
  formCard: {
    marginBottom: 24,
  },
  formTitle: {
    marginBottom: 20,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    marginLeft: 8,
    flex: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
