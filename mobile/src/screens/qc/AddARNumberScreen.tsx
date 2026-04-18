import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { qcApi } from '../../api/qc';
import { extractError } from '../../api/client';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../../utils/theme';
import { OperationResultModal } from '../../components/common/OperationResultModal';

export const AddARNumberScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { batchId, batchNumber } = route.params as { batchId: number; batchNumber?: string };

  const [arNumber, setArNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [flowDone, setFlowDone] = useState<{ title: string; message: string } | null>(null);

  const submit = async () => {
    const ar = arNumber.trim();
    if (!ar) {
      Alert.alert('Required', 'Enter an AR number.');
      return;
    }
    setSubmitting(true);
    try {
      await qcApi.addARNumber(batchId, ar);
      setFlowDone({
        title: 'AR number assigned',
        message: 'AR number saved. The batch is still in Quarantine. Return to the batch and tap "Start Testing" to record the sample quantity.',
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
        <Text style={styles.headerTitle}>Add AR number</Text>
        <View style={{ width: 44 }} />
      </View>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.batchHint}>
            Batch {batchNumber ?? `#${batchId}`}
          </Text>
          <Text style={styles.help}>
            Assign an analytical record (AR) number. The batch stays in Quarantine — you will record
            the sample quantity separately when you are ready to{' '}
            <Text style={{ fontWeight: '700' }}>Start Testing</Text>.
          </Text>
          <View style={styles.card}>
            <Input
              label="AR number *"
              value={arNumber}
              onChangeText={setArNumber}
              placeholder="e.g. AR-2026-00142"
              autoCapitalize="characters"
            />
          </View>
          <Button
            title={submitting ? 'Saving...' : 'Assign AR number'}
            onPress={submit}
            disabled={submitting}
          />
          {submitting && <ActivityIndicator color={Colors.primary} style={{ marginTop: 12 }} />}
        </ScrollView>
      </KeyboardAvoidingView>
      <OperationResultModal
        visible={!!flowDone}
        variant="info"
        title={flowDone?.title ?? ''}
        message={flowDone?.message ?? ''}
        onDismiss={() => {
          setFlowDone(null);
          navigation.goBack();
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: FontSize.lg, fontWeight: '800', color: '#fff', textAlign: 'center' },
  scroll: { padding: Spacing.md, paddingBottom: 40 },
  batchHint: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary, marginBottom: 8 },
  help: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
});
