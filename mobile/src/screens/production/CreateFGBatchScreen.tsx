import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { productionApi } from '../../api/production';
import { Input } from '../../components/common/Input';
import { DatePickerInput } from '../../components/common/DatePickerInput';
import { Button } from '../../components/common/Button';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../../utils/theme';
import { extractError } from '../../api/client';
import { parseDMYToISO, formatDate, formatQuantity } from '../../utils/formatters';
import { resetToDashboardHome } from '../../navigation/goHome';
import { OperationResultModal } from '../../components/common/OperationResultModal';

type UOM = 'KG' | 'COUNT' | 'L';

const UOM_OPTIONS: { value: UOM; label: string }[] = [
  { value: 'KG', label: 'KG' },
  { value: 'COUNT', label: 'COUNT' },
  { value: 'L', label: 'L' },
];

export const CreateFGBatchScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const [fgtnNo, setFgtnNo] = useState('');
  const [productName, setProductName] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [packSize, setPackSize] = useState('');
  const [unit, setUnit] = useState<UOM>('KG');
  const [quantity, setQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [flowDone, setFlowDone] = useState<{ title: string; message: string } | null>(null);

  const unitLabel = unit === 'KG' ? 'kg' : unit === 'L' ? 'L' : 'count';

  const onSubmit = async () => {
    if (!productName.trim()) { Alert.alert('Validation', 'Product name is required.'); return; }
    if (!batchNumber.trim()) { Alert.alert('Validation', 'Batch number is required.'); return; }
    const expISO = parseDMYToISO(expiryDate);
    if (!expiryDate || !expISO) { Alert.alert('Validation', 'Please select an expiry date.'); return; }
    const qty = parseFloat(quantity.replace(/,/g, ''));
    if (Number.isNaN(qty) || qty <= 0) { Alert.alert('Validation', 'Enter a valid quantity.'); return; }

    setSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await productionApi.createFGBatch({
        fgtn_no: fgtnNo.trim() || undefined,
        product_name: productName.trim(),
        batch_number: batchNumber.trim(),
        manufacture_date: today,
        expiry_date: expISO,
        pack_size: packSize.trim() || undefined,
        unit_of_measure: unit,
        quantity: qty,
      });
      setFlowDone({
        title: 'FG Batch created',
        message: [
          fgtnNo.trim() ? `FGTN: ${fgtnNo.trim()}` : null,
          `Product: ${productName.trim()}`,
          `Batch: ${res.batch_number ?? batchNumber.trim()}`,
          packSize.trim() ? `Pack Size: ${packSize.trim()}` : null,
          `Qty: ${formatQuantity(qty)} ${unitLabel}`,
          `Expiry: ${formatDate(expISO)}`,
          '',
          'Sent to QA for inspection.',
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
        <Text style={styles.headerTitle}>Create FG Batch</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Input
            label="FGTN No."
            placeholder="Finished Goods Transfer Note number"
            value={fgtnNo}
            onChangeText={setFgtnNo}
          />
          <Input
            label="Product Name *"
            placeholder="Name of the finished product"
            value={productName}
            onChangeText={setProductName}
          />
          <Input
            label="Batch No. *"
            placeholder="e.g. FG-2025-001"
            value={batchNumber}
            onChangeText={setBatchNumber}
          />
          <DatePickerInput
            label="Expiry Date *"
            value={expiryDate}
            onChange={setExpiryDate}
            minimumDate={new Date()}
          />
          <Input
            label="Pack Size"
            placeholder="e.g. 100 units/carton or 500g/pack"
            value={packSize}
            onChangeText={setPackSize}
          />

          {/* Unit selector */}
          <Text style={styles.fieldLabel}>Unit *</Text>
          <View style={styles.unitRow}>
            {UOM_OPTIONS.map((o) => (
              <TouchableOpacity
                key={o.value}
                style={[styles.unitChip, unit === o.value && styles.unitChipActive]}
                onPress={() => { setUnit(o.value); setQuantity(''); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.unitText, unit === o.value && styles.unitTextActive]}>{o.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Input
            label={`Quantity (${unitLabel}) *`}
            placeholder={unit === 'COUNT' ? 'e.g. 500' : 'e.g. 250.000'}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType={unit === 'COUNT' ? 'number-pad' : 'decimal-pad'}
          />

          <Button
            title="Create FG Batch"
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
  scroll: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: 40 },

  fieldLabel: {
    fontSize: FontSize.sm, fontWeight: '600',
    color: Colors.textPrimary, marginBottom: 8, marginTop: 4,
  },
  unitRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  unitChip: {
    flex: 1, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: BorderRadius.md, paddingVertical: 12, alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  unitChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
  unitText: { fontSize: FontSize.md, fontWeight: '800', color: Colors.textSecondary },
  unitTextActive: { color: Colors.primary },
});
