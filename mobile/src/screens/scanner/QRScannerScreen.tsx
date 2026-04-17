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
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { inventoryApi } from "../../api/inventory";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { StatusBadge } from "../../components/common/StatusBadge";
import {
  Colors,
  FontSize,
  Spacing,
  Shadow,
  BorderRadius,
  BatchStatusColors,
  FGStatusColors,
} from "../../utils/theme";
import { formatDate, formatQuantity } from "../../utils/formatters";
import { useAuthStore } from "../../store/authStore";
import { extractError } from "../../api/client";
import {
  type ScanFlow,
  normalizeScanFlow,
  getFlowGate,
  requiredPhaseSentence,
  flowActionTitle,
} from "./scanFlowGate";

const OVERLAY = "rgba(0,0,0,0.62)";
const CORNER_LEN = 32;
const CORNER_THICK = 4;
const CORNER_RADIUS = 4;
/** Extra px above safe area + padding so “Hold steady…” sits a touch higher */
const HINT_BOTTOM_OFFSET_PX = 56;
/** Top / bottom dim bands (ratio 5:8 ≈ previous 0.76:1.2) */
const OVERLAY_TOP_FLEX = 5;
const OVERLAY_BOTTOM_FLEX = 8;

const FALLBACK_ACCENT = { bg: "#e2e3e5", text: "#383d41", label: "" };

function statusAccent(
  status: string,
  kind: "batch" | "fg",
): { bg: string; text: string } {
  const map = kind === "fg" ? FGStatusColors : BatchStatusColors;
  const cfg = map[status] ?? FALLBACK_ACCENT;
  return { bg: cfg.bg, text: cfg.text };
}

/** Matches inventory status-list cards: ID pill, batch row + badge, code/name, icon meta. */
const ScanSummaryCard: React.FC<{ batchData: any }> = ({ batchData }) => {
  const isFg = batchData.qr_kind === "fg";
  const accent = statusAccent(batchData.status, isFg ? "fg" : "batch");

  const balanceLine =
    batchData.total_quantity != null && batchData.total_quantity !== ""
      ? `${formatQuantity(batchData.remaining_quantity)} / ${formatQuantity(batchData.total_quantity)}`
      : formatQuantity(batchData.remaining_quantity);

  return (
    <View style={scanCardStyles.summaryCard}>
      <View
        style={[scanCardStyles.idBadge, { backgroundColor: accent.bg }]}
      >
        <Text style={[scanCardStyles.idText, { color: accent.text }]}>
          #{batchData.id}
        </Text>
      </View>

      <View style={scanCardStyles.titleRow}>
        <Text style={scanCardStyles.batchNumber} numberOfLines={2}>
          {batchData.batch_number || "—"}
        </Text>
        <StatusBadge
          status={batchData.status}
          type={isFg ? "fg" : "batch"}
        />
      </View>

      {isFg ? (
        <>
          <Text style={scanCardStyles.materialCode}>Finished goods</Text>
          <Text style={scanCardStyles.materialName}>
            {batchData.product_name || "—"}
          </Text>
          <View style={scanCardStyles.metaRow}>
            <ScanMetaItem
              icon="layers-outline"
              label={formatQuantity(batchData.quantity)}
            />
            <ScanMetaItem
              icon="calendar-outline"
              label={formatDate(batchData.expiry_date)}
            />
          </View>
        </>
      ) : (
        <>
          <Text style={scanCardStyles.materialCode}>
            {batchData.material_code || "—"}
          </Text>
          <Text style={scanCardStyles.materialName}>
            {batchData.material_name || "—"}
          </Text>
          <View style={scanCardStyles.metaRow}>
            <ScanMetaItem icon="layers-outline" label={balanceLine} />
            <ScanMetaItem
              icon="calendar-outline"
              label={formatDate(batchData.expiry_date)}
            />
            {batchData.retest_date ? (
              <ScanMetaItem
                icon="refresh-outline"
                label={formatDate(batchData.retest_date)}
                color={Colors.warning}
              />
            ) : null}
          </View>
          {batchData.grn_number ? (
            <Text style={scanCardStyles.grnLine}>
              Product: {batchData.grn_number}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
};

const ScanMetaItem: React.FC<{
  icon: string;
  label: string;
  color?: string;
}> = ({ icon, label, color = Colors.textMuted }) => (
  <View style={scanCardStyles.metaItem}>
    <Ionicons name={icon as any} size={13} color={color} />
    <Text style={[scanCardStyles.metaText, { color }]} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

const DetailRow: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <View style={scanCardStyles.detailRow}>
    <Text style={scanCardStyles.detailLabel}>{label}</Text>
    <Text style={scanCardStyles.detailValue}>{value}</Text>
  </View>
);

const scanCardStyles = StyleSheet.create({
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  idBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
    marginBottom: Spacing.sm,
  },
  idText: { fontSize: FontSize.xs, fontWeight: "700" },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: 4,
  },
  batchNumber: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: "700",
    color: Colors.primary,
  },
  materialCode: {
    fontSize: FontSize.md,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  materialName: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: Spacing.sm,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "100%" },
  metaText: { fontSize: FontSize.xs, fontWeight: "600", flexShrink: 1 },
  grnLine: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  detailsCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadow.md,
  },
  detailsSectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: "800",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    letterSpacing: 0.2,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: Spacing.md,
    paddingVertical: 10,
  },
  detailLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    flexShrink: 0,
    maxWidth: "42%",
  },
  detailValue: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.textPrimary,
    flex: 1,
    textAlign: "right",
  },
  detailDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderLight,
  },
});

const gateStyles = StyleSheet.create({
  sheet: {
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
  },
  /** One tight elevated card: header + facts + notice */
  gateCard: {
    backgroundColor: "#f7f9fc",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#e8edf4",
    ...Shadow.md,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: 8,
  },
  cardTopLeft: { flex: 1, minWidth: 0 },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  cardHint: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 3,
    fontWeight: "600",
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#dce3ee",
    marginBottom: 6,
  },
  compactRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 5,
    gap: 10,
  },
  compactLabel: {
    width: 76,
    fontSize: 10,
    fontWeight: "700",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.2,
    paddingTop: 2,
  },
  compactValue: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  noticeBar: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#dce3ee",
  },
  noticeText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
    lineHeight: 17,
  },
});

const GateCompactRow: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <View style={gateStyles.compactRow}>
    <Text style={gateStyles.compactLabel}>{label}</Text>
    <Text style={gateStyles.compactValue} numberOfLines={2}>
      {value}
    </Text>
  </View>
);

/** Wrong phase / wrong type — single slim card. */
const WrongFlowScanResult: React.FC<{
  batchData: any;
  scanFlow: ScanFlow;
  block: "finished_goods" | "wrong_status";
  onScanAnother: () => void;
}> = ({ batchData, scanFlow, block, onScanAnother }) => {
  const required = requiredPhaseSentence(scanFlow);
  const isFg = batchData.qr_kind === "fg";

  const trackLine =
    batchData.track_id ||
    (batchData.public_code ? `#${batchData.public_code}` : "—");

  const notice =
    block === "finished_goods"
      ? "FG batch — use QA / FG from Home."
      : `Wrong phase — must be ${required} first.`;

  return (
    <View style={gateStyles.sheet}>
      <View style={gateStyles.gateCard}>
        <View style={gateStyles.cardTop}>
          <View style={gateStyles.cardTopLeft}>
            <View style={gateStyles.cardTitleRow}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
              <Text style={gateStyles.cardTitle}>Batch found</Text>
            </View>
            <Text style={gateStyles.cardHint}>Not available for this step</Text>
          </View>
          <StatusBadge
            status={batchData.status}
            type={isFg ? "fg" : "batch"}
            size="sm"
          />
        </View>

        <View style={gateStyles.hairline} />

        {isFg ? (
          <>
            <GateCompactRow label="Batch" value={batchData.batch_number || "—"} />
            <GateCompactRow label="Product" value={batchData.product_name || "—"} />
            <GateCompactRow label="Qty" value={formatQuantity(batchData.quantity)} />
            <GateCompactRow label="Expiry" value={formatDate(batchData.expiry_date)} />
            <GateCompactRow label="Track" value={trackLine} />
          </>
        ) : (
          <>
            <GateCompactRow label="Batch" value={batchData.batch_number || "—"} />
            <GateCompactRow label="Material" value={batchData.material_name || "—"} />
            <GateCompactRow label="Code" value={batchData.material_code || "—"} />
            <GateCompactRow label="Prod. no." value={batchData.grn_number || "—"} />
            <GateCompactRow label="Expiry" value={formatDate(batchData.expiry_date)} />
          </>
        )}

        <View style={gateStyles.noticeBar}>
          <Text style={gateStyles.noticeText}>{notice}</Text>
        </View>
      </View>

      <Button
        title="Scan another"
        onPress={onScanAnother}
        variant="outline"
        fullWidth
        style={{ marginTop: Spacing.md }}
      />
    </View>
  );
};

export const QCScanScreen: React.FC = () => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [batchData, setBatchData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const scanFlow = normalizeScanFlow(route.params?.scanFlow);
  const flowGate =
    batchData != null ? getFlowGate(scanFlow, batchData) : { kind: "full" as const };
  const showGatedWrongPhase =
    scanFlow != null && flowGate.kind === "blocked" && batchData != null;

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
          {showGatedWrongPhase &&
          scanFlow &&
          flowGate.kind === "blocked" ? (
            <WrongFlowScanResult
              batchData={batchData}
              scanFlow={scanFlow}
              block={flowGate.block}
              onScanAnother={resetScan}
            />
          ) : (
            <>
          <View style={styles.resultHeader}>
            <View style={styles.successIconWrap}>
              <Ionicons name="checkmark-circle" size={36} color={Colors.success} />
            </View>
            <Text style={styles.resultTitle}>
              {batchData.qr_kind === "fg" ? "FG batch found" : "Batch found"}
            </Text>
            <Text style={styles.resultSub}>Review details and choose an action</Text>
          </View>

          {batchData.qa_scan_blocked ? (
            <Card style={styles.qaWarnCard}>
              <View style={styles.qaWarnRow}>
                <Ionicons name="warning-outline" size={22} color={Colors.warning} />
                <Text style={styles.qaWarnTitle}>Not available for QA</Text>
              </View>
              <Text style={styles.qaWarnMsg}>{batchData.qa_scan_message}</Text>
            </Card>
          ) : null}

          <ScanSummaryCard batchData={batchData} />

          <View style={scanCardStyles.detailsCard}>
            <Text style={scanCardStyles.detailsSectionTitle}>Full details</Text>
            {batchData.qr_kind === "fg" ? (
              <>
                <DetailRow label="Product" value={batchData.product_name || "—"} />
                <View style={scanCardStyles.detailDivider} />
                <DetailRow
                  label="Quantity"
                  value={formatQuantity(batchData.quantity)}
                />
                <View style={scanCardStyles.detailDivider} />
                <DetailRow label="Expiry" value={formatDate(batchData.expiry_date)} />
                <View style={scanCardStyles.detailDivider} />
                <DetailRow
                  label="Mfg date"
                  value={formatDate(batchData.manufacture_date)}
                />
              </>
            ) : (
              <>
                <DetailRow label="GRN" value={batchData.grn_number || "—"} />
                <View style={scanCardStyles.detailDivider} />
                {batchData.qr_kind === "container" && batchData.container_number != null ? (
                  <>
                    <DetailRow
                      label="Container"
                      value={`${batchData.container_number} / ${batchData.container_total ?? "?"}`}
                    />
                    <View style={scanCardStyles.detailDivider} />
                  </>
                ) : null}
                <DetailRow
                  label="Item code"
                  value={batchData.material_code || "—"}
                />
                <View style={scanCardStyles.detailDivider} />
                <DetailRow label="Item" value={batchData.material_name || "—"} />
                <View style={scanCardStyles.detailDivider} />
                <DetailRow label="Batch / Lot" value={batchData.batch_number || "—"} />
                <View style={scanCardStyles.detailDivider} />
                <DetailRow label="Supplier" value={batchData.supplier_name || "—"} />
                <View style={scanCardStyles.detailDivider} />
                <DetailRow
                  label="Date of receipt"
                  value={formatDate(batchData.date_of_receipt)}
                />
                <View style={scanCardStyles.detailDivider} />
                <DetailRow label="Pack type" value={batchData.pack_type || "—"} />
                <View style={scanCardStyles.detailDivider} />
                <DetailRow
                  label="Qty / container"
                  value={
                    batchData.container_quantity != null
                      ? `${batchData.container_quantity} ${batchData.unit_of_measure === "KG" ? "kg" : ""}`.trim()
                      : formatQuantity(batchData.pack_size)
                  }
                />
                <View style={scanCardStyles.detailDivider} />
                <DetailRow
                  label="Containers"
                  value={
                    batchData.container_count != null
                      ? String(batchData.container_count)
                      : "—"
                  }
                />
                <View style={scanCardStyles.detailDivider} />
                <DetailRow
                  label="Mfg date"
                  value={formatDate(batchData.manufacture_date)}
                />
                <View style={scanCardStyles.detailDivider} />
                <DetailRow label="Expiry" value={formatDate(batchData.expiry_date)} />
                <View style={scanCardStyles.detailDivider} />
                <DetailRow
                  label="Total received"
                  value={
                    batchData.total_quantity != null &&
                    batchData.total_quantity !== ""
                      ? formatQuantity(batchData.total_quantity)
                      : "—"
                  }
                />
                <View style={scanCardStyles.detailDivider} />
                <DetailRow
                  label="Dispensed"
                  value={
                    batchData.quantity_issued != null &&
                    batchData.quantity_issued !== ""
                      ? formatQuantity(batchData.quantity_issued)
                      : "—"
                  }
                />
                <View style={scanCardStyles.detailDivider} />
                <DetailRow
                  label="Balance"
                  value={formatQuantity(batchData.remaining_quantity)}
                />
                {batchData.remaining_quantity_hidden ? (
                  <Text style={styles.balanceHint}>
                    Balance is shown after QC approves (approved / issued to
                    production).
                  </Text>
                ) : null}
                <View style={scanCardStyles.detailDivider} />
                <DetailRow label="Rack no." value={batchData.rack_number || "—"} />
                <View style={scanCardStyles.detailDivider} />
                <DetailRow
                  label="Retest date"
                  value={formatDate(batchData.retest_date)}
                />
                <View style={scanCardStyles.detailDivider} />
                <DetailRow
                  label="Retest cycle"
                  value={
                    batchData.retest_cycle != null &&
                    batchData.retest_cycle !== ""
                      ? String(batchData.retest_cycle)
                      : "—"
                  }
                />
                <View style={scanCardStyles.detailDivider} />
                <DetailRow label="AR number" value={batchData.ar_number || "—"} />
              </>
            )}
          </View>

          <RoleActions
            batchData={batchData}
            role={user?.role || ""}
            onRackSaved={(rack: string) =>
              setBatchData((prev: any) =>
                prev ? { ...prev, rack_number: rack } : prev,
              )
            }
          />

          <Button
            title="Scan another"
            onPress={resetScan}
            variant="outline"
            fullWidth
            style={{ marginTop: Spacing.md }}
          />
            </>
          )}
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

const RoleActions: React.FC<{
  batchData: any;
  role: string;
  onRackSaved?: (rack: string) => void;
}> = ({ batchData, role, onRackSaved }) => {
  const navigation = useNavigation<any>();
  const status = batchData?.status;
  const isFg = batchData?.qr_kind === "fg";
  const [rackGateOpen, setRackGateOpen] = useState(false);
  const [rackDraft, setRackDraft] = useState("");
  const [rackSaving, setRackSaving] = useState(false);

  if (
    (role === "QA_EXECUTIVE" || role === "QA_HEAD") &&
    batchData?.qa_scan_blocked
  ) {
    return null;
  }

  const goToBatch = (screen: string, params?: Record<string, unknown>) => {
    navigation.navigate(screen, {
      batchId: batchData.id,
      batchNumber: batchData.batch_number,
      ...params,
    });
  };

  const goToFg = (screen: string) => {
    navigation.navigate(screen, {
      fgBatchId: batchData.id,
      fgBatchNumber: batchData.batch_number,
    });
  };

  if (role === "QC_EXECUTIVE" || role === "QC_HEAD") {
    if (isFg) {
      return null;
    }
    if (status === "QUARANTINE" || status === "QUARANTINE_RETEST") {
      return (
        <Button
          title="Add AR Number & Start Testing"
          onPress={() => goToBatch("AddARNumber")}
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
            onPress={() => goToBatch("ApproveBatch")}
            variant="success"
            fullWidth
          />
          <Button
            title="Reject Material"
            onPress={() => goToBatch("RejectBatch")}
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
          onPress={() => goToBatch("InitiateRetest")}
          variant="outline"
          fullWidth
          style={{ marginTop: Spacing.sm }}
        />
      );
    }
  }

  if (
    !isFg &&
    (role === "WAREHOUSE_USER" || role === "WAREHOUSE_HEAD") &&
    (status === "APPROVED" || status === "ISSUED_TO_PRODUCTION")
  ) {
    const hasRack = String(batchData.rack_number || "").trim().length > 0;

    const goIssue = () =>
      goToBatch("IssueStock", {
        initialRack: String(batchData.rack_number || "").trim(),
      });

    const onIssuePress = () => {
      if (hasRack) {
        goIssue();
        return;
      }
      setRackDraft("");
      setRackGateOpen(true);
    };

    const saveRackAndContinue = async () => {
      const r = rackDraft.trim();
      if (!r) {
        Alert.alert("Rack required", "Enter the rack / bin location before issuing to production.");
        return;
      }
      setRackSaving(true);
      try {
        await inventoryApi.updateBatchRack(batchData.id, r);
        onRackSaved?.(r);
        setRackGateOpen(false);
        navigation.navigate("IssueStock", {
          batchId: batchData.id,
          batchNumber: batchData.batch_number,
          initialRack: r,
        });
      } catch (e) {
        Alert.alert("Could not save rack", extractError(e));
      } finally {
        setRackSaving(false);
      }
    };

    return (
      <View style={{ marginTop: Spacing.sm }}>
        {!hasRack ? (
          <Text style={styles.rackHint}>
            Rack number is required before you can issue this batch to production.
          </Text>
        ) : null}
        <Button title="Issue to Production" onPress={onIssuePress} fullWidth />
        <Modal visible={rackGateOpen} transparent animationType="fade">
          <View style={styles.rackModalOverlay}>
            <View style={styles.rackModalCard}>
              <Text style={styles.rackModalTitle}>Rack / storage location</Text>
              <Text style={styles.rackModalSub}>
                Record where approved material is stored before issuing to production.
              </Text>
              <TextInput
                style={styles.rackModalInput}
                placeholder="Enter rack / bin location"
                placeholderTextColor={Colors.textMuted}
                value={rackDraft}
                onChangeText={setRackDraft}
                autoCapitalize="characters"
              />
              <View style={styles.rackModalActions}>
                <TouchableOpacity
                  style={styles.rackModalCancel}
                  onPress={() => setRackGateOpen(false)}
                  disabled={rackSaving}
                >
                  <Text style={styles.rackModalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rackModalSave}
                  onPress={saveRackAndContinue}
                  disabled={rackSaving}
                >
                  <Text style={styles.rackModalSaveText}>
                    {rackSaving ? "Saving…" : "Save & continue"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  if (
    (role === "QA_EXECUTIVE" || role === "QA_HEAD") &&
    isFg &&
    status === "QA_PENDING"
  ) {
    return (
      <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
        <Button
          title="Submit Inspection"
          onPress={() => goToFg("InspectFG")}
          fullWidth
        />
        {role === "QA_HEAD" && (
          <>
            <Button
              title="Approve FG"
              onPress={() => goToFg("ApproveFG")}
              variant="success"
              fullWidth
            />
            <Button
              title="Reject FG"
              onPress={() => goToFg("RejectFG")}
              variant="danger"
              fullWidth
            />
          </>
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
  qaWarnCard: {
    marginBottom: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
    backgroundColor: Colors.warningLight,
  },
  qaWarnRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  qaWarnTitle: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.textPrimary },
  qaWarnMsg: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  balanceHint: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontStyle: "italic",
    marginTop: -4,
    marginBottom: Spacing.xs,
  },
  rackHint: {
    fontSize: FontSize.xs,
    color: "#856404",
    fontWeight: "600",
    marginBottom: Spacing.sm,
    textAlign: "center",
    lineHeight: 18,
  },
  rackModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  rackModalCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  rackModalTitle: {
    fontSize: FontSize.lg,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  rackModalSub: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 6,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  rackModalInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  rackModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  rackModalCancel: { paddingVertical: 10, paddingHorizontal: 14 },
  rackModalCancelText: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary },
  rackModalSave: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: BorderRadius.md,
  },
  rackModalSaveText: { fontSize: FontSize.sm, fontWeight: "800", color: "#fff" },
});
