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

export const ApproveFGScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { fgBatchId, fgBatchNumber } = route.params as {
    fgBatchId: number;
    fgBatchNumber?: string;
  };

  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [flowDone, setFlowDone] = useState<{ title: string; message: string } | null>(null);

  const submit = async () => {
    setSubmitting(true);
    try {
      await qaApi.approveFG(fgBatchId, remarks.trim() || undefined);
      setFlowDone({
        title: "FG approved",
        message: "Finished goods batch approved. You can continue from Home.",
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
        <Text style={styles.headerTitle}>Approve FG</Text>
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
          <View style={styles.card}>
            <Input
              label="Remarks (optional)"
              value={remarks}
              onChangeText={setRemarks}
              placeholder="QA approval notes"
              multiline
            />
          </View>
          <Button
            title={submitting ? "Approving…" : "Approve batch"}
            onPress={submit}
            disabled={submitting}
            variant="success"
          />
          {submitting && (
            <ActivityIndicator color={Colors.success} style={{ marginTop: 12 }} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <OperationResultModal
        visible={!!flowDone}
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
    marginBottom: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
});
