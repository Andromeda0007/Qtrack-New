import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Colors, FontSize, Spacing } from '../../utils/theme';
import { extractError } from '../../api/client';

export const ChangePasswordScreen: React.FC = () => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { updateUser, user, clearAuth } = useAuthStore();

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!oldPassword) errs.old = 'Current password is required';
    if (!newPassword) errs.new = 'New password is required';
    else if (newPassword.length < 8) errs.new = 'Password must be at least 8 characters';
    else if (!/[A-Z]/.test(newPassword)) errs.new = 'Must contain an uppercase letter';
    else if (!/[0-9]/.test(newPassword)) errs.new = 'Must contain a number';
    else if (!/[!@#$%^&*]/.test(newPassword)) errs.new = 'Must contain a special character (!@#$%^&*)';
    if (newPassword !== confirmPassword) errs.confirm = 'Passwords do not match';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await authApi.changePassword(oldPassword, newPassword);
      const updated = await authApi.getMe();
      updateUser(updated);
      Alert.alert('Success', 'Password changed successfully. Please log in again.', [
        { text: 'OK', onPress: () => clearAuth() },
      ]);
    } catch (error) {
      Alert.alert('Error', extractError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Set New Password</Text>
            <Text style={styles.subtitle}>
              Welcome, {user?.name}! This is your first login.{'\n'}
              You must set a new password to continue.
            </Text>
          </View>

          <View style={styles.rules}>
            <Text style={styles.rulesTitle}>Password Requirements:</Text>
            {['At least 8 characters', 'One uppercase letter', 'One number', 'One special character (!@#$%^&*)'].map((r) => (
              <Text key={r} style={styles.ruleItem}>• {r}</Text>
            ))}
          </View>

          <Input label="Current (Temporary) Password" placeholder="Enter temporary password" value={oldPassword} onChangeText={setOldPassword} error={errors.old} password />
          <Input label="New Password" placeholder="Create a strong password" value={newPassword} onChangeText={setNewPassword} error={errors.new} password />
          <Input label="Confirm New Password" placeholder="Re-enter new password" value={confirmPassword} onChangeText={setConfirmPassword} error={errors.confirm} password returnKeyType="done" onSubmitEditing={handleChange} />

          <Button title="Set New Password" onPress={handleChange} loading={loading} fullWidth style={styles.button} />

          <Button title="Log Out" onPress={clearAuth} variant="ghost" fullWidth />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  container: { flexGrow: 1, padding: Spacing.lg },
  header: { marginBottom: Spacing.lg },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.primary, marginBottom: Spacing.sm },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  rules: { backgroundColor: Colors.infoLight, borderRadius: 10, padding: Spacing.md, marginBottom: Spacing.lg },
  rulesTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.info, marginBottom: Spacing.xs },
  ruleItem: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  button: { marginBottom: Spacing.sm },
});
