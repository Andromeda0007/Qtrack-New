import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, Alert, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usersApi } from '../../api/users';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Colors, FontSize, Spacing } from '../../utils/theme';
import { formatDateTime, formatRole } from '../../utils/formatters';
import { User, Role } from '../../types';
import { extractError } from '../../api/client';

type Tab = 'users' | 'audit';

export const AdminScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', username: '', email: '', role_id: 0 });
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [usersData, rolesData, auditData] = await Promise.all([
        usersApi.getUsers(),
        usersApi.getRoles(),
        usersApi.getAuditLogs({ limit: 50 }),
      ]);
      setUsers(usersData);
      setRoles(rolesData);
      setAuditLogs(auditData);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, []);

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
    if (!createForm.name || !createForm.username || !createForm.email || !createForm.role_id) {
      Alert.alert('Error', 'All fields are required'); return;
    }
    setCreating(true);
    try {
      await usersApi.createUser(createForm);
      setShowCreateUser(false);
      setCreateForm({ name: '', username: '', email: '', role_id: 0 });
      Alert.alert('Success', 'User created. Temporary password has been sent to their email.');
      loadData();
    } catch (error) {
      Alert.alert('Error', extractError(error));
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Admin Panel</Text>
        {activeTab === 'users' && (
          <TouchableOpacity onPress={() => setShowCreateUser(true)} style={styles.addBtn}>
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
          contentContainerStyle={styles.list}
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
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Card padding={12}>
              <View style={styles.auditRow}>
                <View style={styles.auditDot} />
                <View style={styles.auditInfo}>
                  <Text style={styles.auditAction}>{item.action_type.replace(/_/g, ' ')}</Text>
                  <Text style={styles.auditDesc} numberOfLines={2}>{item.description || '—'}</Text>
                  <Text style={styles.auditMeta}>by {item.username || '?'} · {formatDateTime(item.created_at)}</Text>
                </View>
              </View>
            </Card>
          )}
        />
      )}

      {/* Create User Modal */}
      <Modal visible={showCreateUser} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalSheet} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>Create New User</Text>
            <Input label="Full Name" placeholder="John Doe" value={createForm.name} onChangeText={(v) => setCreateForm((f) => ({ ...f, name: v }))} />
            <Input label="Username" placeholder="john.doe" value={createForm.username} onChangeText={(v) => setCreateForm((f) => ({ ...f, username: v }))} />
            <Input label="Email" placeholder="john@company.com" value={createForm.email} onChangeText={(v) => setCreateForm((f) => ({ ...f, email: v }))} keyboardType="email-address" />

            <Text style={styles.roleLabel}>Role</Text>
            <View style={styles.roleGrid}>
              {roles.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.roleChip, createForm.role_id === r.id && styles.roleChipActive]}
                  onPress={() => setCreateForm((f) => ({ ...f, role_id: r.id }))}
                >
                  <Text style={[styles.roleChipText, createForm.role_id === r.id && styles.roleChipTextActive]}>
                    {formatRole(r.role_name)}
                  </Text>
                </TouchableOpacity>
              ))}
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
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, backgroundColor: Colors.primary },
  title: { fontSize: FontSize.xl, fontWeight: '800', color: '#fff' },
  addBtn: { padding: 8 },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.primary },
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
  roleLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary, marginBottom: Spacing.xs },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.md },
  roleChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: '#fff' },
  roleChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  roleChipText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  roleChipTextActive: { color: '#fff' },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, marginBottom: Spacing.xl },
});
