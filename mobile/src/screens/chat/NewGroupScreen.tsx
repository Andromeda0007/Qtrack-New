import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity,
  TextInput, ActivityIndicator, Pressable, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { chatApi } from '../../api/chat';
import { useAuthStore } from '../../store/authStore';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../../utils/theme';

type UserResult = { id: number; name: string; username: string; role: string | null };

const ROLE_LABELS: Record<string, string> = {
  WAREHOUSE_HEAD: 'Warehouse Head',
  WAREHOUSE_USER: 'Warehouse User',
  QC_EXECUTIVE: 'QC Executive',
  QC_HEAD: 'QC Head',
  QA_EXECUTIVE: 'QA Executive',
  QA_HEAD: 'QA Head',
  PRODUCTION_USER: 'Production User',
  PURCHASE_USER: 'Purchase User',
};

const ROLE_ORDER = [
  'WAREHOUSE_HEAD', 'WAREHOUSE_USER',
  'QC_HEAD', 'QC_EXECUTIVE',
  'QA_HEAD', 'QA_EXECUTIVE',
  'PRODUCTION_USER', 'PURCHASE_USER',
];

const STEP_1 = 1;
const STEP_2 = 2;

export const NewGroupScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const [step, setStep] = useState(STEP_1);
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [allUsers, setAllUsers] = useState<UserResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    chatApi.searchUsers('').then((list) => setAllUsers(list)).finally(() => setLoading(false));
  }, []);

  const toggleUser = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sections = useMemo(() => {
    const meId = user?.id;
    let filtered: UserResult[];
    if (query.trim()) {
      const q = query.toLowerCase();
      filtered = allUsers.filter(
        (u) =>
          u.id !== meId &&
          (u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q))
      );
    } else {
      filtered = allUsers.filter((u) => u.id !== meId);
    }

    const grouped: Record<string, UserResult[]> = {};
    for (const u of filtered) {
      const key = u.role ?? 'OTHER';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(u);
    }

    return ROLE_ORDER.filter((r) => grouped[r]?.length).map((r) => ({
      title: ROLE_LABELS[r] ?? r,
      data: grouped[r],
    }));
  }, [allUsers, query, user?.id]);

  const selectedUsers = useMemo(
    () => allUsers.filter((u) => selectedIds.has(u.id)),
    [allUsers, selectedIds]
  );

  const canNext = selectedIds.size > 0;
  const canCreate = groupName.trim().length > 0 && selectedIds.size > 0 && !creating;

  const goNext = () => {
    if (canNext) setStep(STEP_2);
  };

  const goBack = () => {
    if (step === STEP_2) setStep(STEP_1);
    else navigation.goBack();
  };

  const createGroup = async () => {
    if (!canCreate) return;
    setCreating(true);
    try {
      const { room_id } = await chatApi.createGroup(groupName.trim(), Array.from(selectedIds));
      navigation.replace('ChatRoom', { roomId: room_id, roomName: groupName.trim() });
    } catch {
      setCreating(false);
    }
  };

  // —— Step 1: Select members ——
  const renderStep1 = () => (
    <>
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={20} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts"
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(u) => u.id.toString()}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const isSelected = selectedIds.has(item.id);
            return (
              <Pressable
                style={({ pressed }) => [
                  styles.memberRow,
                  isSelected && styles.memberRowSelected,
                  pressed && styles.memberRowPressed,
                ]}
                onPress={() => toggleUser(item.id)}
              >
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>{(item.name || '?')[0].toUpperCase()}</Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{item.name}</Text>
                  <Text style={styles.memberHandle}>@{item.username}</Text>
                </View>
                <View style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}>
                  {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No contacts found</Text>
            </View>
          }
          stickySectionHeadersEnabled
          contentContainerStyle={styles.listContent}
        />
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryBtn, !canNext && styles.primaryBtnDisabled]}
          onPress={goNext}
          disabled={!canNext}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Next</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  // —— Step 2: Group name & description ——
  const renderStep2 = () => (
    <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.step2Scroll}
        contentContainerStyle={styles.step2Content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Selected members preview */}
        <View style={styles.selectedSection}>
          <View style={styles.selectedAvatars}>
            {selectedUsers.slice(0, 5).map((u, i) => (
              <View key={u.id} style={[styles.selectedAvatar, i === 0 && styles.selectedAvatarFirst]}>
                <Text style={styles.selectedAvatarText}>{u.name[0].toUpperCase()}</Text>
              </View>
            ))}
            {selectedUsers.length > 5 && (
              <View style={[styles.selectedAvatar, styles.selectedAvatarMore]}>
                <Text style={styles.selectedAvatarText}>+{selectedUsers.length - 5}</Text>
              </View>
            )}
          </View>
          <Text style={styles.selectedCount}>
            {selectedUsers.length} participant{selectedUsers.length !== 1 ? 's' : ''} selected
          </Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.inputRow}>
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={Colors.primary} />
            <TextInput
              style={styles.nameInput}
              placeholder="Group name"
              placeholderTextColor={Colors.textMuted}
              value={groupName}
              onChangeText={setGroupName}
              maxLength={50}
              autoFocus
            />
          </View>
          <View style={[styles.inputRow, styles.inputRowDesc]}>
            <Ionicons name="document-text-outline" size={22} color={Colors.textMuted} />
            <TextInput
              style={[styles.nameInput, styles.descInput]}
              placeholder="Description (optional)"
              placeholderTextColor={Colors.textMuted}
              value={description}
              onChangeText={setDescription}
              maxLength={200}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryBtn, !canCreate && styles.primaryBtnDisabled]}
          onPress={createGroup}
          disabled={!canCreate}
          activeOpacity={0.85}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Create group</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header — distinct from chat list */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {step === STEP_1 ? 'New group' : 'Group name'}
          </Text>
          <View style={styles.stepDots}>
            <View style={[styles.stepDot, step >= STEP_1 && styles.stepDotActive]} />
            <View style={[styles.stepDot, step >= STEP_2 && styles.stepDotActive]} />
          </View>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {step === STEP_1 ? renderStep1() : renderStep2()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f0f2f5' },
  keyboard: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 14,
    backgroundColor: Colors.primary,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '800', color: '#fff' },
  stepDots: {
    flexDirection: 'row', gap: 6, marginTop: 6,
  },
  stepDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  stepDotActive: { backgroundColor: '#fff' },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    ...Shadow.sm,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary },

  listContent: { paddingBottom: 88 },
  sectionHeader: {
    backgroundColor: '#f0f2f5',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  memberRowSelected: { backgroundColor: Colors.primary + '0c' },
  memberRowPressed: { backgroundColor: Colors.primary + '14' },
  memberAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  memberAvatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
  memberHandle: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  checkCircle: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  checkCircleSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  separator: { height: 1, backgroundColor: '#e8eaed', marginLeft: 80 },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: FontSize.sm, color: Colors.textMuted },

  footer: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    paddingBottom: Spacing.md + 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e8eaed',
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    ...Shadow.sm,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontSize: FontSize.md, fontWeight: '700', color: '#fff' },

  // Step 2
  step2Scroll: { flex: 1 },
  step2Content: { padding: Spacing.md, paddingBottom: 100 },

  selectedSection: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  selectedAvatars: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' },
  selectedAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
    marginLeft: 8,
  },
  selectedAvatarFirst: { marginLeft: 0 },
  selectedAvatarMore: {
    backgroundColor: Colors.textMuted,
  },
  selectedAvatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  selectedCount: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 10,
    fontWeight: '500',
  },

  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: Spacing.md,
    ...Shadow.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 4,
  },
  inputRowDesc: { alignItems: 'flex-start', marginTop: 8, borderTopWidth: 1, borderTopColor: '#eee' },
  nameInput: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textPrimary,
    paddingVertical: 6,
  },
  descInput: {
    fontWeight: '400',
    minHeight: 64,
    textAlignVertical: 'top',
  },
});
