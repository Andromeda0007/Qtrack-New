import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { formatDate } from '../../utils/formatters';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../../utils/theme';
import type { WorkflowMode } from '../workflow/WorkflowHubScreen';

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value || '—'}</Text>
  </View>
);
const Divider = () => <View style={styles.divider} />;

export const FGBatchDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { fgBatchId, fgBatchNumber, mode, batch } = route.params as {
    fgBatchId: number;
    fgBatchNumber?: string;
    mode?: WorkflowMode;
    batch?: any;
  };
  const { user } = useAuthStore();
  const role = user?.role ?? '';

  const b = batch ?? {};

  const actions: { label: string; color: string; icon: string; onPress: () => void }[] = [];

  if (role === 'QA_EXECUTIVE' && mode === 'qa_inspect') {
    actions.push({
      label: 'Inspect',
      color: Colors.accent,
      icon: 'clipboard-outline',
      onPress: () => navigation.navigate('InspectFG', { fgBatchId, fgBatchNumber }),
    });
  }

  if (role === 'QA_HEAD' && mode === 'qa_decision') {
    actions.push(
      {
        label: 'Approve FG',
        color: Colors.success,
        icon: 'checkmark-circle-outline',
        onPress: () => navigation.navigate('ApproveFG', { fgBatchId, fgBatchNumber }),
      },
      {
        label: 'Reject FG',
        color: Colors.danger,
        icon: 'close-circle-outline',
        onPress: () => navigation.navigate('RejectFG', { fgBatchId, fgBatchNumber }),
      },
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>FG Batch</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.statusBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.batchNum}>{fgBatchNumber ?? `FG #${fgBatchId}`}</Text>
            <Text style={styles.productName}>{b.product_name ?? '—'}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: Colors.accent + '22' }]}>
            <Text style={[styles.statusText, { color: Colors.accent }]}>{b.status ?? 'QA_PENDING'}</Text>
          </View>
        </View>

        {actions.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Actions</Text>
            <View style={styles.actionsRow}>
              {actions.map(a => (
                <TouchableOpacity
                  key={a.label}
                  style={[styles.actionBtn, { borderColor: a.color }]}
                  onPress={a.onPress}
                  activeOpacity={0.8}
                >
                  <Ionicons name={a.icon as any} size={20} color={a.color} />
                  <Text style={[styles.actionLabel, { color: a.color }]}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Batch Info</Text>
        <View style={styles.card}>
          <Row label="Batch Number" value={fgBatchNumber ?? String(fgBatchId)} />
          <Divider />
          <Row label="Product Name" value={b.product_name ?? '—'} />
          <Divider />
          <Row label="Quantity" value={b.quantity ? `${b.quantity} units` : '—'} />
          <Divider />
          <Row label="Carton Count" value={b.carton_count != null ? String(b.carton_count) : '—'} />
          <Divider />
          <Row label="Net Weight" value={b.net_weight ? `${b.net_weight} kg` : '—'} />
        </View>

        <Text style={styles.sectionTitle}>Dates</Text>
        <View style={styles.card}>
          <Row label="Manufacture Date" value={formatDate(b.manufacture_date)} />
          <Divider />
          <Row label="Expiry Date" value={formatDate(b.expiry_date)} />
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 12, backgroundColor: Colors.primary,
  },
  backBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '800', color: '#fff' },
  scroll: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: 32 },

  statusBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: 4, ...Shadow.sm,
  },
  batchNum: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  productName: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  statusPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: FontSize.xs, fontWeight: '700' },

  sectionTitle: {
    fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary,
    marginBottom: 8, marginTop: 16, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  actionsRow: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: BorderRadius.lg,
    borderWidth: 2, backgroundColor: Colors.surface, ...Shadow.sm,
  },
  actionLabel: { fontSize: FontSize.sm, fontWeight: '700' },

  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, ...Shadow.sm, marginBottom: 4,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9 },
  rowLabel: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '500', flex: 1 },
  rowValue: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '600', flex: 1.5, textAlign: 'right' },
  divider: { height: 1, backgroundColor: Colors.borderLight },
});
