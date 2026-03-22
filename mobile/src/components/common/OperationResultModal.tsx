import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from "../../utils/theme";

type Variant = "success" | "info" | "danger";

const VARIANT: Record<Variant, { icon: string; color: string; bg: string }> = {
  success: {
    icon: "checkmark-circle",
    color: Colors.success,
    bg: Colors.successLight,
  },
  info: {
    icon: "information-circle",
    color: Colors.info,
    bg: Colors.infoLight,
  },
  danger: {
    icon: "close-circle",
    color: Colors.danger,
    bg: Colors.dangerLight,
  },
};

type Props = {
  visible: boolean;
  variant?: Variant;
  title: string;
  message: string;
  /** Primary button (e.g. closes + navigates home) */
  onDismiss: () => void;
  dismissLabel?: string;
};

export const OperationResultModal: React.FC<Props> = ({
  visible,
  variant = "success",
  title,
  message,
  onDismiss,
  dismissLabel = "Continue",
}) => {
  const v = VARIANT[variant];
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: v.bg }]}>
            <Ionicons name={v.icon as any} size={48} color={v.color} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={onDismiss}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={dismissLabel}
          >
            <Text style={styles.buttonText}>{dismissLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    ...Shadow.lg,
    ...Platform.select({
      android: { elevation: 8 },
    }),
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: "800",
    color: Colors.textPrimary,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  message: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    minWidth: 200,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: FontSize.md,
    fontWeight: "700",
  },
});
