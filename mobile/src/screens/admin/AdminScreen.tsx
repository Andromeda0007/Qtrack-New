import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, Alert, RefreshControl, Modal, TextInput, Pressable } from 'react-native';
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
type AuditCategory = 'all' | 'user' | 'card_creation' | 'approvals' | 'rejections';
type AuditSort = 'asc' | 'desc';

const AUDIT_CATEGORY_OPTIONS: { value: AuditCategory; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'user', label: 'User' },
  { value: 'card_creation', label: 'Card creation' },
  { value: 'approvals', label: 'Approved' },
  { value: 'rejections', label: 'Rejected' },
];

function getAuditStyle(actionType: string): { color: string; icon: string; bg: string } {
  const u = (actionType || '').toUpperCase();
  if (u.includes('REJECT')) return { color: Colors.danger, icon: 'close-circle', bg: Colors.dangerLight };
  if ((u.includes('CREATE') || u.includes('ADD')) && u.includes('USER')) return { color: Colors.primary, icon: 'person-add', bg: Colors.primary + '18' };
  if (u === 'CREATE_PRODUCT' || ((u.includes('CREATE') || u.includes('ADD')) && !u.includes('USER'))) return { color: '#856404', icon: 'document-text', bg: Colors.warningLight };
  if (u.includes('APPROVE') || u.includes('RECEIVE') || u.includes('INITIATE') || u.includes('DISPATCH') || u.includes('INSPECT') || u.includes('ISSUE') || u.includes('ADJUST') || u.includes('REQUEST')) return { color: Colors.success, icon: 'checkmark-circle', bg: Colors.successLight };
  if (u.includes('DELETE') || u.includes('DEACTIVATE')) return { color: Colors.danger, icon: 'trash', bg: Colors.dangerLight };
  if (u.includes('UPDATE') || u.includes('EDIT')) return { color: Colors.info, icon: 'create', bg: Colors.infoLight };
  if (u.includes('LOGIN') || u.includes('LOGOUT')) return { color: Colors.primary, icon: u.includes('OUT') ? 'log-out' : 'log-in', bg: Colors.primary + '18' };
  return { color: Colors.primary, icon: 'document-text', bg: Colors.primary + '18' };
}

function getEntityLabel(entityType: string | null): string {
  if (!entityType) return '';
  const m: Record<string, string> = { user: 'User #', batch: 'Batch #', material: 'Material #', supplier: 'Supplier #', fg_batch: 'FG Batch #' };
  return m[entityType.toLowerCase()] || `${entityType} #`;
}

function getEntityDisplayKey(entityType: string | null): string {
  if (!entityType) return '';
  const m: Record<string, string> = { user: 'newUser', batch: 'Batch', material: 'Material', supplier: 'Supplier', fg_batch: 'FG Batch' };
  return m[entityType.toLowerCase()] || entityType;
}

function getActionDisplayLabel(actionType: string): string {
  const u = (actionType || '').toUpperCase();
  if (u.includes('REJECT')) return 'Product Rejected';
  if (u.includes('APPROVE') || u.includes('RECEIVE') || u.includes('INITIATE')) return 'Product Approved';
  if ((u.includes('CREATE') || u.includes('ADD')) && u.includes('USER')) return 'User Created';
  if (u === 'CREATE_PRODUCT' || ((u.includes('CREATE') || u.includes('ADD')) && !u.includes('USER'))) return 'Product Created';
  const label = (actionType || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return label;
}

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

  const [auditCategory, setAuditCategory] = useState<AuditCategory>('all');
  const [auditSort, setAuditSort] = useState<AuditSort>('desc');
  const [auditSearchInput, setAuditSearchInput] = useState('');
  const [auditSearchApplied, setAuditSearchApplied] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const usersData = await usersApi.getUsers();
      setUsers(usersData);
    } catch (e) {
      setUsers([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  const [auditLoading, setAuditLoading] = useState(false);
  const loadAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    try {
      const auditData = await usersApi.getAuditLogs({
        category: auditCategory === 'all' ? undefined : auditCategory,
        search: auditSearchApplied.trim() || undefined,
        sort: auditSort,
        limit: 100,
      });
      setAuditLogs(auditData);
    } catch (e) {
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  }, [auditCategory, auditSort, auditSearchApplied]);

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
  useEffect(() => {
    if (activeTab === 'audit') loadAuditLogs();
  }, [activeTab, loadAuditLogs]);

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
        <View style={styles.auditContainer}>
          <View style={styles.auditFilterRow}>
            <TouchableOpacity style={styles.auditFilterBox} onPress={() => setShowCategoryPicker(true)}>
              <Text style={styles.auditFilterBoxText} numberOfLines={1}>
                {AUDIT_CATEGORY_OPTIONS.find((o) => o.value === auditCategory)?.label ?? 'All'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.auditSearchRow}>
            <TextInput
              style={styles.auditSearchInput}
              placeholder="Type a word or two, then tap Search"
              placeholderTextColor={Colors.textMuted}
              value={auditSearchInput}
              onChangeText={setAuditSearchInput}
              onSubmitEditing={() => { setAuditSearchApplied(auditSearchInput.trim()); }}
            />
            <TouchableOpacity
              style={styles.auditSearchBtn}
              onPress={() => { setAuditSearchApplied(auditSearchInput.trim()); }}
            >
              <Text style={styles.auditSearchBtnText}>Search</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.auditSortRow}>
            <TouchableOpacity
              style={[styles.auditSortChip, auditSort === 'desc' && styles.auditSortChipActive]}
              onPress={() => setAuditSort('desc')}
            >
              <Text style={[styles.auditSortChipText, auditSort === 'desc' && styles.auditSortChipTextActive]}>Newest first</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.auditSortChip, auditSort === 'asc' && styles.auditSortChipActive]}
              onPress={() => setAuditSort('asc')}
            >
              <Text style={[styles.auditSortChipText, auditSort === 'asc' && styles.auditSortChipTextActive]}>Oldest first</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={auditLogs}
            keyExtractor={(a) => a.id.toString()}
            style={styles.listArea}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAuditLogs().finally(() => setRefreshing(false)); }} tintColor={Colors.primary} />
            }
            ListEmptyComponent={
              <Text style={styles.auditEmpty}>{auditLoading ? 'Loading...' : 'No audit logs'}</Text>
            }
            renderItem={({ item }) => {
              const style = getAuditStyle(item.action_type);
              const actionLabel = getActionDisplayLabel(item.action_type);
              const entityDisplayKey = getEntityDisplayKey(item.entity_type);
              const entityValue = item.entity_type === 'user' && item.entity_id != null
                ? (item.entity_username ?? String(item.entity_id))
                : item.entity_id;
              const isApproval = (item.action_type || '').toUpperCase().includes('APPROVE') || (item.action_type || '').toUpperCase().includes('RECEIVE') || (item.action_type || '').toUpperCase().includes('INITIATE');
              const isRejection = (item.action_type || '').toUpperCase().includes('REJECT');
              return (
                <View style={[styles.auditCard, { borderLeftColor: style.color }]}>
                  <View style={styles.auditCardInner}>
                    <View style={[styles.auditPill, { backgroundColor: style.bg }]}>
                      <Text style={[styles.auditPillText, { color: style.color }]}>{actionLabel}</Text>
                    </View>
                    <View style={styles.auditKvRow}>
                      <Text style={styles.auditKey}>createdBy</Text>
                      <Text style={styles.auditVal}>{item.performed_by || '—'}</Text>
                    </View>
                    <View style={styles.auditKvRow}>
                      <Text style={styles.auditKey}>createdAt</Text>
                      <Text style={styles.auditVal}>{formatDateTime(item.created_at)}</Text>
                    </View>
                    {entityDisplayKey && item.entity_id != null && (
                      <View style={styles.auditKvRow}>
                        <Text style={styles.auditKey}>{entityDisplayKey}</Text>
                        <Text style={styles.auditVal}>{entityValue}</Text>
                      </View>
                    )}
                    {isApproval && (item.from_status || item.to_status) && (
                      <>
                        {item.from_status && (
                          <View style={styles.auditKvRow}>
                            <Text style={styles.auditKey}>Approved from</Text>
                            <Text style={styles.auditVal}>{item.from_status}</Text>
                          </View>
                        )}
                        {item.to_status && (
                          <View style={styles.auditKvRow}>
                            <Text style={styles.auditKey}>Approved to</Text>
                            <Text style={styles.auditVal}>{item.to_status}</Text>
                          </View>
                        )}
                      </>
                    )}
                    {isRejection && (item.from_status || item.to_status) && (
                      <>
                        {item.from_status && (
                          <View style={styles.auditKvRow}>
                            <Text style={styles.auditKey}>Rejected from</Text>
                            <Text style={styles.auditVal}>{item.from_status}</Text>
                          </View>
                        )}
                        {item.to_status && (
                          <View style={styles.auditKvRow}>
                            <Text style={styles.auditKey}>Rejected to</Text>
                            <Text style={styles.auditVal}>{item.to_status}</Text>
                          </View>
                        )}
                      </>
                    )}
                  </View>
                </View>
              );
            }}
          />
          <Modal visible={showCategoryPicker} transparent animationType="fade">
            <Pressable style={styles.categoryPickerOverlay} onPress={() => setShowCategoryPicker(false)}>
              <View style={styles.categoryPickerBox} onStartShouldSetResponder={() => true}>
                <ScrollView style={styles.categoryPickerScroll}>
                  {AUDIT_CATEGORY_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.categoryPickerItem, auditCategory === opt.value && styles.categoryPickerItemActive]}
                      onPress={() => { setAuditCategory(opt.value); setShowCategoryPicker(false); }}
                    >
                      <Text style={[styles.categoryPickerItemText, auditCategory === opt.value && styles.categoryPickerItemTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </Pressable>
          </Modal>
        </View>
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
  auditContainer: { flex: 1, backgroundColor: Colors.background },
  auditFilterRow: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  auditFilterBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md,
    paddingVertical: 12, paddingHorizontal: Spacing.md,
  },
  auditFilterBoxText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  auditSearchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  auditSearchInput: {
    flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md,
    paddingVertical: 10, paddingHorizontal: Spacing.md, fontSize: FontSize.sm, color: Colors.textPrimary,
  },
  auditSearchBtn: { backgroundColor: Colors.primary, paddingVertical: 10, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md },
  auditSearchBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '700' },
  auditSortRow: { flexDirection: 'row', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  auditSortChip: {
    flex: 1, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface, alignItems: 'center',
  },
  auditSortChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '15' },
  auditSortChipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  auditSortChipTextActive: { color: Colors.primary },
  auditEmpty: { textAlign: 'center', color: Colors.textMuted, marginTop: 40, fontSize: FontSize.sm },
  auditCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    borderLeftWidth: 4,
    overflow: 'hidden',
    ...Shadow.md,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  auditCardInner: { paddingHorizontal: 12, paddingVertical: 10 },
  auditPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginBottom: 6,
  },
  auditPillText: { fontSize: FontSize.xs, fontWeight: '700' },
  auditKvRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8, paddingLeft: '2%' },
  auditKey: { fontSize: 11, color: Colors.textMuted, minWidth: 72, fontWeight: '600' },
  auditVal: { fontSize: FontSize.xs, color: Colors.textPrimary, flex: 1, flexWrap: 'wrap' },
  categoryPickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.lg },
  categoryPickerBox: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, maxHeight: 320 },
  categoryPickerScroll: { maxHeight: 300 },
  categoryPickerItem: { paddingVertical: 14, paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  categoryPickerItemActive: { backgroundColor: Colors.primary + '12' },
  categoryPickerItemText: { fontSize: FontSize.sm, color: Colors.textPrimary },
  categoryPickerItemTextActive: { color: Colors.primary, fontWeight: '700' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: FontSize.lg, fontWeight: '800' },
  userInfo: { flex: 1 },
  userName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  userUsername: { fontSize: FontSize.xs, color: Colors.textSecondary },
  roleBadge: { backgroundColor: Colors.primary + '15', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, alignSelf: 'flex-start', marginTop: 3 },
  roleText: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  statusBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  auditRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, padding: 14 },
  auditIconWrap: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  auditInfo: { flex: 1, minWidth: 0 },
  auditAction: { fontSize: FontSize.sm, fontWeight: '800', textTransform: 'capitalize' },
  auditDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },
  auditMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4, flexWrap: 'wrap' },
  auditMeta: { fontSize: 10, color: Colors.textMuted },
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
