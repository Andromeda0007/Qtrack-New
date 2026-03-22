import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Input } from "../../components/common/Input";
import { Button } from "../../components/common/Button";
import { qaApi } from "../../api/qa";
import { extractError } from "../../api/client";
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from "../../utils/theme";
import { resetToDashboardHome } from "../../navigation/goHome";
import { OperationResultModal } from "../../components/common/OperationResultModal";

export const InspectFGScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { fgBatchId, fgBatchNumber } = route.params as {
    fgBatchId: number;
    fgBatchNumber?: string;
  };

  const [quantityVerified, setQuantityVerified] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [flowDone, setFlowDone] = useState<{ title: string; message: string } | null>(null);

  const submit = async () => {
    let qty: number | undefined;
    if (quantityVerified.trim()) {
      const n = parseFloat(quantityVerified.replace(",", "."));
      if (Number.isNaN(n)) {
        Alert.alert("Invalid", "Enter a valid quantity or leave it blank.");
        return;
      }
      qty = n;
    }
    setSubmitting(true);
    try {
      await qaApi.inspectFG(fgBatchId, qty, remarks.trim() || undefined);
      setFlowDone({
        title: "Inspection recorded",
        message: "QA inspection has been saved. You can continue from Home.",
      });
    } catch (e) {
      Alert.alert("Error", extractError(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Submit inspection</Text>
        <View style={{ width: 44 }} />
      </View>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.batchHint}>
            FG {fgBatchNumber ?? `#${fgBatchId}`}
          </Text>
          <Text style={styles.help}>
            Record verified quantity and optional remarks for this QA inspection.
          </Text>
          <View style={styles.card}>
            <Input
              label="Quantity verified (optional)"
              value={quantityVerified}
              onChangeText={setQuantityVerified}
              placeholder="e.g. 1200"
              keyboardType="decimal-pad"
            />
            <Input
              label="Inspection remarks (optional)"
              value={remarks}
              onChangeText={setRemarks}
              placeholder="Notes"
              multiline
            />
          </View>
          <Button
            title={submitting ? "Submitting…" : "Submit inspection"}
            onPress={submit}
            disabled={submitting}
          />
          {submitting && (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 12 }} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <OperationResultModal
        visible={!!flowDone}
        variant="info"
        title={flowDone?.title ?? ""}
        message={flowDone?.message ?? ""}
        onDismiss={() => {
          setFlowDone(null);
          resetToDashboardHome(navigation);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primary,
    ...Shadow.sm,
  },
  backBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: FontSize.lg, fontWeight: "800", color: "#fff" },
  scroll: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  batchHint: {
    fontSize: FontSize.md,
    fontWeight: "700",
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  help: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
});
