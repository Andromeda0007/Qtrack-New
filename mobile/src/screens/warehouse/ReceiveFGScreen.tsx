import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { finishedGoodsApi, FGBatchListItem } from '../../api/finishedGoods';
import { Button } from '../../components/common/Button';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../../utils/theme';
import { extractError } from '../../api/client';
import { formatDate, formatQuantity } from '../../utils/formatters';
import { resetToDashboardHome } from '../../navigation/goHome';
import { OperationResultModal } from '../../components/common/OperationResultModal';

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value || '—'}</Text>
  </View>
);
const Divider = () => <View style={styles.divider} />;

export const ReceiveFGScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const batch: FGBatchListItem = route.params?.batch;

  const [submitting, setSubmitting] = useState(false);
  const [flowDone, setFlowDone] = useState<{ title: string; message: string } | null>(null);

  if (!batch) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <Text style={{ color: Colors.danger }}>Batch data missing.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const onConfirm = async () => {
    Alert.alert(
      'Confirm Receipt',
      `Receive ${formatQuantity(batch.quantity)} units of "${batch.product_name}" into warehouse?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Receive',
          onPress: async () => {
            setSubmitting(true);
            try {
              await finishedGoodsApi.receiveFG(batch.id);
              setFlowDone({
                title: 'FG Received',
                message: [
                  batch.fgtn_no ? `FGTN: ${batch.fgtn_no}` : null,
                  `Product: ${batch.product_name}`,
                  `Batch: ${batch.batch_number}`,
                  `Qty: ${formatQuantity(batch.quantity)} units`,
                  '',
                  'Received into warehouse inventory.',
                ].filter(Boolean).join('\n'),
              });
            } catch (e) {
              Alert.alert('Failed', extractError(e));
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Receive FG</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.statusBanner}>
          <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
          <Text style={styles.bannerText}>QA Approved — ready for warehouse receipt</Text>
        </View>

        <Text style={styles.sectionTitle}>Batch Details</Text>
        <View style={styles.card}>
          {batch.fgtn_no ? (
            <>
              <Row label="FGTN No." value={batch.fgtn_no} />
              <Divider />
            </>
          ) : null}
          <Row label="Product Name" value={batch.product_name} />
          <Divider />
          <Row label="Batch No." value={batch.batch_number} />
          <Divider />
          <Row label="Expiry Date" value={formatDate(batch.expiry_date)} />
          {batch.pack_size ? (
            <>
              <Divider />
              <Row label="Pack Size" value={batch.pack_size} />
            </>
          ) : null}
          <Divider />
          <Row label="Quantity" value={`${formatQuantity(batch.quantity)} units`} />
        </View>

        <Button
          title="Confirm Receipt into Warehouse"
          onPress={onConfirm}
          loading={submitting}
          fullWidth
          style={{ marginTop: Spacing.lg }}
        />
      </ScrollView>

      <OperationResultModal
        visible={!!flowDone}
        title={flowDone?.title ?? ''}
        message={flowDone?.message ?? ''}
        onDismiss={() => { setFlowDone(null); resetToDashboardHome(navigation); }}
      />
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  scroll: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: 40 },

  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.success + '15', borderRadius: BorderRadius.md,
    padding: 12, marginBottom: Spacing.md,
  },
  bannerText: { fontSize: FontSize.sm, color: Colors.success, fontWeight: '700', flex: 1 },

  sectionTitle: {
    fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary,
    marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, ...Shadow.sm,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9 },
  rowLabel: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '500', flex: 1 },
  rowValue: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '600', flex: 1.5, textAlign: 'right' },
  divider: { height: 1, backgroundColor: Colors.borderLight },
});
