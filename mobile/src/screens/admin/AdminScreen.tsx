import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, Alert, RefreshControl, Modal, Clipboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { usersApi } from '../../api/users';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../../utils/theme';
import { formatDateTime, formatRole } from '../../utils/formatters';
import { User, Role } from '../../types';
import { extractError } from '../../api/client';

type Tab = 'users' | 'audit';

export const AdminScreen: React.FC = () => {
  const route = useRoute<any>();
  const [activeTab, setActiveTab] = useState<Tab>(route.params?.tab || 'users');

  // Re-sync tab whenever navigation params change (e.g. quick actions from Dashboard)
  useEffect(() => {
    setActiveTab(route.params?.tab || 'users');
  }, [route.params?.tab]);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', username: '', email: '', phone: '', role_id: 0 });
  const [creating, setCreating] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ name: string; username: string } | null>(null);

  const loadData = useCallback(async () => {
    // Load users and audit logs independently — one failure won't block the other
    try {
      const usersData = await usersApi.getUsers();
      setUsers(usersData);
    } catch (e) {
      setUsers([]);
    }
    try {
      const auditData = await usersApi.getAuditLogs({ limit: 50 });
      setAuditLogs(auditData);
    } catch (e) {
      setAuditLogs([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  const loadRoles = useCallback(async () => {
    try {
      const data = await usersApi.getRoles();
      setRoles(data);
      const purchaseUser = data.find((r: Role) => r.role_name === 'PURCHASE_USER');
      if (purchaseUser) {
        setCreateForm((f) => ({ ...f, role_id: purchaseUser.id }));
      }
    } catch (e) {
      // roles will be empty — retry on next modal open
    }
  }, []);

  useEffect(() => { loadData(); loadRoles(); }, []);

  const handleToggleActive = async (user: User) => {
    const action = user.is_active ? 'deactivate' : 'reactivate';
    Alert.alert(`${user.is_active ? 'Deactivate' : 'Reactivate'} User`,
      `Are you sure you want to ${action} ${user.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: user.is_active ? 'destructive' : 'default',
          onPress: async () => {
            try {
              if (user.is_active) await usersApi.deactivateUser(user.id);
              else await usersApi.reactivateUser(user.id);
              loadData();
            } catch (error) {
              Alert.alert('Error', extractError(error));
            }
          },
        },
      ]
    );
  };

  const handleCreateUser = async () => {
    if (!createForm.name || !createForm.username || !createForm.email || !createForm.phone || !createForm.role_id) {
      Alert.alert('Error', 'All fields are required. Please fill in Full Name, Username, Email, Phone and select a Role.'); return;
    }
    const phoneNum = parseInt(createForm.phone, 10);
    if (isNaN(phoneNum) || createForm.phone.length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number (at least 10 digits).'); return;
    }
    setCreating(true);
    try {
      const result = await usersApi.createUser({
        name: createForm.name,
        username: createForm.username,
        email: createForm.email,
        phone: phoneNum,
        role_id: createForm.role_id,
      });
      setShowCreateUser(false);
      const purchaseUser = roles.find((r) => r.role_name === 'PURCHASE_USER');
      setSuccessInfo({ name: createForm.name, username: result.username });
      setCreateForm({ name: '', username: '', email: '', phone: '', role_id: purchaseUser?.id || 0 });
      loadData();
    } catch (error) {
      Alert.alert('Error', extractError(error));
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Admin Panel</Text>
        {activeTab === 'users' && (
          <TouchableOpacity onPress={() => { setShowCreateUser(true); loadRoles(); }} style={styles.addBtn}>
            <Ionicons name="person-add" size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['users', 'audit'] as Tab[]).map((tab) => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'users' ? 'Users' : 'Audit Logs'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'users' ? (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id.toString()}
          style={styles.listArea}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: Colors.textMuted, marginTop: 40 }}>{loading ? 'Loading...' : 'No users found'}</Text>}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />}
          renderItem={({ item }) => (
            <Card>
              <View style={styles.userRow}>
                <View style={[styles.avatar, { backgroundColor: item.is_active ? Colors.primary + '20' : Colors.danger + '20' }]}>
                  <Text style={[styles.avatarText, { color: item.is_active ? Colors.primary : Colors.danger }]}>
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.name}</Text>
                  <Text style={styles.userUsername}>@{item.username}</Text>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleText}>{formatRole(item.role_name || '')}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleToggleActive(item)} style={[styles.statusBtn, { backgroundColor: item.is_active ? Colors.dangerLight : Colors.successLight }]}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: item.is_active ? Colors.danger : Colors.success }}>
                    {item.is_active ? 'Deactivate' : 'Activate'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          )}
        />
      ) : (
        <FlatList
          data={auditLogs}
          keyExtractor={(a) => a.id.toString()}
          style={styles.listArea}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Card padding={12}>
              <View style={styles.auditRow}>
                <View style={styles.auditDot} />
                <View style={styles.auditInfo}>
                  <Text style={styles.auditAction}>{item.action_type.replace(/_/g, ' ')}</Text>
                  <Text style={styles.auditDesc} numberOfLines={2}>{item.description || '—'}</Text>
                  <Text style={styles.auditMeta}>by {item.performed_by || '?'} · {formatDateTime(item.created_at)}</Text>
                </View>
              </View>
            </Card>
          )}
        />
      )}

      {/* Success Modal */}
      <Modal visible={!!successInfo} animationType="fade" transparent>
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconWrap}>
              <Ionicons name="checkmark-circle" size={56} color={Colors.success} />
            </View>
            <Text style={styles.successTitle}>User Created!</Text>
            <Text style={styles.successSubtitle}>
              Share these login credentials with{'\n'}
              <Text style={{ fontWeight: '700', color: Colors.textPrimary }}>{successInfo?.name}</Text>
            </Text>

            <View style={styles.credentialBox}>
              <View style={styles.credentialRow}>
                <View style={styles.credentialIconWrap}>
                  <Ionicons name="person-outline" size={16} color={Colors.primary} />
                </View>
                <View style={styles.credentialContent}>
                  <Text style={styles.credentialLabel}>Username</Text>
                  <Text style={styles.credentialValue}>{successInfo?.username}</Text>
                </View>
              </View>
              <View style={styles.credentialDivider} />
              <View style={styles.credentialRow}>
                <View style={styles.credentialIconWrap}>
                  <Ionicons name="lock-closed-outline" size={16} color={Colors.primary} />
                </View>
                <View style={styles.credentialContent}>
                  <Text style={styles.credentialLabel}>Password</Text>
                  <Text style={styles.credentialValue}>temp-password</Text>
                </View>
              </View>
            </View>

            <View style={styles.successNote}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.info} />
              <Text style={styles.successNoteText}>
                They will be prompted to set a new password on first login.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.successBtn}
              onPress={() => setSuccessInfo(null)}
              activeOpacity={0.85}
            >
              <Text style={styles.successBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Create User Modal */}
      <Modal visible={showCreateUser} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalSheet} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>Create New User</Text>
            <Input label="Full Name" placeholder="Enter the name" value={createForm.name} onChangeText={(v) => setCreateForm((f) => ({ ...f, name: v }))} />
            <Input label="Username" placeholder="Create username" value={createForm.username} onChangeText={(v) => setCreateForm((f) => ({ ...f, username: v }))} autoCapitalize="none" />
            <Input label="Email" placeholder="Enter your email" value={createForm.email} onChangeText={(v) => setCreateForm((f) => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" />
            <Input label="Phone" placeholder="9876543210" value={createForm.phone} onChangeText={(v) => setCreateForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" />

            <Text style={styles.roleLabel}>Role</Text>
            <View style={styles.roleList}>
              {roles.map((r, index) => {
                const isSelected = createForm.role_id === r.id;
                const label = r.role_name.replace(/_/g, ' ')
                  .split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                  .join(' ').replace('Qc', 'QC').replace('Qa', 'QA');
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[
                      styles.roleRow,
                      isSelected && styles.roleRowActive,
                      index === roles.length - 1 && { borderBottomWidth: 0 },
                    ]}
                    onPress={() => setCreateForm((f) => ({ ...f, role_id: r.id }))}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.roleRadio, isSelected && styles.roleRadioActive]}>
                      {isSelected && <View style={styles.roleRadioDot} />}
                    </View>
                    <Text style={[styles.roleRowText, isSelected && styles.roleRowTextActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <Button title="Cancel" onPress={() => setShowCreateUser(false)} variant="outline" style={{ flex: 1 }} />
              <Button title="Create" onPress={handleCreateUser} loading={creating} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primary },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, backgroundColor: Colors.primary },
  title: { fontSize: FontSize.xl, fontWeight: '800', color: '#fff' },
  addBtn: { padding: 8 },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.primary },
  listArea: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: FontSize.lg, fontWeight: '800' },
  userInfo: { flex: 1 },
  userName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  userUsername: { fontSize: FontSize.xs, color: Colors.textSecondary },
  roleBadge: { backgroundColor: Colors.primary + '15', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, alignSelf: 'flex-start', marginTop: 3 },
  roleText: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  statusBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  auditRow: { flexDirection: 'row', gap: Spacing.sm },
  auditDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginTop: 5 },
  auditInfo: { flex: 1 },
  auditAction: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  auditDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  auditMeta: { fontSize: 10, color: Colors.textMuted, marginTop: 3 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, maxHeight: '90%' },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md },
  roleLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm, marginTop: Spacing.xs },
  roleLabelRequired: { color: Colors.danger, fontSize: FontSize.sm },
  roleList: { marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, overflow: 'hidden' },
  roleRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: Spacing.md,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  roleRowActive: { backgroundColor: Colors.primary + '10' },
  roleRadio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: Colors.border, marginRight: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  roleRadioActive: { borderColor: Colors.primary },
  roleRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  roleRowText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  roleRowTextActive: { color: Colors.primary, fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, marginBottom: Spacing.xl },

  // Success modal
  successOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  successCard: {
    backgroundColor: '#fff', borderRadius: 24, padding: Spacing.lg,
    width: '100%', alignItems: 'center', ...Shadow.lg,
  },
  successIconWrap: { marginBottom: Spacing.sm },
  successTitle: {
    fontSize: FontSize.xl, fontWeight: '800',
    color: Colors.textPrimary, marginBottom: 6,
  },
  successSubtitle: {
    fontSize: FontSize.sm, color: Colors.textSecondary,
    textAlign: 'center', marginBottom: Spacing.md, lineHeight: 20,
  },
  credentialBox: {
    width: '100%', backgroundColor: Colors.background,
    borderRadius: BorderRadius.md, borderWidth: 1,
    borderColor: Colors.borderLight, marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  credentialRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: Spacing.md,
  },
  credentialIconWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primary + '12',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  credentialContent: { flex: 1 },
  credentialLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 2 },
  credentialValue: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  credentialDivider: { height: 1, backgroundColor: Colors.borderLight, marginHorizontal: Spacing.md },
  successNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: Colors.info + '12', borderRadius: BorderRadius.sm,
    padding: 10, width: '100%', marginBottom: Spacing.md,
  },
  successNoteText: {
    flex: 1, fontSize: FontSize.xs, color: Colors.info,
    lineHeight: 17, fontWeight: '500',
  },
  successBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 14, width: '100%', alignItems: 'center',
  },
  successBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
});
