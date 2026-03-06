import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import api from "../../config/api";
import { API_ENDPOINTS, COLORS, ROLES } from "../../config/constants";

export default function SignupScreen({ navigation }) {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    roleId: "2", // Default to Viewer (lower privilege)
  });
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    try {
      // Validation
      if (
        !formData.username ||
        !formData.email ||
        !formData.password ||
        !formData.fullName
      ) {
        Alert.alert("Error", "Please fill in all fields");
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        Alert.alert("Error", "Passwords do not match");
        return;
      }

      if (formData.password.length < 6) {
        Alert.alert("Error", "Password must be at least 6 characters");
        return;
      }

      setLoading(true);

      const response = await api.post(API_ENDPOINTS.AUTH.REGISTER, {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        roleId: parseInt(formData.roleId),
      });

      setLoading(false);

      Alert.alert(
        "Success",
        response.data.message ||
          "Registration successful! Wait for admin approval.",
        [
          {
            text: "OK",
            onPress: () => navigation.navigate("Login"),
          },
        ]
      );
    } catch (error) {
      setLoading(false);
      console.error("Signup error:", error);
      Alert.alert(
        "Signup Failed",
        error.response?.data?.error ||
          error.response?.data?.errors?.[0]?.msg ||
          "Something went wrong"
      );
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.formContainer}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>
          Register to start using QTrack warehouse application
        </Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your full name"
            value={formData.fullName}
            onChangeText={(text) =>
              setFormData({ ...formData, fullName: text })
            }
            autoCapitalize="words"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="Choose a username"
            value={formData.username}
            onChangeText={(text) =>
              setFormData({ ...formData, username: text })
            }
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            value={formData.email}
            onChangeText={(text) => setFormData({ ...formData, email: text })}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Choose a password (min 6 characters)"
            value={formData.password}
            onChangeText={(text) =>
              setFormData({ ...formData, password: text })
            }
            secureTextEntry
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Re-enter your password"
            value={formData.confirmPassword}
            onChangeText={(text) =>
              setFormData({ ...formData, confirmPassword: text })
            }
            secureTextEntry
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Role</Text>
          <View style={styles.roleContainer}>
            <TouchableOpacity
              style={[
                styles.roleButton,
                formData.roleId === "1" && styles.roleButtonSelected,
              ]}
              onPress={() => setFormData({ ...formData, roleId: "1" })}
            >
              <Text
                style={[
                  styles.roleButtonText,
                  formData.roleId === "1" && styles.roleButtonTextSelected,
                ]}
              >
                Operator
              </Text>
              <Text
                style={[
                  styles.roleButtonSubtext,
                  formData.roleId === "1" && styles.roleButtonSubtextSelected,
                ]}
              >
                Full Access
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roleButton,
                formData.roleId === "2" && styles.roleButtonSelected,
              ]}
              onPress={() => setFormData({ ...formData, roleId: "2" })}
            >
              <Text
                style={[
                  styles.roleButtonText,
                  formData.roleId === "2" && styles.roleButtonTextSelected,
                ]}
              >
                Viewer
              </Text>
              <Text
                style={[
                  styles.roleButtonSubtext,
                  formData.roleId === "2" && styles.roleButtonSubtextSelected,
                ]}
              >
                Read Only
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignup}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign Up</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => navigation.navigate("Login")}
        >
          <Text style={styles.linkText}>
            Already have an account? <Text style={styles.linkBold}>Login</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    backgroundColor: COLORS.light,
    padding: 20,
  },
  formContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.dark,
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 30,
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.dark,
    marginBottom: 5,
  },
  input: {
    backgroundColor: COLORS.light,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  roleContainer: {
    flexDirection: "row",
    gap: 10,
  },
  roleButton: {
    flex: 1,
    backgroundColor: COLORS.light,
    borderRadius: 8,
    padding: 15,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    alignItems: "center",
  },
  roleButtonSelected: {
    backgroundColor: COLORS.primary + "15",
    borderColor: COLORS.primary,
  },
  roleButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.dark,
  },
  roleButtonTextSelected: {
    color: COLORS.primary,
  },
  roleButtonSubtext: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
  },
  roleButtonSubtextSelected: {
    color: COLORS.primary,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 15,
    alignItems: "center",
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "bold",
  },
  linkButton: {
    marginTop: 20,
    alignItems: "center",
  },
  linkText: {
    fontSize: 14,
    color: COLORS.gray,
  },
  linkBold: {
    color: COLORS.primary,
    fontWeight: "bold",
  },
});
