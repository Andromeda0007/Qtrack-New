import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { inventoryApi } from '../../api/inventory';
import { Input } from '../../components/common/Input';
import { DatePickerInput } from '../../components/common/DatePickerInput';
import { Button } from '../../components/common/Button';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../../utils/theme';
import { extractError } from '../../api/client';
import { formatDate, formatQuantity, parseDMYToISO } from '../../utils/formatters';
import { resetToDashboardHome } from '../../navigation/goHome';
import { OperationResultModal } from '../../components/common/OperationResultModal';

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value || '—'}</Text>
  </View>
);
const Divider = () => <View style={styles.divider} />;

export const RetestToQuarantineScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { batchId, batch } = route.params ?? {};

  const materialName = batch?.material?.name ?? batch?.material_name ?? '—';
  const materialCode = batch?.material?.code ?? batch?.material_code ?? '—';
  const supplierName = batch?.supplier?.name ?? batch?.supplier_name ?? '—';
  const remainingQty = batch?.remaining_quantity ?? batch?.total_quantity ?? 0;
  const uom = batch?.unit_of_measure ?? 'KG';

  const [grnNumber, setGrnNumber] = useState('');
  const [batchNumber, setBatchNumber] = useState(batch?.batch_number ?? '');
  const [quantity, setQuantity] = useState(String(remainingQty));
  const [manufacturer, setManufacturer] = useState(batch?.manufacturer_name ?? '');
  const [manufactureDate, setManufactureDate] = useState(formatDate(batch?.manufacture_date) === '—' ? '' : formatDate(batch?.manufacture_date));
  const [expiryDate, setExpiryDate] = useState(formatDate(batch?.expiry_date) === '—' ? '' : formatDate(batch?.expiry_date));
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [remarks, setRemarks] = useState(`Retest transfer from batch ${batch?.batch_number ?? ''}`);
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
    if (!grnNumber.trim()) { Alert.alert('Validation', 'GRN Number is required.'); return; }
    if (!batchNumber.trim()) { Alert.alert('Validation', 'Batch Number is required.'); return; }

    const qty = parseFloat(quantity.replace(/,/g, ''));
    if (Number.isNaN(qty) || qty <= 0) { Alert.alert('Validation', 'Enter a valid quantity.'); return; }
    if (qty > Number(remainingQty)) {
      Alert.alert('Validation', `Quantity cannot exceed remaining stock (${formatQuantity(remainingQty)} ${uom}).`);
      return;
    }

    let mfgDateISO: string | undefined;
    if (manufactureDate.trim()) {
      const parsed = parseDMYToISO(manufactureDate.trim());
      if (!parsed) { Alert.alert('Validation', 'Enter manufacture date as DD-MM-YYYY.'); return; }
      mfgDateISO = parsed;
    }

    let expDateISO: string | undefined;
    if (expiryDate.trim()) {
      const parsed = parseDMYToISO(expiryDate.trim());
      if (!parsed) { Alert.alert('Validation', 'Enter expiry date as DD-MM-YYYY.'); return; }
      expDateISO = parsed;
    }

    setSubmitting(true);
    try {
      const res = await inventoryApi.retestToQuarantine(batchId, {
        grn_number: grnNumber.trim(),
        batch_number: batchNumber.trim(),
        quantity: qty,
        manufacturer_name: manufacturer.trim() || undefined,
        manufacture_date: mfgDateISO,
        expiry_date: expDateISO,
        invoice_number: invoiceNumber.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });
      setFlowDone({
        title: 'Retest GRN Created',
        message: [
          `New GRN: ${res.new_grn_number}`,
          `Material: ${materialName}`,
          `Quantity: ${formatQuantity(qty)} ${uom}`,
          `New batch is in Quarantine for QC processing.`,
        ].join('\n'),
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
        <Text style={styles.headerTitle}>Transfer to Quarantine</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Original batch summary */}
          <Text style={styles.sectionTitle}>Original Batch</Text>
          <View style={styles.card}>
            <Row label="Material" value={materialName} />
            <Divider />
            <Row label="Material Code" value={materialCode} />
            <Divider />
            <Row label="Supplier" value={supplierName} />
            <Divider />
            <Row label="Remaining Qty" value={`${formatQuantity(remainingQty)} ${uom}`} />
            {(batch?.retest_cycle ?? 0) > 0 && (
              <>
                <Divider />
                <Row label="Retest Cycle" value={String(batch.retest_cycle)} />
              </>
            )}
          </View>

          {/* New GRN details */}
          <Text style={[styles.sectionTitle, { marginTop: Spacing.md }]}>New GRN Details</Text>
          <Input
            label="GRN Number *"
            placeholder="Enter a unique GRN number"
            value={grnNumber}
            onChangeText={setGrnNumber}
            autoCapitalize="characters"
          />
          <Input
            label="Vendor Batch Number *"
            placeholder="Batch / lot number for new GRN"
            value={batchNumber}
            onChangeText={setBatchNumber}
          />
          <Input
            label={`Quantity * (max: ${formatQuantity(remainingQty)} ${uom})`}
            placeholder={`Up to ${formatQuantity(remainingQty)} ${uom}`}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
          />
          <Input
            label="Manufacturer"
            placeholder="Manufacturer name"
            value={manufacturer}
            onChangeText={setManufacturer}
          />
          <DatePickerInput
            label="Manufacture Date"
            value={manufactureDate}
            onChange={setManufactureDate}
          />
          <DatePickerInput
            label="Expiry Date"
            value={expiryDate}
            onChange={setExpiryDate}
          />
          <Input
            label="Invoice Number"
            placeholder="Invoice / challan number (optional)"
            value={invoiceNumber}
            onChangeText={setInvoiceNumber}
          />
          <Input
            label="Remarks"
            placeholder="Additional notes"
            value={remarks}
            onChangeText={setRemarks}
            multiline
          />

          <Button
            title="Create Retest GRN"
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
