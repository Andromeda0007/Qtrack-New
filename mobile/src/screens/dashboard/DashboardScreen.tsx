import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/authStore";
import { inventoryApi } from "../../api/inventory";
import { Card } from "../../components/common/Card";
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

/** Six tiles + routes for every role (2 columns × 3 rows): Quarantine → … → Production last. */
const PRODUCT_STAT_TILES: Array<{
  label: string;
  color: string;
  icon: string;
  screen: string;
  getValue: (s: ProductStats) => number;
}> = [
  {
    label: "Quarantine",
    color: Colors.warning,
    icon: "hourglass-outline",
    screen: "QuarantineList",
    getValue: (s) => s.quarantine,
  },
  {
    label: "Under Test",
    color: Colors.info,
    icon: "flask",
    screen: "UnderTestList",
    getValue: (s) => s.underTest,
  },
  {
    label: "Approved",
    color: Colors.success,
    icon: "checkmark-circle",
    screen: "ApprovedList",
    getValue: (s) => s.approved,
  },
  {
    label: "Rejected",
    color: Colors.danger,
    icon: "close-circle",
    screen: "RejectedList",
    getValue: (s) => s.rejected,
  },
  {
    label: "Retest",
    color: Colors.statusQuarantine,
    icon: "refresh-circle-outline",
    screen: "RetestList",
    getValue: (s) => s.retest,
  },
  {
    label: "Production",
    color: Colors.primary,
    icon: "layers-outline",
    screen: "ProductionList",
    getValue: (s) => s.production,
  },
];

interface ProductStats {
  quarantine: number;
  underTest: number;
  approved: number;
  rejected: number;
  retest: number;
  production: number;
}

const ROLE_QUICK_ACTIONS: Record<RoleName, QuickAction[]> = {
  WAREHOUSE_USER: [
    {
      label: "Create Card",
      icon: "add-circle",
      color: Colors.primary,
      screen: "CreateCard",
    },
    { label: "Scan QR", icon: "scan", color: Colors.info, screen: "Scanner" },
  ],
  WAREHOUSE_HEAD: [
    {
      label: "Manage Users",
      icon: "people",
      color: Colors.primary,
      screen: "Admin",
      params: { tab: "users" },
    },
    {
      label: "Audit Logs",
      icon: "document-text",
      color: Colors.info,
      screen: "Admin",
      params: { tab: "audit" },
    },
  ],
  QC_EXECUTIVE: [
    {
      label: "Scan Batch",
      icon: "scan",
      color: Colors.accent,
      screen: "Scanner",
    },
  ],
  QC_HEAD: [
    {
      label: "Approve / Reject",
      /** Review + record outcome (approve or reject) — not a checkmark-only metaphor */
      icon: "clipboard-outline",
      color: Colors.primary,
      screen: "Scanner",
    },
  ],
  QA_EXECUTIVE: [
    {
      label: "Scan FG",
      icon: "scan",
      color: Colors.accent,
      screen: "Scanner",
    },
  ],
  QA_HEAD: [
    {
      label: "Approve / Reject FG",
      icon: "clipboard-outline",
      color: Colors.primary,
      screen: "Scanner",
    },
  ],
  PRODUCTION_USER: [
    {
      label: "Create FG Batch",
      icon: "construct",
      color: Colors.primary,
      screen: "Scanner",
    },
    {
      label: "Scan Material",
      icon: "scan",
      color: Colors.accent,
      screen: "Scanner",
    },
  ],
  PURCHASE_USER: [
    {
      label: "Approved",
      icon: "checkmark-circle",
      color: Colors.success,
      screen: "ApprovedList",
    },
    {
      label: "All Products",
      icon: "cube",
      color: Colors.primary,
      screen: "QuarantineList",
    },
  ],
};

export const DashboardScreen: React.FC = () => {
  const { user, clearAuth } = useAuthStore();
  const navigation = useNavigation<any>();
  const [stats, setStats] = useState<ProductStats>({
    quarantine: 0,
    underTest: 0,
    approved: 0,
    rejected: 0,
    retest: 0,
    production: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const batches = await inventoryApi.getBatches();
      setStats({
        quarantine: batches.filter((b) => b.status === "QUARANTINE").length,
        underTest: batches.filter((b) => b.status === "UNDER_TEST").length,
        approved: batches.filter((b) => b.status === "APPROVED").length,
        rejected: batches.filter((b) => b.status === "REJECTED").length,
        retest: batches.filter((b) => b.status === "QUARANTINE_RETEST").length,
        production: batches.filter((b) => b.status === "ISSUED_TO_PRODUCTION")
          .length,
      });
    } catch {
      // Silent fail on dashboard stats
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

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

  const role = (user?.role || "PURCHASE_USER") as RoleName;
  const quickActions = ROLE_QUICK_ACTIONS[role] || [];
  const roleLabel = RoleLabels[role] || role;

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
          {/* Product Stats */}
          <Text style={styles.sectionTitle}>Product Stats</Text>
          <View style={styles.statsGrid}>
            {PRODUCT_STAT_TILES.map((tile) => (
              <TouchableOpacity
                key={tile.label}
                style={styles.statCard}
                onPress={() => navigation.navigate(tile.screen)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.statIconWrap,
                    { backgroundColor: tile.color + "18" },
                  ]}
                >
                  <Ionicons
                    name={tile.icon as any}
                    size={20}
                    color={tile.color}
                  />
                </View>
                <Text style={[styles.statValue, { color: tile.color }]}>
                  {tile.getValue(stats)}
                </Text>
                <Text style={styles.statLabel}>{tile.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Quick Actions */}
          {quickActions.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
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
                        size={26}
                        color={action.color}
                      />
                    </View>
                    <Text style={styles.actionLabel}>{action.label}</Text>
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
    marginBottom: Spacing.lg,
    justifyContent: "space-between",
    marginTop: 0,
    rowGap: Spacing.sm,
  },
  statCard: {
    width: "48.5%",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingTop: 12,
    paddingBottom: 10, // space below stat label (Total, Quarantine, etc.)
    paddingHorizontal: Spacing.sm,
    ...Shadow.sm,
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  statValue: { fontSize: 18, fontWeight: "800" },
  statLabel: {
    fontSize: 9,
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
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: Spacing.sm,
  },
  actionCard: {
    width: "48.5%",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.md,
    alignItems: "center",
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  actionIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  actionLabel: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.textPrimary,
    textAlign: "center",
  },
});
