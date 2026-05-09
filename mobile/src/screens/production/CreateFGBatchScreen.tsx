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
import { Colors, FontSize, Spacing, Shadow } from '../../utils/theme';
import { extractError } from '../../api/client';
import { parseDMYToISO, formatDate, formatQuantity } from '../../utils/formatters';
import { resetToDashboardHome } from '../../navigation/goHome';
import { OperationResultModal } from '../../components/common/OperationResultModal';

type UOM = 'COUNT';

export const CreateFGBatchScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const [fgtnNo, setFgtnNo] = useState('');
  const [productName, setProductName] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [manufactureDate, setManufactureDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [packSize, setPackSize] = useState('');
  const [numShippers, setNumShippers] = useState('');
  const [quantity, setQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [flowDone, setFlowDone] = useState<{ title: string; message: string } | null>(null);

  const unitLabel = 'count';

  const onSubmit = async () => {
    if (!productName.trim()) { Alert.alert('Validation', 'Product name is required.'); return; }
    if (!batchNumber.trim()) { Alert.alert('Validation', 'Batch number is required.'); return; }
    const expISO = parseDMYToISO(expiryDate);
    if (!expiryDate || !expISO) { Alert.alert('Validation', 'Please select an expiry date.'); return; }
    const qty = parseFloat(quantity.replace(/,/g, ''));
    if (Number.isNaN(qty) || qty <= 0) { Alert.alert('Validation', 'Enter a valid quantity.'); return; }

    const mfgISO = manufactureDate ? parseDMYToISO(manufactureDate) : new Date().toISOString().split('T')[0];
    if (!mfgISO) { Alert.alert('Validation', 'Enter a valid manufacture date.'); return; }

    const shippersRaw = numShippers.trim();
    let shippers: number | undefined;
    if (shippersRaw) {
      const parsed = parseInt(shippersRaw, 10);
      if (isNaN(parsed) || parsed <= 0) {
        Alert.alert('Validation', 'No. of Shippers must be a positive number.');
        return;
      }
      shippers = parsed;
    }

    setSubmitting(true);
    try {
      const res = await productionApi.createFGBatch({
        fgtn_no: fgtnNo.trim() || undefined,
        product_name: productName.trim(),
        batch_number: batchNumber.trim(),
        manufacture_date: mfgISO,
        expiry_date: expISO,
        pack_size: packSize.trim() || undefined,
        unit_of_measure: 'COUNT',
        quantity: qty,
        carton_count: shippers,
      });
      setFlowDone({
        title: 'FG Batch created',
        message: [
          fgtnNo.trim() ? `FGTN: ${fgtnNo.trim()}` : null,
          `Product: ${productName.trim()}`,
          `Batch: ${res.batch_number ?? batchNumber.trim()}`,
          packSize.trim() ? `Pack Size: ${packSize.trim()}` : null,
          numShippers.trim() ? `No. of Shippers: ${numShippers.trim()}` : null,
          `Qty: ${formatQuantity(qty)} count`,
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
            label="Manufacture Date (optional)"
            value={manufactureDate}
            onChange={setManufactureDate}
            maximumDate={new Date()}
          />
          <DatePickerInput
            label="Expiry Date *"
            value={expiryDate}
            onChange={setExpiryDate}
            minimumDate={new Date()}
          />
          <Input
            label="Pack Size"
            placeholder="e.g. 100 units/pack"
            value={packSize}
            onChangeText={setPackSize}
          />
          <Input
            label="No. of Shippers"
            placeholder="Number of shipping cartons"
            value={numShippers}
            onChangeText={setNumShippers}
            keyboardType="number-pad"
          />
          <Input
            label="Quantity (count) *"
            placeholder="e.g. 500"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="number-pad"
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

});
