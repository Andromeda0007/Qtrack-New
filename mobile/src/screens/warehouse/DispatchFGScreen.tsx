import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { finishedGoodsApi, FGBatchListItem } from '../../api/finishedGoods';
import { Input } from '../../components/common/Input';
import { DatePickerInput } from '../../components/common/DatePickerInput';
import { Button } from '../../components/common/Button';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../../utils/theme';
import { extractError } from '../../api/client';
import { parseDMYToISO, formatDate, formatQuantity } from '../../utils/formatters';
import { resetToDashboardHome } from '../../navigation/goHome';
import { OperationResultModal } from '../../components/common/OperationResultModal';

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value || '—'}</Text>
  </View>
);
const Divider = () => <View style={styles.divider} />;

export const DispatchFGScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const batch: FGBatchListItem = route.params?.batch;

  const [customerName, setCustomerName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [numShippers, setNumShippers] = useState('');
  const [dispatchDate, setDispatchDate] = useState('');
  const [remarks, setRemarks] = useState('');
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

  const onSubmit = async () => {
    if (!customerName.trim()) { Alert.alert('Validation', 'Customer name is required.'); return; }
    const qty = parseFloat(quantity.replace(/,/g, ''));
    if (Number.isNaN(qty) || qty <= 0) { Alert.alert('Validation', 'Enter a valid dispatch quantity.'); return; }
    if (qty > Number(batch.quantity)) {
      Alert.alert('Validation', `Quantity cannot exceed available stock (${formatQuantity(batch.quantity)}).`);
      return;
    }

    let dateISO: string | undefined;
    if (dispatchDate.trim()) {
      const parsed = parseDMYToISO(dispatchDate.trim());
      if (!parsed) { Alert.alert('Validation', 'Enter dispatch date as DD-MM-YYYY.'); return; }
      dateISO = parsed;
    }

    let cartonCount: number | undefined;
    if (numShippers.trim()) {
      const parsed = parseInt(numShippers.trim(), 10);
      if (isNaN(parsed) || parsed <= 0) { Alert.alert('Validation', 'No. of Shippers must be a positive number.'); return; }
      cartonCount = parsed;
    }

    setSubmitting(true);
    try {
      const res = await finishedGoodsApi.dispatchFG({
        fg_batch_id: batch.id,
        customer_name: customerName.trim(),
        quantity: qty,
        invoice_number: invoiceNumber.trim() || undefined,
        dispatch_date: dateISO,
        remarks: remarks.trim() || undefined,
        carton_count: cartonCount,
      });
      setFlowDone({
        title: 'Dispatch Recorded',
        message: [
          `Product: ${batch.product_name}`,
          `Batch: ${batch.batch_number}`,
          `Customer: ${res.customer ?? customerName.trim()}`,
          `Qty dispatched: ${formatQuantity(qty)} ${batch.unit_of_measure ?? 'KG'}`,
          invoiceNumber.trim() ? `Invoice: ${invoiceNumber.trim()}` : null,
        ].filter(Boolean).join('\n'),
      });
    } catch (e) {
      Alert.alert('Failed', extractError(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dispatch FG</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Batch summary */}
          <Text style={styles.sectionTitle}>FG Batch</Text>
          <View style={styles.card}>
            {batch.fgtn_no ? (
              <>
                <Row label="FGTN No." value={batch.fgtn_no} />
                <Divider />
              </>
            ) : null}
            <Row label="Product" value={batch.product_name} />
            <Divider />
            <Row label="Batch No." value={batch.batch_number} />
            <Divider />
            <Row label="Available Qty" value={`${formatQuantity(batch.quantity)} ${batch.unit_of_measure ?? 'KG'}`} />
            <Divider />
            <Row label="Expiry" value={formatDate(batch.expiry_date)} />
          </View>

          {/* Dispatch details */}
          <Text style={[styles.sectionTitle, { marginTop: Spacing.md }]}>Dispatch Details</Text>
          <Input
            label="Customer Name *"
            placeholder="Name of the customer / consignee"
            value={customerName}
            onChangeText={setCustomerName}
          />
          <Input
            label="Quantity to Dispatch *"
            placeholder={`Max: ${formatQuantity(batch.quantity)} ${batch.unit_of_measure ?? 'KG'}`}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
          />
          <Input
            label="Invoice Number"
            placeholder="Invoice / delivery note number (optional)"
            value={invoiceNumber}
            onChangeText={setInvoiceNumber}
          />
          <Input
            label="No. of Shippers"
            placeholder="Number of shipper cartons (optional)"
            value={numShippers}
            onChangeText={setNumShippers}
            keyboardType="number-pad"
          />
          <DatePickerInput
            label="Dispatch Date (optional)"
            value={dispatchDate}
            onChange={setDispatchDate}
          />
          <Input
            label="Remarks"
            placeholder="Additional notes (optional)"
            value={remarks}
            onChangeText={setRemarks}
            multiline
          />

          <Button
            title="Confirm Dispatch"
            onPress={onSubmit}
            loading={submitting}
            fullWidth
            style={{ marginTop: Spacing.lg }}
          />
        </ScrollView>
      </KeyboardAvoidingView>

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
  sectionTitle: {
    fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary,
    marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, ...Shadow.sm, marginBottom: 4,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9 },
  rowLabel: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '500', flex: 1 },
  rowValue: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '600', flex: 1.5, textAlign: 'right' },
  divider: { height: 1, backgroundColor: Colors.borderLight },
});
