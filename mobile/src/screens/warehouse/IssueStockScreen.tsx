import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { inventoryApi } from '../../api/inventory';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Colors, FontSize, Spacing, BorderRadius } from '../../utils/theme';
import { extractError } from '../../api/client';
import { resetToDashboardHome } from '../../navigation/goHome';
import { OperationResultModal } from '../../components/common/OperationResultModal';

export const IssueStockScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { batchId, batchNumber, initialRack } = route.params || {};

  const [rack, setRack] = useState(
    typeof initialRack === 'string' ? initialRack : '',
  );
  const [qty, setQty] = useState('');
  const [productName, setProductName] = useState('');
  const [mfgBatchRef, setMfgBatchRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingBatch, setLoadingBatch] = useState(true);
  const [flowDone, setFlowDone] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!batchId) {
        setLoadingBatch(false);
        return;
      }
      try {
        const b = await inventoryApi.getBatchById(batchId);
        if (cancelled) return;
        const r = b?.rack_number != null && String(b.rack_number).trim() !== ''
          ? String(b.rack_number).trim()
          : '';
        setRack((prev) => (prev.trim() ? prev : r));
      } catch {
        /* keep initialRack / empty */
      } finally {
        if (!cancelled) setLoadingBatch(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [batchId]);

  const onSubmit = async () => {
    const rackTrim = rack.trim();
    if (!rackTrim) {
      Alert.alert('Rack required', 'Enter the rack / storage location before issuing to production.');
      return;
    }
    const q = parseFloat(qty.replace(/,/g, ''));
    if (Number.isNaN(q) || q <= 0) {
      Alert.alert('Validation', 'Enter a valid issue quantity.');
      return;
    }
    if (!productName.trim() || !mfgBatchRef.trim()) {
      Alert.alert('Validation', 'Manufacturing product name and batch reference are required.');
      return;
    }
    setSubmitting(true);
    try {
      await inventoryApi.updateBatchRack(batchId, rackTrim);
      const res = await inventoryApi.issueStock(batchId, q, remarks.trim() || undefined, {
        issued_to_product_name: productName.trim(),
        issued_to_batch_ref: mfgBatchRef.trim(),
      });
      setFlowDone({
        title: 'Issued to production',
        message: `Quantity issued. Remaining balance: ${res.remaining ?? '—'}. Status: ${res.status ?? '—'}. You can continue from Home.`,
      });
    } catch (e) {
      Alert.alert('Issue failed', extractError(e));
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
        <Text style={styles.headerTitle}>Issue to production</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sub}>Batch {batchNumber ?? batchId}</Text>
          <Text style={styles.rackNote}>
            Rack / storage location is required before stock can be issued (same value is saved on the batch).
          </Text>

          {loadingBatch ? (
            <Text style={styles.loadingHint}>Loading batch…</Text>
          ) : null}

          <Input
            label="Rack / storage location *"
            placeholder="Enter rack / bin location"
            value={rack}
            onChangeText={setRack}
            autoCapitalize="characters"
          />

          <Input
            label="Quantity to issue *"
            placeholder="e.g. 100"
            value={qty}
            onChangeText={setQty}
            keyboardType="decimal-pad"
          />
          <Input
            label="Manufacturing product name *"
            placeholder="Product being manufactured"
            value={productName}
            onChangeText={setProductName}
          />
          <Input
            label="Manufacturing / FG batch reference *"
            placeholder="e.g. FG batch no. or WO no."
            value={mfgBatchRef}
            onChangeText={setMfgBatchRef}
          />
          <Input
            label="Remarks (optional)"
            placeholder="Additional notes"
            value={remarks}
            onChangeText={setRemarks}
            multiline
          />

          <Button
            title="Confirm issue"
            onPress={onSubmit}
            loading={submitting}
            disabled={loadingBatch}
            fullWidth
            style={{ marginTop: Spacing.md }}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
  },
  backBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '800', color: '#fff' },
  scroll: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: 40 },
  sub: { fontSize: FontSize.sm, color: Colors.textMuted, marginBottom: Spacing.xs },
  rackNote: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  loadingHint: { fontSize: FontSize.sm, color: Colors.textMuted, marginBottom: Spacing.sm },
});
