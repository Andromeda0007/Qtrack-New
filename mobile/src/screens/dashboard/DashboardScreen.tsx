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
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/authStore";
import { inventoryApi } from "../../api/inventory";
import { notificationsApi } from "../../api/notifications";
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

const ROLE_QUICK_ACTIONS: Record<RoleName, QuickAction[]> = {
  WAREHOUSE_USER: [
    {
      label: "Create GRN",
      icon: "add-circle",
      color: Colors.primary,
      screen: "CreateGRN",
    },
    { label: "Scan QR", icon: "scan", color: Colors.accent, screen: "Scanner" },
    {
      label: "Issue Stock",
      icon: "arrow-up-circle",
      color: Colors.success,
      screen: "Batches",
    },
    { label: "All Stock", icon: "cube", color: Colors.info, screen: "Batches" },
  ],
  WAREHOUSE_HEAD: [
    {
      label: "Manage Users",
      icon: "people",
      color: Colors.primary,
      screen: "Admin",
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
    {
      label: "Quarantine",
      icon: "alert-circle",
      color: Colors.warning,
      screen: "Batches",
    },
    {
      label: "Under Test",
      icon: "flask",
      color: Colors.info,
      screen: "Batches",
    },
  ],
  QC_HEAD: [
    {
      label: "Scan Batch",
      icon: "scan",
      color: Colors.accent,
      screen: "Scanner",
    },
    {
      label: "Pending Tests",
      icon: "flask",
      color: Colors.info,
      screen: "Batches",
    },
    {
      label: "Approve / Reject",
      icon: "checkmark-circle",
      color: Colors.success,
      screen: "Batches",
    },
  ],
  QA_EXECUTIVE: [
    { label: "Scan FG", icon: "scan", color: Colors.accent, screen: "Scanner" },
    {
      label: "Inspect FG",
      icon: "eye",
      color: Colors.primary,
      screen: "Scanner",
    },
  ],
  QA_HEAD: [
    { label: "Scan FG", icon: "scan", color: Colors.accent, screen: "Scanner" },
    {
      label: "Inspect FG",
      icon: "eye",
      color: Colors.primary,
      screen: "Scanner",
    },
    {
      label: "Approve FG",
      icon: "checkmark-done",
      color: Colors.success,
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
      label: "View Stock",
      icon: "cube",
      color: Colors.primary,
      screen: "Batches",
    },
    {
      label: "Stock Report",
      icon: "bar-chart",
      color: Colors.info,
      screen: "Batches",
    },
  ],
};

export const DashboardScreen: React.FC = () => {
  const { user, clearAuth } = useAuthStore();
  const navigation = useNavigation<any>();
  const [stats, setStats] = useState({
    quarantine: 0,
    underTest: 0,
    approved: 0,
    rejected: 0,
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [batches, notifications] = await Promise.all([
        inventoryApi.getBatches(),
        notificationsApi.getNotifications(true),
      ]);
      setStats({
        quarantine: batches.filter(
          (b) => b.status === "QUARANTINE" || b.status === "QUARANTINE_RETEST",
        ).length,
        underTest: batches.filter((b) => b.status === "UNDER_TEST").length,
        approved: batches.filter((b) => b.status === "APPROVED").length,
        rejected: batches.filter((b) => b.status === "REJECTED").length,
      });
      setUnreadCount(notifications.length);
    } catch {
      // Silent fail on dashboard stats
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

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
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {/* Product Stats */}
          <Text style={styles.sectionTitle}>Product Stats</Text>
          <View style={styles.statsGrid}>
            {[
              {
                label: "Quarantine",
                value: stats.quarantine,
                color: Colors.warning,
                icon: "hourglass-outline",
              },
              {
                label: "Under Test",
                value: stats.underTest,
                color: Colors.info,
                icon: "flask",
              },
              {
                label: "Approved",
                value: stats.approved,
                color: Colors.success,
                icon: "checkmark-circle",
              },
              {
                label: "Rejected",
                value: stats.rejected,
                color: Colors.danger,
                icon: "close-circle",
              },
            ].map((stat) => (
              <TouchableOpacity
                key={stat.label}
                style={styles.statCard}
                onPress={() => navigation.navigate("Batches")}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.statIconWrap,
                    { backgroundColor: stat.color + "18" },
                  ]}
                >
                  <Ionicons
                    name={stat.icon as any}
                    size={22}
                    color={stat.color}
                  />
                </View>
                <Text style={[styles.statValue, { color: stat.color }]}>
                  {stat.value}
                </Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
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
    paddingBottom: 39,
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
  notifBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: Colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  notifBadgeText: { fontSize: 9, fontWeight: "800", color: "#fff" },
  body: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, marginTop: 0 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
    marginTop: 0,
    rowGap: Spacing.sm,
  },
  statCard: {
    width: "48.5%",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    ...Shadow.sm,
  },
  statIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  statValue: { fontSize: FontSize.xl, fontWeight: "800" },
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
