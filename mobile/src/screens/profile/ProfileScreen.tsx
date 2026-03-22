import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import {
  Colors, RoleLabels,
  FontSize, Spacing, BorderRadius, Shadow,
} from '../../utils/theme';

const InfoRow: React.FC<{ icon: string; label: string; value: string }> = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIconWrap}>
      <Ionicons name={icon as any} size={20} color={Colors.primary} />
    </View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  </View>
);

const Divider = () => <View style={styles.divider} />;

export const ProfileScreen: React.FC = () => {
  const { user, clearAuth } = useAuthStore();

  /** Same navy as rest of app — no per-role accent on Profile. */
  const roleLabel = RoleLabels[user?.role || ''] || (user?.role || 'User');
  const initials = (user?.name || user?.username || 'U')
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: clearAuth },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarWrap}>
            <View style={[styles.avatar, { backgroundColor: Colors.primary }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={[styles.roleBadge, { backgroundColor: Colors.primary }]}>
              <Text style={styles.roleBadgeText}>{roleLabel}</Text>
            </View>
          </View>
          <Text style={styles.name}>{user?.name || user?.username}</Text>
          <Text style={styles.username}>@{user?.username}</Text>
        </View>

        {/* Account Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          <View style={styles.card}>
            <InfoRow icon="text-outline" label="Full Name" value={user?.name || ''} />
            <Divider />
            <InfoRow icon="mail-outline" label="Email" value={user?.email || ''} />
            <Divider />
            <InfoRow icon="person-outline" label="Username" value={user?.username || ''} />
            <Divider />
            <InfoRow icon="call-outline" label="Phone" value={user?.phone ? String(user.phone) : '—'} />
            <Divider />
            <InfoRow icon="shield-checkmark-outline" label="Role" value={roleLabel} />
            <Divider />
            <InfoRow
              icon="ellipse-outline"
              label="Account Status"
              value={user?.is_active ? 'Active' : 'Inactive'}
            />
          </View>
        </View>

        {/* Security */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <View style={styles.card}>
            <View style={styles.menuRow}>
              <View style={styles.menuLeft}>
                <View style={[styles.menuIconWrap, { backgroundColor: Colors.primaryLight + '18' }]}>
                  <Ionicons name="lock-closed-outline" size={20} color={Colors.primaryLight} />
                </View>
                <Text style={styles.menuText}>First Login Reset</Text>
              </View>
              <Text style={styles.menuValue}>
                {user?.is_first_login ? 'Required' : 'Done'}
              </Text>
            </View>
          </View>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Application</Text>
          <View style={styles.card}>
            <View style={styles.menuRow}>
              <View style={styles.menuLeft}>
                <View style={[styles.menuIconWrap, { backgroundColor: Colors.info + '18' }]}>
                  <Ionicons name="information-circle-outline" size={20} color={Colors.info} />
                </View>
                <Text style={styles.menuText}>Version</Text>
              </View>
              <Text style={styles.menuValue}>1.0.0</Text>
            </View>
            <Divider />
            <View style={styles.menuRow}>
              <View style={styles.menuLeft}>
                <View style={[styles.menuIconWrap, { backgroundColor: Colors.success + '18' }]}>
                  <Ionicons name="server-outline" size={20} color={Colors.success} />
                </View>
                <Text style={styles.menuText}>Environment</Text>
              </View>
              <Text style={styles.menuValue}>Development</Text>
            </View>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={20} color="#fff" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>QTrack — Warehouse & Quality Management</Text>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primary },
  scroll: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 30,
    paddingHorizontal: Spacing.lg,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    ...Shadow.lg,
  },
  avatarWrap: { position: 'relative', marginBottom: 14 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
    ...Shadow.md,
  },
  avatarText: { fontSize: 36, fontWeight: '800', color: '#fff' },
  roleBadge: {
    position: 'absolute',
    bottom: -2,
    right: -8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  roleBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  name: { fontSize: FontSize.xl, fontWeight: '800', color: '#fff', marginBottom: 3 },
  username: { fontSize: FontSize.md, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },

  // Sections
  section: { paddingHorizontal: Spacing.md, marginTop: Spacing.lg },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    marginLeft: 4,
  },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    ...Shadow.md,
  },
  divider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: 2 },

  // Info rows
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  infoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 2 },
  infoValue: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '500' },

  // Menu rows
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center' },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuText: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '500' },
  menuValue: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.danger,
    borderRadius: BorderRadius.md,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
    ...Shadow.md,
    shadowColor: Colors.danger,
  },
  logoutText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },

  footer: {
    textAlign: 'center',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
});
