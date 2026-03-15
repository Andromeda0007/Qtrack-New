import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { chatApi } from '../../api/chat';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../../utils/theme';
import { formatRole } from '../../utils/formatters';

type ContactProfile = {
  id: number;
  name: string;
  username: string;
  email: string;
  phone: string;
  role_name: string;
};

const Row: React.FC<{ icon: string; label: string; value: string }> = ({ icon, label, value }) => (
  <View style={styles.row}>
    <View style={styles.rowIconWrap}>
      <Ionicons name={icon as any} size={20} color={Colors.primary} />
    </View>
    <View style={styles.rowContent}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || '—'}</Text>
    </View>
  </View>
);

export const ChatContactDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { userId, displayName } = route.params;

  const [profile, setProfile] = useState<ContactProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    chatApi.getContactProfile(userId)
      .then(setProfile)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Contact</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Contact</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Could not load contact</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact info</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(profile.name || '?')[0].toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.username}>@{profile.username}</Text>
        </View>

        <View style={styles.card}>
          <Row icon="person-outline" label="Name" value={profile.name} />
          <View style={styles.divider} />
          <Row icon="at-outline" label="Username" value={profile.username} />
          <View style={styles.divider} />
          <Row icon="mail-outline" label="Email" value={profile.email} />
          <View style={styles.divider} />
          <Row icon="call-outline" label="Phone" value={profile.phone} />
          <View style={styles.divider} />
          <Row icon="briefcase-outline" label="Role" value={formatRole(profile.role_name)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f0f2f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '800', color: '#fff' },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: FontSize.sm, color: Colors.textMuted },

  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md, paddingBottom: 40 },

  avatarWrap: { alignItems: 'center', paddingVertical: Spacing.lg },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 36, fontWeight: '700', color: '#fff' },
  name: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary, marginTop: 12 },
  username: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },

  card: {
    backgroundColor: '#fff',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadow.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  rowIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary + '14',
    justifyContent: 'center', alignItems: 'center',
    marginRight: Spacing.md,
  },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 2, fontWeight: '600' },
  rowValue: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#eee', marginLeft: 52 },
});
