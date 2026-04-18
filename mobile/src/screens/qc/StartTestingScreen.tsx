import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { qcApi } from '../../api/qc';
import { extractError } from '../../api/client';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../../utils/theme';
import { resetToDashboardHome } from '../../navigation/goHome';
import { OperationResultModal } from '../../components/common/OperationResultModal';

export const StartTestingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { batchId, batchNumber, arNumber, unitOfMeasure } = route.params as {
    batchId: number;
    batchNumber?: string;
    arNumber: string;
    unitOfMeasure: string;
  };

  const isCount = unitOfMeasure === 'COUNT';

  const [sampleQty, setSampleQty] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [flowDone, setFlowDone] = useState<{ title: string; message: string } | null>(null);

  const handleQtyChange = (v: string) => {
    if (isCount) {
      setSampleQty(v.replace(/[^\d]/g, ''));
    } else {
      if (/^\d*(?:[.,]\d{0,3})?$/.test(v)) setSampleQty(v);
    }
  };

  const submit = async () => {
    const raw = sampleQty.trim().replace(',', '.');
    if (!raw) {
      Alert.alert('Required', 'Enter the sample quantity.');
      return;
    }
    const n = parseFloat(raw);
    if (Number.isNaN(n) || n <= 0) {
      Alert.alert('Invalid', 'Sample quantity must be a positive number.');
      return;
    }
    if (isCount && !Number.isInteger(n)) {
      Alert.alert('Invalid', 'Sample quantity must be a whole number for COUNT items.');
      return;
    }
    setSubmitting(true);
    try {
      await qcApi.startTesting(batchId, n);
      setFlowDone({
        title: 'Under Test',
        message: `Sample of ${n} ${isCount ? '' : 'kg'} recorded for AR ${arNumber}. The batch is now Under Test.`,
      });
    } catch (e) {
      Alert.alert('Error', extractError(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Start Testing</Text>
        <View style={{ width: 44 }} />
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.batchHint}>Batch {batchNumber ?? `#${batchId}`}</Text>

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>AR Number</Text>
            <Text style={styles.infoValue}>{arNumber}</Text>
          </View>

          <Text style={styles.help}>
            Record the sample quantity withdrawn for testing. Once submitted, the batch moves to{' '}
            <Text style={{ fontWeight: '700' }}>Under Test</Text>.
          </Text>

          <View style={styles.card}>
            <Input
              label={`Sample Quantity * (${isCount ? 'count' : 'kg'})`}
              value={sampleQty}
              onChangeText={handleQtyChange}
              placeholder={isCount ? 'e.g. 5' : 'e.g. 0.500'}
              keyboardType={isCount ? 'number-pad' : 'decimal-pad'}
            />
          </View>

          <Button
            title={submitting ? 'Submitting...' : 'Submit & Start Testing'}
            onPress={submit}
            disabled={submitting}
          />
          {submitting && <ActivityIndicator color={Colors.primary} style={{ marginTop: 12 }} />}
        </ScrollView>
      </KeyboardAvoidingView>
      <OperationResultModal
        visible={!!flowDone}
        variant="success"
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
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.sm, paddingVertical: 12,
    backgroundColor: Colors.primary,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: FontSize.lg, fontWeight: '800', color: '#fff', textAlign: 'center' },
  scroll: { padding: Spacing.md, paddingBottom: 40 },
  batchHint: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary, marginBottom: 12 },
  infoCard: {
    backgroundColor: Colors.primary + '12',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '500' },
  infoValue: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '800' },
  help: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },
  card: {
    backgroundColor: '#fff', borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.sm,
  },
});
