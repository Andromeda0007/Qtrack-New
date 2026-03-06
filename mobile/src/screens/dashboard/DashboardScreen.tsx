import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { inventoryApi } from '../../api/inventory';
import { notificationsApi } from '../../api/notifications';
import { Card } from '../../components/common/Card';
import { Colors, FontSize, Spacing, BatchStatusColors } from '../../utils/theme';
import { formatRole } from '../../utils/formatters';
import { RoleName } from '../../types';

interface QuickAction {
  label: string;
  icon: string;
  color: string;
  screen: string;
}

const ROLE_QUICK_ACTIONS: Record<RoleName, QuickAction[]> = {
  SUPER_ADMIN: [
    { label: 'Manage Users', icon: 'people', color: Colors.primary, screen: 'Admin' },
    { label: 'Audit Logs', icon: 'document-text', color: Colors.info, screen: 'Admin' },
    { label: 'Stock Report', icon: 'bar-chart', color: Colors.success, screen: 'Batches' },
  ],
  WAREHOUSE_USER: [
    { label: 'Create GRN', icon: 'add-circle', color: Colors.primary, screen: 'Scanner' },
    { label: 'Scan QR', icon: 'scan', color: Colors.accent, screen: 'Scanner' },
    { label: 'Issue Stock', icon: 'arrow-up-circle', color: Colors.success, screen: 'Batches' },
    { label: 'All Stock', icon: 'cube', color: Colors.info, screen: 'Batches' },
  ],
  WAREHOUSE_HEAD: [
    { label: 'Create GRN', icon: 'add-circle', color: Colors.primary, screen: 'Scanner' },
    { label: 'Scan QR', icon: 'scan', color: Colors.accent, screen: 'Scanner' },
    { label: 'Issue Stock', icon: 'arrow-up-circle', color: Colors.success, screen: 'Batches' },
    { label: 'Stock Report', icon: 'bar-chart', color: Colors.info, screen: 'Batches' },
  ],
  QC_EXECUTIVE: [
    { label: 'Scan Batch', icon: 'scan', color: Colors.accent, screen: 'Scanner' },
    { label: 'Quarantine', icon: 'alert-circle', color: Colors.warning, screen: 'Batches' },
    { label: 'Under Test', icon: 'flask', color: Colors.info, screen: 'Batches' },
  ],
  QC_HEAD: [
    { label: 'Scan Batch', icon: 'scan', color: Colors.accent, screen: 'Scanner' },
    { label: 'Pending Tests', icon: 'flask', color: Colors.info, screen: 'Batches' },
    { label: 'Approve / Reject', icon: 'checkmark-circle', color: Colors.success, screen: 'Batches' },
  ],
  QA_EXECUTIVE: [
    { label: 'Scan FG', icon: 'scan', color: Colors.accent, screen: 'Scanner' },
    { label: 'Inspect FG', icon: 'eye', color: Colors.primary, screen: 'Scanner' },
  ],
  QA_HEAD: [
    { label: 'Scan FG', icon: 'scan', color: Colors.accent, screen: 'Scanner' },
    { label: 'Inspect FG', icon: 'eye', color: Colors.primary, screen: 'Scanner' },
    { label: 'Approve FG', icon: 'checkmark-done', color: Colors.success, screen: 'Scanner' },
  ],
  PRODUCTION_USER: [
    { label: 'Create FG Batch', icon: 'construct', color: Colors.primary, screen: 'Scanner' },
    { label: 'Scan Material', icon: 'scan', color: Colors.accent, screen: 'Scanner' },
  ],
  PURCHASE_USER: [
    { label: 'View Stock', icon: 'cube', color: Colors.primary, screen: 'Batches' },
    { label: 'Stock Report', icon: 'bar-chart', color: Colors.info, screen: 'Batches' },
  ],
};

export const DashboardScreen: React.FC = () => {
  const { user, clearAuth } = useAuthStore();
  const navigation = useNavigation<any>();
  const [stats, setStats] = useState({ quarantine: 0, underTest: 0, approved: 0, expiringSoon: 0 });
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [batches, notifications] = await Promise.all([
        inventoryApi.getBatches(),
        notificationsApi.getNotifications(true),
      ]);
      setStats({
        quarantine: batches.filter((b) => b.status === 'QUARANTINE' || b.status === 'QUARANTINE_RETEST').length,
        underTest: batches.filter((b) => b.status === 'UNDER_TEST').length,
        approved: batches.filter((b) => b.status === 'APPROVED').length,
        expiringSoon: batches.filter((b) => {
          if (!b.expiry_date) return false;
          const days = (new Date(b.expiry_date).getTime() - Date.now()) / 86400000;
          return days <= 30 && days >= 0;
        }).length,
      });
      setUnreadCount(notifications.length);
    } catch {
      // Silent fail on dashboard stats
    }
  }, []);

  useEffect(() => { loadData(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const role = (user?.role || 'PURCHASE_USER') as RoleName;
  const quickActions = ROLE_QUICK_ACTIONS[role] || [];

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: clearAuth },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good {getTimeOfDay()},</Text>
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.role}>{formatRole(user?.role || '')}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.iconBtn}>
              <Ionicons name="notifications" size={24} color="#fff" />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={styles.iconBtn}>
              <Ionicons name="log-out-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.body}>
          {/* Stats Row */}
          <View style={styles.statsRow}>
            {[
              { label: 'Quarantine', value: stats.quarantine, color: Colors.warning, icon: 'alert-circle' },
              { label: 'Under Test', value: stats.underTest, color: Colors.info, icon: 'flask' },
              { label: 'Approved', value: stats.approved, color: Colors.success, icon: 'checkmark-circle' },
              { label: 'Expiring', value: stats.expiringSoon, color: Colors.danger, icon: 'timer' },
            ].map((stat) => (
              <TouchableOpacity key={stat.label} style={styles.statCard} onPress={() => navigation.navigate('Batches')}>
                <Ionicons name={stat.icon as any} size={22} color={stat.color} />
                <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Quick Actions */}
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.label}
                style={styles.actionCard}
                onPress={() => navigation.navigate(action.screen)}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIcon, { backgroundColor: action.color + '18' }]}>
                  <Ionicons name={action.icon as any} size={26} color={action.color} />
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const getTimeOfDay = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primary },
  scroll: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    backgroundColor: Colors.primary, padding: Spacing.lg, paddingBottom: Spacing.xl,
  },
  greeting: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)' },
  userName: { fontSize: FontSize.xl, fontWeight: '800', color: '#fff', marginTop: 2 },
  role: { fontSize: FontSize.xs, color: Colors.accent, marginTop: 2, fontWeight: '600' },
  headerActions: { flexDirection: 'row', gap: Spacing.sm },
  iconBtn: { padding: 8, position: 'relative' },
  badge: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: Colors.danger, borderRadius: 8,
    minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center',
  },
  badgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  body: { padding: Spacing.md, marginTop: -Spacing.md },
  statsRow: {
    flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg,
    backgroundColor: '#fff', borderRadius: 16, padding: Spacing.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  statCard: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: FontSize.xl, fontWeight: '800' },
  statLabel: { fontSize: 10, color: Colors.textSecondary, textAlign: 'center', fontWeight: '500' },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  actionCard: {
    width: '47%', backgroundColor: '#fff', borderRadius: 14, padding: Spacing.md,
    alignItems: 'center', gap: Spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  actionIcon: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  actionLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' },
});
