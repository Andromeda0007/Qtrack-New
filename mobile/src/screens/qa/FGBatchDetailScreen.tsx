import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { productionApi } from '../../api/production';
import { formatDate } from '../../utils/formatters';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../../utils/theme';

const STATUS_META: Record<string, { label: string; color: string }> = {
  CREATED:     { label: 'Finished Good', color: '#856404' },
  QA_PENDING:  { label: 'Under Test',    color: Colors.info },
  QA_APPROVED: { label: 'Approved',      color: Colors.success },
  QA_REJECTED: { label: 'Rejected',      color: Colors.danger },
};

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
  const { fgBatchId, batch: initialBatch } = route.params as { fgBatchId: number; batch?: any };
  const { user } = useAuthStore();
  const role = user?.role ?? '';

  const [batch, setBatch] = useState<any>(initialBatch ?? null);
  const [loading, setLoading] = useState(!initialBatch);

  useEffect(() => {
    if (!initialBatch) {
      productionApi.getFGBatch(fgBatchId)
        .then(setBatch)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [fgBatchId]);

  const status: string = batch?.status ?? '';
  const statusMeta = STATUS_META[status] ?? { label: status, color: Colors.textMuted };
  const statusBg = statusMeta.color + '22';

  const handleStartTesting = () => {
    navigation.navigate('InspectFG', { fgBatchId, fgBatchNumber: batch?.batch_number });
  };

  const handleApprove = () => {
    navigation.navigate('ApproveFG', { fgBatchId, fgBatchNumber: batch?.batch_number });
  };

  const handleReject = () => {
    navigation.navigate('RejectFG', { fgBatchId, fgBatchNumber: batch?.batch_number });
  };

  const showQAExecutiveActions =
    role === 'QA_EXECUTIVE' && (status === 'CREATED' || status === 'QA_PENDING');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>FG Batch</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : !batch ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Batch not found.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {/* Status banner */}
          <View style={styles.statusBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.batchNum}>{batch.batch_number ?? `FG #${fgBatchId}`}</Text>
              <Text style={styles.productName}>{batch.product_name ?? '—'}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
              <Text style={[styles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
            </View>
          </View>

          {/* Role-based actions */}
          {showQAExecutiveActions && (
            <>
              <Text style={styles.sectionTitle}>Actions</Text>
              <View style={styles.actionsRow}>
                {status === 'CREATED' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: Colors.info }]}
                    onPress={handleStartTesting}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="flask-outline" size={20} color={Colors.info} />
                    <Text style={[styles.actionLabel, { color: Colors.info }]}>Start QA Testing</Text>
                  </TouchableOpacity>
                )}
                {status === 'QA_PENDING' && (
                  <>
                    <TouchableOpacity
                      style={[styles.actionBtn, { borderColor: Colors.success }]}
                      onPress={handleApprove}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="checkmark-circle-outline" size={20} color={Colors.success} />
                      <Text style={[styles.actionLabel, { color: Colors.success }]}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { borderColor: Colors.danger }]}
                      onPress={handleReject}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close-circle-outline" size={20} color={Colors.danger} />
                      <Text style={[styles.actionLabel, { color: Colors.danger }]}>Reject</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </>
          )}

          {/* Batch Info */}
          <Text style={styles.sectionTitle}>Batch Info</Text>
          <View style={styles.card}>
            <Row label="Batch Number"  value={batch.batch_number ?? String(fgBatchId)} />
            <Divider />
            <Row label="Product Name"  value={batch.product_name ?? '—'} />
            <Divider />
            <Row label="Quantity"      value={batch.quantity != null ? `${batch.quantity} units` : '—'} />
            <Divider />
            <Row label="Carton Count"  value={batch.carton_count != null ? String(batch.carton_count) : '—'} />
            <Divider />
            <Row label="Net Weight"    value={batch.net_weight   ? `${batch.net_weight} kg`   : '—'} />
            <Divider />
            <Row label="Gross Weight"  value={batch.gross_weight ? `${batch.gross_weight} kg` : '—'} />
          </View>

          {/* Dates */}
          <Text style={styles.sectionTitle}>Dates</Text>
          <View style={styles.card}>
            <Row label="Manufacture Date" value={formatDate(batch.manufacture_date)} />
            <Divider />
            <Row label="Expiry Date"       value={formatDate(batch.expiry_date)} />
          </View>

          {batch.remarks ? (
            <>
              <Text style={styles.sectionTitle}>Remarks</Text>
              <View style={styles.card}>
                <Text style={styles.remarks}>{batch.remarks}</Text>
              </View>
            </>
          ) : null}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: Colors.primary },
  header:       {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 12, backgroundColor: Colors.primary,
  },
  backBtn:      { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
  headerTitle:  { fontSize: FontSize.lg, fontWeight: '800', color: '#fff' },
  scroll:       { flex: 1, backgroundColor: Colors.background },
  content:      { padding: Spacing.md, paddingBottom: 32 },
  centered:     { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  errorText:    { fontSize: FontSize.md, color: Colors.textMuted },

  statusBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: 4, ...Shadow.sm,
  },
  batchNum:    { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  productName: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  statusPill:  { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  statusText:  { fontSize: FontSize.xs, fontWeight: '700' },

  sectionTitle: {
    fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary,
    marginBottom: 8, marginTop: 16, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  actionsRow:  { flexDirection: 'row', gap: 12 },
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
  row:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9 },
  rowLabel:  { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '500', flex: 1 },
  rowValue:  { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '600', flex: 1.5, textAlign: 'right' },
  divider:   { height: 1, backgroundColor: Colors.borderLight },
  remarks:   { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
});
