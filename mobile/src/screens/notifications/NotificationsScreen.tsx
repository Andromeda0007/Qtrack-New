import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { notificationsApi } from '../../api/notifications';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Colors, FontSize, Spacing } from '../../utils/theme';
import { formatDateTime } from '../../utils/formatters';
import { Notification } from '../../types';

const TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  RETEST_ALERT:    { icon: 'refresh-circle', color: Colors.warning },
  EXPIRY_ALERT:    { icon: 'timer', color: Colors.danger },
  QC_ALERT:        { icon: 'flask', color: Colors.info },
  APPROVAL_ALERT:  { icon: 'checkmark-circle', color: Colors.success },
  REJECTION_ALERT: { icon: 'close-circle', color: Colors.danger },
  SYSTEM_ALERT:    { icon: 'notifications', color: Colors.primary },
  INVENTORY_ALERT: { icon: 'cube', color: Colors.accent },
};

export const NotificationsScreen: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await notificationsApi.getNotifications();
      setNotifications(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadNotifications(); }, []);

  const handleMarkRead = async (id: number) => {
    await notificationsApi.markRead(id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const renderItem = ({ item }: { item: Notification }) => {
    const typeInfo = TYPE_ICONS[item.notification_type] || TYPE_ICONS.SYSTEM_ALERT;
    return (
      <TouchableOpacity onPress={() => !item.is_read && handleMarkRead(item.id)} activeOpacity={0.8}>
        <Card style={[styles.notifCard, !item.is_read && styles.unreadCard]}>
          <View style={styles.notifRow}>
            <View style={[styles.iconCircle, { backgroundColor: typeInfo.color + '18' }]}>
              <Ionicons name={typeInfo.icon as any} size={20} color={typeInfo.color} />
            </View>
            <View style={styles.notifBody}>
              <View style={styles.notifTitleRow}>
                <Text style={[styles.notifTitle, !item.is_read && styles.unreadTitle]}>{item.title}</Text>
                {!item.is_read && <View style={styles.unreadDot} />}
              </View>
              <Text style={styles.notifMessage}>{item.message}</Text>
              <Text style={styles.notifTime}>{formatDateTime(item.created_at)}</Text>
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 && <Text style={styles.subtitle}>{unreadCount} unread</Text>}
        </View>
        {unreadCount > 0 && (
          <Button title="Mark All Read" onPress={handleMarkAllRead} variant="ghost" style={styles.markAllBtn} textStyle={styles.markAllText} />
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id.toString()}
        renderItem={renderItem}
        style={styles.listArea}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadNotifications(); }} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primary },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.md, backgroundColor: Colors.primary,
  },
  title: { fontSize: FontSize.xl, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: FontSize.xs, color: Colors.accent, marginTop: 2, fontWeight: '600' },
  markAllBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  markAllText: { color: Colors.accent, fontSize: FontSize.sm },
  listArea: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md },
  notifCard: { marginBottom: Spacing.sm },
  unreadCard: { borderLeftWidth: 3, borderLeftColor: Colors.primary },
  notifRow: { flexDirection: 'row', gap: Spacing.sm },
  iconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  notifBody: { flex: 1 },
  notifTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notifTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
  unreadTitle: { color: Colors.primary },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginLeft: Spacing.xs },
  notifMessage: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 3, lineHeight: 17 },
  notifTime: { fontSize: 10, color: Colors.textMuted, marginTop: 4 },
  empty: { alignItems: 'center', paddingTop: Spacing.xxl, gap: Spacing.md },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted },
});
