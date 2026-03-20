import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { inventoryApi } from "../../api/inventory";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { StatusBadge } from "../../components/common/StatusBadge";
import { Colors, FontSize, Spacing, Shadow } from "../../utils/theme";
import { formatDate, formatQuantity } from "../../utils/formatters";
import { useAuthStore } from "../../store/authStore";
import { extractError } from "../../api/client";

const OVERLAY = "rgba(0,0,0,0.62)";
const CORNER_LEN = 32;
const CORNER_THICK = 4;
const CORNER_RADIUS = 4;
/** Extra px above safe area + padding so “Hold steady…” sits a touch higher */
const HINT_BOTTOM_OFFSET_PX = 56;
/** Top / bottom dim bands (ratio 5:8 ≈ previous 0.76:1.2) */
const OVERLAY_TOP_FLEX = 5;
const OVERLAY_BOTTOM_FLEX = 8;

export const QCScanScreen: React.FC = () => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [batchData, setBatchData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const scanSize = useMemo(() => {
    const { width, height } = Dimensions.get("window");
    const raw = Math.min(width, height) * 0.68;
    return Math.round(raw / 8) * 8;
  }, []);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setLoading(true);
    try {
      const result = await inventoryApi.scanQR(data);
      setBatchData(result);
      if (Platform.OS !== "web") {
        try {
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
        } catch {
          /* haptics optional */
        }
      }
    } catch (error) {
      Alert.alert("Scan Error", extractError(error), [
        {
          text: "Try Again",
          onPress: () => {
            setScanned(false);
            setBatchData(null);
          },
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const resetScan = () => {
    setScanned(false);
    setBatchData(null);
    setLoading(false);
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.safeLight} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <View style={styles.centeredLight}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.permTextLight}>Preparing camera…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safeLight} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <View style={styles.centeredLight}>
          <View style={styles.permIconWrap}>
            <Ionicons name="camera-off-outline" size={40} color={Colors.danger} />
          </View>
          <Text style={styles.permTitle}>Camera access needed</Text>
          <Text style={styles.permSubtextLight}>
            Allow camera to scan QTrack batch QR codes. You can enable it in
            system settings.
          </Text>
          <Button
            title="Allow camera"
            onPress={requestPermission}
            style={{ marginTop: Spacing.lg, minWidth: 200 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="light" backgroundColor={Colors.primary} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTextBlock}>
          <Text style={styles.headerTitle}>Scan QR code</Text>
          <Text style={styles.headerSub}>
            Align the code inside the frame below
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {!batchData ? (
        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          />

          {/* Dimmed overlay + clear center */}
          <View
            style={styles.overlayRoot}
            pointerEvents="none"
          >
            {/* More flex below than above → scan frame sits higher */}
            <View
              style={[
                styles.overlayBand,
                { backgroundColor: OVERLAY, flex: OVERLAY_TOP_FLEX },
              ]}
            />
            <View style={{ flexDirection: "row", height: scanSize }}>
              <View style={[styles.overlaySide, { backgroundColor: OVERLAY }]} />
              <View style={{ width: scanSize, height: scanSize }}>
                <ScanFrameCorners />
              </View>
              <View style={[styles.overlaySide, { backgroundColor: OVERLAY }]} />
            </View>
            <View
              style={[
                styles.overlayBand,
                { backgroundColor: OVERLAY, flex: OVERLAY_BOTTOM_FLEX },
              ]}
            />
          </View>

          {/* Bottom hint + loading */}
          <View
            style={[
              styles.bottomBar,
              {
                bottom:
                  Spacing.xl + insets.bottom + HINT_BOTTOM_OFFSET_PX,
              },
            ]}
            pointerEvents="none"
          >
            <View style={styles.hintPill}>
              {loading ? (
                <>
                  <ActivityIndicator color={Colors.accent} size="small" />
                  <Text style={styles.hintText}>Looking up batch…</Text>
                </>
              ) : (
                <>
                  <Ionicons
                    name="qr-code-outline"
                    size={18}
                    color={Colors.accent}
                  />
                  <Text style={styles.hintText}>Hold steady until it locks in</Text>
                </>
              )}
            </View>
          </View>
        </View>
      ) : (
        <ScrollView
          style={styles.resultContainer}
          contentContainerStyle={styles.resultContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.resultHeader}>
            <View style={styles.successIconWrap}>
              <Ionicons name="checkmark-circle" size={36} color={Colors.success} />
            </View>
            <Text style={styles.resultTitle}>Batch found</Text>
            <Text style={styles.resultSub}>Review details and choose an action</Text>
          </View>

          <Card>
            <Text style={styles.batchNumber}>{batchData.batch_number}</Text>
            <StatusBadge status={batchData.status} type="batch" />

            <View style={styles.infoGrid}>
              <InfoRow label="Material" value={batchData.material_name || "—"} />
              <InfoRow
                label="Remaining Qty"
                value={formatQuantity(batchData.remaining_quantity)}
              />
              <InfoRow label="Retest Date" value={formatDate(batchData.retest_date)} />
              <InfoRow label="AR Number" value={batchData.ar_number || "—"} />
            </View>
          </Card>

          <RoleActions batchData={batchData} role={user?.role || ""} />

          <Button
            title="Scan another"
            onPress={resetScan}
            variant="outline"
            fullWidth
            style={{ marginTop: Spacing.md }}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

/** L-shaped corners for the scan window */
const ScanFrameCorners: React.FC = () => (
  <>
    <View
      style={[
        styles.corner,
        styles.topLeft,
        {
          borderTopWidth: CORNER_THICK,
          borderLeftWidth: CORNER_THICK,
          borderTopLeftRadius: CORNER_RADIUS,
        },
      ]}
    />
    <View
      style={[
        styles.corner,
        styles.topRight,
        {
          borderTopWidth: CORNER_THICK,
          borderRightWidth: CORNER_THICK,
          borderTopRightRadius: CORNER_RADIUS,
        },
      ]}
    />
    <View
      style={[
        styles.corner,
        styles.bottomLeft,
        {
          borderBottomWidth: CORNER_THICK,
          borderLeftWidth: CORNER_THICK,
          borderBottomLeftRadius: CORNER_RADIUS,
        },
      ]}
    />
    <View
      style={[
        styles.corner,
        styles.bottomRight,
        {
          borderBottomWidth: CORNER_THICK,
          borderRightWidth: CORNER_THICK,
          borderBottomRightRadius: CORNER_RADIUS,
        },
      ]}
    />
  </>
);

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const RoleActions: React.FC<{
  batchData: any;
  role: string;
  onAction: () => void;
}> = ({ batchData, role }) => {
  const navigation = useNavigation<any>();
  const status = batchData?.status;

  const goTo = (screen: string, params?: any) => {
    navigation.navigate(screen, {
      batchId: batchData.id,
      batchNumber: batchData.batch_number,
      ...params,
    });
  };

  if (role === "QC_EXECUTIVE" || role === "QC_HEAD") {
    if (status === "QUARANTINE" || status === "QUARANTINE_RETEST") {
      return (
        <Button
          title="Add AR Number & Start Testing"
          onPress={() => goTo("AddARNumber")}
          fullWidth
          style={{ marginTop: Spacing.sm }}
        />
      );
    }
    if (status === "UNDER_TEST" && role === "QC_HEAD") {
      return (
        <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
          <Button
            title="Approve Material"
            onPress={() => goTo("ApproveBatch")}
            variant="success"
            fullWidth
          />
          <Button
            title="Reject Material"
            onPress={() => goTo("RejectBatch")}
            variant="danger"
            fullWidth
          />
        </View>
      );
    }
    if (status === "APPROVED" && role === "QC_HEAD") {
      return (
        <Button
          title="Initiate Retest"
          onPress={() => goTo("InitiateRetest")}
          variant="outline"
          fullWidth
          style={{ marginTop: Spacing.sm }}
        />
      );
    }
  }

  if (
    (role === "WAREHOUSE_USER" || role === "WAREHOUSE_HEAD") &&
    status === "APPROVED"
  ) {
    return (
      <Button
        title="Issue to Production"
        onPress={() => goTo("IssueStock")}
        fullWidth
        style={{ marginTop: Spacing.sm }}
      />
    );
  }

  if ((role === "QA_EXECUTIVE" || role === "QA_HEAD") && status === "QA_PENDING") {
    return (
      <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
        <Button title="Submit Inspection" onPress={() => goTo("InspectFG")} fullWidth />
        {role === "QA_HEAD" && (
          <Button
            title="Approve FG"
            onPress={() => goTo("ApproveFG")}
            variant="success"
            fullWidth
          />
        )}
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primary },
  safeLight: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primary,
    ...Platform.select({
      ios: Shadow.sm,
      android: { elevation: 6 },
    }),
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: -4,
  },
  headerSpacer: { width: 44 },
  headerTextBlock: { flex: 1, alignItems: "center" },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: FontSize.xs,
    color: "rgba(255,255,255,0.78)",
    marginTop: 4,
    textAlign: "center",
  },
  scannerContainer: { flex: 1, position: "relative", overflow: "hidden" },
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
  },
  overlayBand: { flex: 1 },
  overlaySide: { flex: 1 },
  corner: {
    position: "absolute",
    width: CORNER_LEN,
    height: CORNER_LEN,
    borderColor: "#ffffff",
  },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  hintPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(10,14,20,0.88)",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(240,165,0,0.4)",
    maxWidth: "90%",
  },
  hintText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: FontSize.sm,
    fontWeight: "600",
    flexShrink: 1,
  },
  centeredLight: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  permIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.dangerLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  permTitle: {
    fontSize: FontSize.xl,
    fontWeight: "800",
    color: Colors.textPrimary,
    textAlign: "center",
  },
  permTextLight: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  permSubtextLight: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  permText: { fontSize: FontSize.md, color: Colors.textPrimary, textAlign: "center" },
  permSubtext: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  resultContainer: { flex: 1, backgroundColor: Colors.background },
  resultContent: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  resultHeader: { alignItems: "center", marginBottom: Spacing.lg },
  successIconWrap: { marginBottom: Spacing.xs },
  resultTitle: {
    fontSize: FontSize.xl,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  resultSub: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  batchNumber: {
    fontSize: FontSize.lg,
    fontWeight: "800",
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  infoGrid: { marginTop: Spacing.md, gap: Spacing.sm },
  infoRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  infoLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  infoValue: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.textPrimary,
    flex: 1,
    textAlign: "right",
  },
});
