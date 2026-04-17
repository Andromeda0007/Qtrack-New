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
import { extractError } from "../../api/client";

const OVERLAY = "rgba(0,0,0,0.62)";
const CORNER_LEN = 32;
const CORNER_THICK = 4;
const CORNER_RADIUS = 4;
const HINT_BOTTOM_OFFSET_PX = 56;
const OVERLAY_TOP_FLEX = 5;
const OVERLAY_BOTTOM_FLEX = 8;

const FALLBACK = { bg: "#e8eaed", text: "#383d41", label: "Unknown" };

function statusConfig(
  status: string,
  kind: "batch" | "fg",
): { bg: string; text: string; label: string } {
  const map = kind === "fg" ? FGStatusColors : BatchStatusColors;
  return map[status] ?? { ...FALLBACK, label: status || FALLBACK.label };
}

const ScanFrameCorners: React.FC = () => (
  <>
    <View
      style={[
        s.corner,
        s.topLeft,
        {
          borderTopWidth: CORNER_THICK,
          borderLeftWidth: CORNER_THICK,
          borderTopLeftRadius: CORNER_RADIUS,
        },
      ]}
    />
    <View
      style={[
        s.corner,
        s.topRight,
        {
          borderTopWidth: CORNER_THICK,
          borderRightWidth: CORNER_THICK,
          borderTopRightRadius: CORNER_RADIUS,
        },
      ]}
    />
    <View
      style={[
        s.corner,
        s.bottomLeft,
        {
          borderBottomWidth: CORNER_THICK,
          borderLeftWidth: CORNER_THICK,
          borderBottomLeftRadius: CORNER_RADIUS,
        },
      ]}
    />
    <View
      style={[
        s.corner,
        s.bottomRight,
        {
          borderBottomWidth: CORNER_THICK,
          borderRightWidth: CORNER_THICK,
          borderBottomRightRadius: CORNER_RADIUS,
        },
      ]}
    />
  </>
);

const GlanceChip: React.FC<{
  icon: string;
  label: string;
  sub: string;
  tint: string;
}> = ({ icon, label, sub, tint }) => (
  <View style={[styles.chip, { borderColor: tint + "55" }]}>
    <View style={[styles.chipIconWrap, { backgroundColor: tint + "18" }]}>
      <Ionicons name={icon as any} size={18} color={tint} />
    </View>
    <Text style={styles.chipLabel}>{label}</Text>
    <Text style={styles.chipSub} numberOfLines={2}>
      {sub}
    </Text>
  </View>
);

const FactRow: React.FC<{ icon: string; label: string; value: string }> = ({
  icon,
  label,
  value,
}) => (
  <View style={styles.factRow}>
    <Ionicons name={icon as any} size={18} color={Colors.textMuted} />
    <View style={styles.factText}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  </View>
);

export const CheckStatusScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const scanSize = useMemo(() => {
    const { width, height } = Dimensions.get("window");
    const raw = Math.min(width, height) * 0.68;
    return Math.round(raw / 8) * 8;
  }, []);

  const onScan = async ({ data: payload }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setLoading(true);
    try {
      const result = await inventoryApi.scanQR(payload);
      setData(result);
      if (Platform.OS !== "web") {
        try {
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
        } catch {
          /* optional */
        }
      }
    } catch (e) {
      Alert.alert("Could not read QR", extractError(e), [
        {
          text: "Try again",
          onPress: () => {
            setScanned(false);
            setData(null);
          },
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setScanned(false);
    setData(null);
    setLoading(false);
  };

  if (!permission) {
    return (
      <SafeAreaView style={s.safeLight} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <View style={s.centeredLight}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={s.permTextLight}>Preparing camera…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={s.safeLight} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <View style={s.centeredLight}>
          <View style={s.permIconWrap}>
            <Ionicons name="camera-off" size={40} color={Colors.danger} />
          </View>
          <Text style={s.permTitle}>Camera access needed</Text>
          <Text style={s.permSubtextLight}>
            Allow camera to scan a QTrack code and see live product status.
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

  const isFg = data?.qr_kind === "fg";
  const cfg = data ? statusConfig(data.status, isFg ? "fg" : "batch") : null;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <StatusBar style="light" backgroundColor={Colors.primary} />
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={s.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerTextBlock}>
          <Text style={s.headerTitle}>Check status</Text>
          <Text style={s.headerSub}>Scan any product QR — status at a glance</Text>
        </View>
        <View style={s.headerSpacer} />
      </View>

      {!data ? (
        <View style={s.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            onBarcodeScanned={scanned ? undefined : onScan}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          />
          <View style={s.overlayRoot} pointerEvents="none">
            <View
              style={[s.overlayBand, { backgroundColor: OVERLAY, flex: OVERLAY_TOP_FLEX }]}
            />
            <View style={{ flexDirection: "row", height: scanSize }}>
              <View style={[s.overlaySide, { backgroundColor: OVERLAY }]} />
              <View style={{ width: scanSize, height: scanSize }}>
                <ScanFrameCorners />
              </View>
              <View style={[s.overlaySide, { backgroundColor: OVERLAY }]} />
            </View>
            <View
              style={[s.overlayBand, { backgroundColor: OVERLAY, flex: OVERLAY_BOTTOM_FLEX }]}
            />
          </View>
          <View
            style={[
              s.bottomBar,
              { bottom: Spacing.xl + insets.bottom + HINT_BOTTOM_OFFSET_PX },
            ]}
            pointerEvents="none"
          >
            <View style={s.hintPill}>
              {loading ? (
                <>
                  <ActivityIndicator color={Colors.accent} size="small" />
                  <Text style={s.hintText}>Fetching status…</Text>
                </>
              ) : (
                <>
                  <Ionicons name="scan" size={18} color={Colors.accent} />
                  <Text style={s.hintText}>Point at the QR to read status</Text>
                </>
              )}
            </View>
          </View>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {cfg ? (
            <View style={[styles.hero, { backgroundColor: cfg.bg }]}>
              <View style={styles.heroIconRing}>
                <Ionicons name="scan" size={32} color={cfg.text} />
              </View>
              <Text style={[styles.heroStatus, { color: cfg.text }]}>
                {cfg.label}
              </Text>
              <Text style={[styles.heroKind, { color: cfg.text + "cc" }]}>
                {isFg ? "Finished goods" : "Material batch"}
              </Text>
            </View>
          ) : null}

          <View style={styles.floatCard}>
            <View style={styles.floatCardHeader}>
              <Text style={styles.floatBatch} numberOfLines={2}>
                {data.batch_number || "—"}
              </Text>
              <StatusBadge
                status={data.status}
                type={isFg ? "fg" : "batch"}
                size="sm"
              />
            </View>
            <Text style={styles.floatTitle} numberOfLines={2}>
              {isFg
                ? data.product_name || "—"
                : data.material_name || "—"}
            </Text>
            {!isFg && data.material_code ? (
              <Text style={styles.floatCode}>{data.material_code}</Text>
            ) : null}
            <Text style={styles.floatId}>ID #{data.id}</Text>
          </View>

          {data.qa_scan_blocked ? (
            <View style={styles.warnBanner}>
              <Ionicons name="warning-outline" size={20} color={Colors.warning} />
              <Text style={styles.warnText}>{data.qa_scan_message}</Text>
            </View>
          ) : null}

          <Text style={styles.sectionLabel}>At a glance</Text>
          <View style={styles.chipRow}>
            {isFg ? (
              <>
                <GlanceChip
                  icon="cube-outline"
                  label="Quantity"
                  sub={formatQuantity(data.quantity)}
                  tint={Colors.primary}
                />
                <GlanceChip
                  icon="calendar-outline"
                  label="Expiry"
                  sub={formatDate(data.expiry_date)}
                  tint={Colors.danger}
                />
                <GlanceChip
                  icon="construct-outline"
                  label="Mfg"
                  sub={formatDate(data.manufacture_date)}
                  tint={Colors.info}
                />
              </>
            ) : (
              <>
                <GlanceChip
                  icon="layers-outline"
                  label="Balance"
                  sub={
                    data.total_quantity != null && data.total_quantity !== ""
                      ? `${formatQuantity(data.remaining_quantity)} / ${formatQuantity(data.total_quantity)}`
                      : formatQuantity(data.remaining_quantity)
                  }
                  tint={Colors.primary}
                />
                <GlanceChip
                  icon="calendar-outline"
                  label="Expiry"
                  sub={formatDate(data.expiry_date)}
                  tint={Colors.danger}
                />
                <GlanceChip
                  icon={data.retest_date ? "refresh-outline" : "pricetag-outline"}
                  label={data.retest_date ? "Retest" : "Product no."}
                  sub={
                    data.retest_date
                      ? formatDate(data.retest_date)
                      : data.grn_number || "—"
                  }
                  tint={data.retest_date ? Colors.warning : Colors.textSecondary}
                />
              </>
            )}
          </View>

          <View style={styles.factsCard}>
            <Text style={styles.sectionLabel}>Important details</Text>
            {!isFg ? (
              <>
                <FactRow
                  icon="business-outline"
                  label="Supplier"
                  value={data.supplier_name || "—"}
                />
                <View style={styles.factDivider} />
                <FactRow
                  icon="barcode-outline"
                  label="GRN / Product no."
                  value={data.grn_number || "—"}
                />
                <View style={styles.factDivider} />
                <FactRow
                  icon="git-branch-outline"
                  label="Rack location"
                  value={data.rack_number || "—"}
                />
                <View style={styles.factDivider} />
                <FactRow
                  icon="flask-outline"
                  label="AR number"
                  value={data.ar_number || "—"}
                />
              </>
            ) : (
              <FactRow
                icon="information-circle-outline"
                label="FG batch"
                value={data.batch_number || "—"}
              />
            )}
          </View>

          {data.remaining_quantity_hidden && !isFg ? (
            <Text style={styles.hintMuted}>
              Full balance is visible after QC approves this batch.
            </Text>
          ) : null}

          {data.id && !isFg ? (
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() =>
                navigation.navigate("BatchDetail", { batchId: data.id })
              }
              activeOpacity={0.75}
            >
              <Text style={styles.linkBtnText}>Open full batch record</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
            </TouchableOpacity>
          ) : null}

          <Button
            title="Scan another"
            onPress={reset}
            variant="outline"
            fullWidth
            style={{ marginTop: Spacing.md }}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primary },
  safeLight: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primary,
    ...Platform.select({ ios: Shadow.sm, android: { elevation: 6 } }),
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
  overlayRoot: { ...StyleSheet.absoluteFillObject, justifyContent: "center" },
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
  bottomBar: { position: "absolute", left: 0, right: 0, alignItems: "center" },
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
});

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  scrollContent: {
    paddingBottom: Spacing.xxl,
    paddingHorizontal: Spacing.md,
  },
  hero: {
    marginHorizontal: -Spacing.md,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl + 8,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroIconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.35)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  heroStatus: {
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 0.4,
  },
  heroKind: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    marginTop: 6,
  },
  floatCard: {
    backgroundColor: Colors.surface,
    marginTop: -Spacing.xl - 8,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadow.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  floatCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  floatBatch: {
    flex: 1,
    fontSize: FontSize.lg,
    fontWeight: "800",
    color: Colors.primary,
  },
  floatTitle: {
    fontSize: FontSize.md,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginTop: 4,
  },
  floatCode: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 4,
    fontWeight: "600",
  },
  floatId: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
    fontWeight: "600",
  },
  warnBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    backgroundColor: Colors.warningLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
  },
  warnText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: "800",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    justifyContent: "space-between",
  },
  chip: {
    width: "31%",
    minWidth: 100,
    flexGrow: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    ...Shadow.sm,
  },
  chipIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  chipLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chipSub: {
    fontSize: FontSize.sm,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginTop: 2,
  },
  factsCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.md,
    ...Shadow.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  factRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  factText: { flex: 1 },
  factLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: "600",
    marginBottom: 2,
  },
  factValue: {
    fontSize: FontSize.sm,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  factDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderLight,
  },
  hintMuted: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontStyle: "italic",
    marginTop: Spacing.md,
    textAlign: "center",
    lineHeight: 18,
  },
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  linkBtnText: {
    fontSize: FontSize.sm,
    fontWeight: "800",
    color: Colors.primary,
  },
});
