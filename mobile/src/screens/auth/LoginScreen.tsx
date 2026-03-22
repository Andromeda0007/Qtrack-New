import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { setStatusBarStyle } from "expo-status-bar";
import { useFocusEffect } from "@react-navigation/native";
import { authApi } from "../../api/auth";
import { useAuthStore } from "../../store/authStore";
import { Button } from "../../components/common/Button";
import { Input } from "../../components/common/Input";
import { Colors, FontSize, Spacing } from "../../utils/theme";
import { extractError } from "../../api/client";

/** Hint of brand amber over the page bg — not solid `Colors.accent` */
const LOGO_TINT_BG = "rgba(255, 172, 8, 0.55)";

export const LoginScreen: React.FC = () => {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ loginId?: string; password?: string }>(
    {},
  );
  const { setAuth } = useAuthStore();

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("dark");
      return () => setStatusBarStyle("light");
    }, []),
  );

  const validate = () => {
    const errs: typeof errors = {};
    if (!loginId.trim()) errs.loginId = "Email or username is required";
    if (!password) errs.password = "Password is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const response = await authApi.login(loginId.trim(), password);
      // Pass token directly so we don't depend on AsyncStorage timing
      const userProfile = await authApi.getMe(response.access_token);
      await setAuth(response.access_token, userProfile);
    } catch (error) {
      Alert.alert("Login Failed", extractError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
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
              label="Email or Username"
              placeholder="Enter your email or username"
              value={loginId}
              onChangeText={setLoginId}
              error={errors.loginId}
              autoComplete="username"
              autoCapitalize="none"
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
            Access is restricted to authorized personnel only.{"\n"}
            Contact your administrator to get an account.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  /* Same light blue-gray as dashboard body (Colors.background) */
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, paddingHorizontal: Spacing.lg },
  header: {
    alignItems: "center",
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xl,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: LOGO_TINT_BG,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  logoText: { fontSize: 40, fontWeight: "900", color: Colors.primary },
  appName: {
    fontSize: 32,
    fontWeight: "800",
    color: Colors.primary,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  form: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  formTitle: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  loginButton: { marginTop: Spacing.sm },
  footer: {
    textAlign: "center",
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: Spacing.xl,
    lineHeight: 18,
  },
});
