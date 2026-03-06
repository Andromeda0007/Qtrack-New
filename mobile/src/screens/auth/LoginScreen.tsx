import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Colors, FontSize, Spacing } from '../../utils/theme';
import { extractError } from '../../api/client';

export const LoginScreen: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const { setAuth } = useAuthStore();

  const validate = () => {
    const errs: typeof errors = {};
    if (!username.trim()) errs.username = 'Username is required';
    if (!password) errs.password = 'Password is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const response = await authApi.login(username.trim(), password);
      // Pass token directly so we don't depend on AsyncStorage timing
      const userProfile = await authApi.getMe(response.access_token);
      await setAuth(response.access_token, userProfile);
    } catch (error) {
      Alert.alert('Login Failed', extractError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>Q</Text>
            </View>
            <Text style={styles.appName}>QTrack</Text>
            <Text style={styles.subtitle}>Warehouse & Quality Management</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.formTitle}>Sign In</Text>

            <Input
              label="Username"
              placeholder="Enter your username"
              value={username}
              onChangeText={setUsername}
              error={errors.username}
              autoComplete="username"
              returnKeyType="next"
            />

            <Input
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              password
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />

            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={loading}
              fullWidth
              style={styles.loginButton}
            />
          </View>

          <Text style={styles.footer}>
            Access is restricted to authorized personnel only.{'\n'}
            Contact your administrator to get an account.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primary },
  flex: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: Spacing.lg },
  header: { alignItems: 'center', paddingTop: Spacing.xxl, paddingBottom: Spacing.xl },
  logoContainer: {
    width: 80, height: 80,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  logoText: { fontSize: 40, fontWeight: '900', color: Colors.primary },
  appName: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  subtitle: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  form: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  formTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.lg },
  loginButton: { marginTop: Spacing.sm },
  footer: {
    textAlign: 'center',
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.6)',
    marginTop: Spacing.xl,
    lineHeight: 18,
  },
});
