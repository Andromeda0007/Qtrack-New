import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/authStore";
import { inventoryApi } from "../../api/inventory";
import { productionApi } from "../../api/production";
import {
  Colors,
  RoleLabels,
  FontSize,
  Spacing,
  Shadow,
} from "../../utils/theme";
import { RoleName } from "../../types";

interface QuickAction {
  label: string;
  icon: string;
  color: string;
  screen: string;
  params?: Record<string, any>;
}

/** Read-only scan: status hero + glance chips (all roles). Same scan icon as workflow scanner; teal differentiates tile. */
const CHECK_STATUS_ACTION: QuickAction = {
  label: "Check Status",
  icon: "scan",
  color: "#0d9488",
  screen: "CheckStatus",
};

interface ProductStats {
  quarantine: number;
  underTest: number;
  approved: number;
  rejected: number;
  retest: number;
  production: number;
}

interface FGStats {
  qa_pending: number;
  qa_needs_inspection: number;
  qa_awaiting_decision: number;
  qa_approved: number;
  qa_released: number;
  qa_rejected: number;
  warehouse_received: number;
  dispatched: number;
}

type StatTile = {
  label: string;
  color: string;
  icon: string;
  screen: string;
  params?: Record<string, any>;
  badge?: number;
  getValue: (s: ProductStats, fg: FGStats) => number;
};

const RAW_STAT_TILES: StatTile[] = [
  { label: "Quarantine",  color: Colors.warning,          icon: "hourglass-outline",    screen: "QuarantineList", getValue: (s) => s.quarantine },
  { label: "Under Test",  color: Colors.info,             icon: "flask",                screen: "UnderTestList",  getValue: (s) => s.underTest },
  { label: "Approved",    color: Colors.success,          icon: "checkmark-circle",     screen: "ApprovedList",   getValue: (s) => s.approved + s.production },
  { label: "Rejected",    color: Colors.danger,           icon: "close-circle",         screen: "RejectedList",   getValue: (s) => s.rejected },
  { label: "Retest",      color: Colors.statusQuarantine, icon: "refresh-circle-outline", screen: "RetestList",   getValue: (s) => s.retest },
];

const PRODUCTION_USER_TILES: StatTile[] = [
  { label: "Approved",      color: Colors.success, icon: "checkmark-circle",  screen: "ApprovedList",  getValue: (s) => s.approved + s.production },
  { label: "QA Pending FG", color: Colors.warning, icon: "hourglass-outline", screen: "FGBatchList",   params: { status: "QA_PENDING", title: "QA Pending FG" }, getValue: (_, fg) => fg.qa_pending },
  { label: "Approved FG",   color: Colors.success, icon: "checkmark-circle",  screen: "FGBatchList",   params: { status: "QA_APPROVED", title: "Approved FG" }, getValue: (_, fg) => fg.qa_approved },
];

const QA_STAT_TILES: StatTile[] = [
  { label: "Awaiting Decision", color: Colors.warning, icon: "hourglass-outline", screen: "WorkflowHub", params: { mode: "qa_decision" }, getValue: (_, fg) => fg.qa_awaiting_decision },
  { label: "Approved FG",       color: Colors.success, icon: "ribbon-outline",    screen: "FGBatchList", params: { status: "QA_APPROVED", title: "Approved FG" }, getValue: (_, fg) => fg.qa_approved },
  { label: "Rejected FG",       color: Colors.danger,  icon: "close-circle",      screen: "FGBatchList", params: { status: "QA_REJECTED", title: "Rejected FG" }, getValue: (_, fg) => fg.qa_rejected },
];

const QA_EXEC_TILES: StatTile[] = [
  { label: "Needs Inspection", color: Colors.warning, icon: "hourglass-outline",        screen: "WorkflowHub", params: { mode: "qa_inspect" }, getValue: (_, fg) => fg.qa_needs_inspection },
  { label: "Ready to Release", color: Colors.success, icon: "checkmark-done-outline",  screen: "WorkflowHub", params: { mode: "qa_release" }, getValue: (_, fg) => fg.qa_approved },
  { label: "Rejected FG",      color: Colors.danger,  icon: "close-circle",             screen: "FGBatchList", params: { status: "QA_REJECTED", title: "Rejected FG" }, getValue: (_, fg) => fg.qa_rejected },
];

const ROLE_STAT_TILES: Partial<Record<RoleName, StatTile[]>> = {
  PRODUCTION_USER: PRODUCTION_USER_TILES,
  QA_HEAD: QA_STAT_TILES,
  QA_EXECUTIVE: QA_EXEC_TILES,
};

/**
 * Quick actions render in a 2-column grid (row-major). **Check Status is at index 1** when there
 * are 2+ actions so it sits in **row 1, column 2**.
 *
 * Scanner tile **labels** differ by role (same `Scanner` screen / `RoleActions` unless you add params).
 */
const ROLE_QUICK_ACTIONS: Record<RoleName, QuickAction[]> = {
  /** R1: Create GRN | Check Status — R2: Move to Production | Receive FG | Dispatch FG | Retesting */
  WAREHOUSE_USER: [
    {
      label: "Create GRN",
      icon: "add-circle",
      color: Colors.primary,
      screen: "CreateCard",
    },
    CHECK_STATUS_ACTION,
    {
      label: "Move to Production",
      icon: "arrow-forward-circle-outline",
      color: Colors.info,
      screen: "WorkflowHub",
      params: { mode: "warehouse_issue" },
    },
    {
      label: "Receive FG",
      icon: "arrow-down-circle-outline",
      color: Colors.success,
      screen: "FGReceiveList",
    },
    {
      label: "Dispatch FG",
      icon: "arrow-forward-circle",
      color: "#7c3aed",
      screen: "FGDispatchList",
    },
    {
      label: "Retesting",
      icon: "refresh-circle-outline",
      color: Colors.statusQuarantine,
      screen: "RetestList",
    },
  ],
  /** R1: Manage Users | Check Status — R2: Manage Items | Audit Logs | Retesting */
  WAREHOUSE_HEAD: [
    {
      label: "Manage Users",
      icon: "people",
      color: Colors.primary,
      screen: "Admin",
      params: { tab: "users" },
    },
    CHECK_STATUS_ACTION,
    {
      label: "Manage Items",
      icon: "cube",
      color: Colors.accent,
      screen: "ItemsList",
    },
    {
      label: "Audit Logs",
      icon: "document-text",
      color: Colors.info,
      screen: "Admin",
      params: { tab: "audit" },
    },
    {
      label: "Retesting",
      icon: "refresh-circle-outline",
      color: Colors.statusQuarantine,
      screen: "RetestList",
    },
  ],
  /** R1: Test | Check Status */
  QC_EXECUTIVE: [
    {
      label: "Test",
      icon: "clipboard-outline",
      color: Colors.accent,
      screen: "WorkflowHub",
      params: { mode: "qc_test" },
    },
    CHECK_STATUS_ACTION,
  ],
  /** R1: Approve / Reject | Check Status */
  QC_HEAD: [
    {
      label: "Approve / Reject",
      icon: "clipboard-outline",
      color: Colors.primary,
      screen: "WorkflowHub",
      params: { mode: "qc_decision" },
    },
    CHECK_STATUS_ACTION,
  ],
  /** R1: Inspect FG | Check Status — R2: Release FG */
  QA_EXECUTIVE: [
    {
      label: "Inspect FG",
      icon: "scan",
      color: Colors.accent,
      screen: "WorkflowHub",
      params: { mode: "qa_inspect" },
    },
    CHECK_STATUS_ACTION,
    {
      label: "Release FG",
      icon: "checkmark-done-circle-outline",
      color: Colors.success,
      screen: "WorkflowHub",
      params: { mode: "qa_release" },
    },
  ],
  /** R1: Approve / Reject FG | Check Status */
  QA_HEAD: [
    {
      label: "Approve / Reject FG",
      icon: "clipboard-outline",
      color: Colors.primary,
      screen: "WorkflowHub",
      params: { mode: "qa_decision" },
    },
    CHECK_STATUS_ACTION,
  ],
  /** R1: Create FG | Check Status — R2: Consume Material | My FG Batches */
  PRODUCTION_USER: [
    {
      label: "Create FG Batch",
      icon: "construct",
      color: Colors.primary,
      screen: "CreateFGBatch",
    },
    CHECK_STATUS_ACTION,
    {
      label: "Consume Material",
      icon: "layers-outline",
      color: Colors.accent,
      screen: "WorkflowHub",
      params: { mode: "production_consume" },
    },
    {
      label: "My FG Batches",
      icon: "cube-outline",
      color: Colors.info,
      screen: "FGBatchList",
      params: { title: "My FG Batches" },
    },
  ],
  /** R1: Approved | Check Status — R2: All Products */
  PURCHASE_USER: [
    {
      label: "Approved",
      icon: "checkmark-circle",
      color: Colors.success,
      screen: "ApprovedList",
    },
    CHECK_STATUS_ACTION,
    {
      label: "All Products",
      icon: "cube",
      color: Colors.primary,
      screen: "QuarantineList",
    },
  ],
};

const FG_ROLES: RoleName[] = ["PRODUCTION_USER", "QA_HEAD", "QA_EXECUTIVE"];
const RETEST_ALERT_ROLES: RoleName[] = ["WAREHOUSE_HEAD", "WAREHOUSE_USER", "QC_HEAD", "QC_EXECUTIVE"];

export const DashboardScreen: React.FC = () => {
  const { user } = useAuthStore();
  const navigation = useNavigation<any>();
  const role = (user?.role || "PURCHASE_USER") as RoleName;

  const [stats, setStats] = useState<ProductStats>({
    quarantine: 0, underTest: 0, approved: 0, rejected: 0, retest: 0, production: 0,
  });
  const [fgStats, setFgStats] = useState<FGStats>({
    qa_pending: 0, qa_needs_inspection: 0, qa_awaiting_decision: 0,
    qa_approved: 0, qa_released: 0, qa_rejected: 0, warehouse_received: 0, dispatched: 0,
  });
  const [retestDueSoon, setRetestDueSoon] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const needsAlert = RETEST_ALERT_ROLES.includes(role);
      if (FG_ROLES.includes(role)) {
        const [batches, fg] = await Promise.all([
          inventoryApi.getBatches(),
          productionApi.getFGBatchStats(),
        ]);
        setStats({
          quarantine: batches.filter((b) => b.status === "QUARANTINE").length,
          underTest: batches.filter((b) => b.status === "UNDER_TEST").length,
          approved: batches.filter((b) => b.status === "APPROVED").length,
          rejected: batches.filter((b) => b.status === "REJECTED").length,
          retest: batches.filter((b) => b.status === "QUARANTINE_RETEST").length,
          production: batches.filter((b) => b.status === "ISSUED_TO_PRODUCTION").length,
        });
        setFgStats(fg);
      } else {
        const [batches, alertData] = await Promise.all([
          inventoryApi.getBatches(),
          needsAlert ? inventoryApi.getRetestDueAlerts() : Promise.resolve({ due_soon_count: 0 }),
        ]);
        setStats({
          quarantine: batches.filter((b) => b.status === "QUARANTINE").length,
          underTest: batches.filter((b) => b.status === "UNDER_TEST").length,
          approved: batches.filter((b) => b.status === "APPROVED").length,
          rejected: batches.filter((b) => b.status === "REJECTED").length,
          retest: batches.filter((b) => b.status === "QUARANTINE_RETEST").length,
          production: batches.filter((b) => b.status === "ISSUED_TO_PRODUCTION").length,
        });
        if (needsAlert) setRetestDueSoon(alertData.due_soon_count ?? 0);
      }
    } catch {
      // Silent fail on dashboard stats
    }
  }, [role]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const quickActions = ROLE_QUICK_ACTIONS[role] || [];
  const roleLabel = RoleLabels[role] || role;
  const baseTiles = ROLE_STAT_TILES[role] ?? RAW_STAT_TILES;
  const statTiles = baseTiles.map((tile) =>
    tile.label === "Retest" ? { ...tile, badge: retestDueSoon } : tile
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
            progressBackgroundColor={Colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Good {getTimeOfDay()},</Text>
            <Text style={styles.userName}>{user?.name || user?.username}</Text>
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>{roleLabel}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => navigation.getParent()?.navigate("Profile")}
            style={styles.avatarBtn}
          >
            <View
              style={[
                styles.avatarCircle,
                { backgroundColor: "rgba(255,255,255,0.2)" },
              ]}
            >
              <Text style={styles.avatarInitial}>
                {(user?.name || user?.username || "U")[0].toUpperCase()}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {/* Product Stats — compact vertical footprint so Quick Actions fit above the fold */}
          <Text style={[styles.sectionTitle, styles.statsSectionTitle]}>Product Stats</Text>
          <View style={styles.statsGrid}>
            {statTiles.map((tile) => (
              <TouchableOpacity
                key={tile.label}
                style={styles.statCard}
                onPress={() => navigation.navigate(tile.screen, tile.params)}
                activeOpacity={0.8}
              >
                <View style={[styles.statIconWrap, { backgroundColor: tile.color + "18" }]}>
                  <Ionicons name={tile.icon as any} size={18} color={tile.color} />
                </View>
                <Text style={[styles.statValue, { color: tile.color }]}>
                  {tile.getValue(stats, fgStats)}
                </Text>
                <Text style={styles.statLabel}>{tile.label}</Text>
                {(tile.badge ?? 0) > 0 && (
                  <View style={styles.tileBadge}>
                    <Text style={styles.tileBadgeText}>{tile.badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Quick Actions */}
          {quickActions.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, styles.quickActionsSectionTitle]}>
                Quick Actions
              </Text>
              <View style={styles.actionsGrid}>
                {quickActions.map((action) => (
                  <TouchableOpacity
                    key={action.label}
                    style={styles.actionCard}
                    onPress={() =>
                      navigation.navigate(action.screen, action.params)
                    }
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.actionIcon,
                        { backgroundColor: action.color + "15" },
                      ]}
                    >
                      <Ionicons
                        name={action.icon as any}
                        size={25}
                        color={action.color}
                      />
                    </View>
                    <Text style={styles.actionLabel} numberOfLines={2}>
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const getTimeOfDay = () => {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primary },
  scroll: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: Colors.primary,
    padding: 22,
    paddingBottom: 25,
  },
  greeting: { fontSize: FontSize.sm, color: "rgba(255,255,255,0.75)" },
  userName: {
    fontSize: FontSize.xxl,
    fontWeight: "800",
    color: "#fff",
    marginTop: 2,
  },
  rolePill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 6,
  },
  rolePillText: { fontSize: FontSize.xs, color: "#fff", fontWeight: "700" },
  avatarBtn: { position: "relative", marginTop: 7, marginRight: 6 },
  avatarCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.45)",
  },
  avatarInitial: { fontSize: 26, fontWeight: "800", color: "#fff" },
  body: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, marginTop: 0 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: Spacing.md,
    justifyContent: "space-between",
    marginTop: 0,
    rowGap: 6,
  },
  /** ~12% shorter tiles than previous (padding, icon, type) */
  statCard: {
    width: "48.5%",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingTop: 9,
    paddingBottom: 8,
    paddingHorizontal: Spacing.sm,
    ...Shadow.sm,
  },
  statIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  statValue: { fontSize: 16, fontWeight: "800" },
  statLabel: {
    fontSize: 8,
    color: Colors.textSecondary,
    textAlign: "center",
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  statsSectionTitle: {
    marginBottom: 10,
  },
  /** Tighter gap (1px less than default section title) before first quick-action row */
  quickActionsSectionTitle: {
    marginBottom: Spacing.sm,
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignContent: "flex-start",
    rowGap: Spacing.sm,
  },
  /** Fixed height so every tile matches across all rows (label uses up to 2 lines). */
  actionCard: {
    width: "48.5%",
    height: 112,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  actionIcon: {
    width: 53,
    height: 53,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  actionLabel: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.textPrimary,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: "100%",
  },
  tileBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.danger,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  tileBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
  },
});
