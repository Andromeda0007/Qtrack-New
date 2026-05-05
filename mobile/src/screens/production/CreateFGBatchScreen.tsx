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
import { Button } from '../../components/common/Button';
import { Colors, FontSize, Spacing, BorderRadius } from '../../utils/theme';
import { extractError } from '../../api/client';
import { parseDMYToISO } from '../../utils/formatters';
import { resetToDashboardHome } from '../../navigation/goHome';
import { OperationResultModal } from '../../components/common/OperationResultModal';

export const CreateFGBatchScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const [productName, setProductName] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [quantity, setQuantity] = useState('');
  const [cartonCount, setCartonCount] = useState('');
  const [netWeight, setNetWeight] = useState('');
  const [grossWeight, setGrossWeight] = useState('');
  const [mfgDate, setMfgDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [flowDone, setFlowDone] = useState<{ title: string; message: string } | null>(null);

  const onSubmit = async () => {
    if (!productName.trim()) {
      Alert.alert('Validation', 'Product name is required.');
      return;
    }
    if (!batchNumber.trim()) {
      Alert.alert('Validation', 'Batch number is required.');
      return;
    }
    const qty = parseFloat(quantity.replace(/,/g, ''));
    if (Number.isNaN(qty) || qty <= 0) {
      Alert.alert('Validation', 'Enter a valid quantity.');
      return;
    }
    const mfgISO = parseDMYToISO(mfgDate);
    if (!mfgISO) {
      Alert.alert('Validation', 'Enter manufacture date as DD-MM-YYYY.');
      return;
    }
    const expISO = parseDMYToISO(expiryDate);
    if (!expISO) {
      Alert.alert('Validation', 'Enter expiry date as DD-MM-YYYY.');
      return;
    }

    const payload: Parameters<typeof productionApi.createFGBatch>[0] = {
      product_name: productName.trim(),
      batch_number: batchNumber.trim(),
      quantity: qty,
      manufacture_date: mfgISO,
      expiry_date: expISO,
    };
    if (cartonCount.trim()) {
      const cc = parseInt(cartonCount, 10);
      if (!Number.isNaN(cc) && cc > 0) payload.carton_count = cc;
    }
    if (netWeight.trim()) {
      const nw = parseFloat(netWeight);
      if (!Number.isNaN(nw) && nw > 0) payload.net_weight = nw;
    }
    if (grossWeight.trim()) {
      const gw = parseFloat(grossWeight);
      if (!Number.isNaN(gw) && gw > 0) payload.gross_weight = gw;
    }
    if (remarks.trim()) payload.remarks = remarks.trim();

    setSubmitting(true);
    try {
      const res = await productionApi.createFGBatch(payload);
      setFlowDone({
        title: 'FG Batch created',
        message: `Batch: ${res.batch_number ?? batchNumber}\nProduct: ${productName}\nQty: ${qty} units`,
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
          <Text style={styles.sectionTitle}>Product Info</Text>
          <Input
            label="Product / FG Name *"
            placeholder="Name of the finished product"
            value={productName}
            onChangeText={setProductName}
          />
          <Input
            label="Batch / Lot Number *"
            placeholder="e.g. FG-2025-001"
            value={batchNumber}
            onChangeText={setBatchNumber}
          />
          <Input
            label="Quantity (units) *"
            placeholder="e.g. 500"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
          />
          <Input
            label="Carton Count"
            placeholder="Number of cartons (optional)"
            value={cartonCount}
            onChangeText={setCartonCount}
            keyboardType="number-pad"
          />

          <Text style={[styles.sectionTitle, { marginTop: Spacing.md }]}>Weight</Text>
          <Input
            label="Net Weight (kg)"
            placeholder="e.g. 250.5 (optional)"
            value={netWeight}
            onChangeText={setNetWeight}
            keyboardType="decimal-pad"
          />
          <Input
            label="Gross Weight (kg)"
            placeholder="e.g. 270 (optional)"
            value={grossWeight}
            onChangeText={setGrossWeight}
            keyboardType="decimal-pad"
          />

          <Text style={[styles.sectionTitle, { marginTop: Spacing.md }]}>Dates</Text>
          <Input
            label="Manufacture Date * (DD-MM-YYYY)"
            placeholder="e.g. 01-05-2025"
            value={mfgDate}
            onChangeText={setMfgDate}
            keyboardType="numeric"
          />
          <Input
            label="Expiry Date * (DD-MM-YYYY)"
            placeholder="e.g. 01-05-2027"
            value={expiryDate}
            onChangeText={setExpiryDate}
            keyboardType="numeric"
          />

          <Text style={[styles.sectionTitle, { marginTop: Spacing.md }]}>Remarks</Text>
          <Input
            label="Remarks (optional)"
            placeholder="Additional notes"
            value={remarks}
            onChangeText={setRemarks}
            multiline
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
        onDismiss={() => {
          setFlowDone(null);
          resetToDashboardHome(navigation);
        }}
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
  sectionTitle: {
    fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary,
    marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5,
  },
});
