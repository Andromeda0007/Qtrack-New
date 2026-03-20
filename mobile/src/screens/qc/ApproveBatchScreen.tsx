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

/** Expect YYYY-MM-DD for API */
function toIsoDate(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return null;
  return t;
}

export const ApproveBatchScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { batchId, batchNumber } = route.params as { batchId: number; batchNumber?: string };

  const [retestDate, setRetestDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const iso = toIsoDate(retestDate);
    if (!iso) {
      Alert.alert('Required', 'Enter next retest date as YYYY-MM-DD (required for approval).');
      return;
    }
    setSubmitting(true);
    try {
      await qcApi.approveMaterial(batchId, iso, remarks.trim() || undefined);
      Alert.alert('Success', 'Material approved.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
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
        <Text style={styles.headerTitle}>Approve material</Text>
        <View style={{ width: 44 }} />
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.batchHint}>Batch {batchNumber ?? `#${batchId}`}</Text>
          <Text style={styles.help}>
            Next retest date is mandatory. Use format <Text style={{ fontWeight: '700' }}>YYYY-MM-DD</Text>.
          </Text>
          <View style={styles.card}>
            <Input
              label="Next retest date *"
              value={retestDate}
              onChangeText={setRetestDate}
              placeholder="2026-12-31"
            />
            <Input
              label="Remarks (optional)"
              value={remarks}
              onChangeText={setRemarks}
              placeholder="QC approval notes"
              multiline
            />
          </View>
          <Button
            title={submitting ? 'Approving...' : 'Approve'}
            onPress={submit}
            disabled={submitting}
            variant="success"
          />
          {submitting && <ActivityIndicator color={Colors.success} style={{ marginTop: 12 }} />}
        </ScrollView>
      </KeyboardAvoidingView>
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
    backgroundColor: Colors.success,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: FontSize.lg, fontWeight: '800', color: '#fff', textAlign: 'center' },
  scroll: { padding: Spacing.md, paddingBottom: 40 },
  batchHint: { fontSize: FontSize.md, fontWeight: '700', color: Colors.success, marginBottom: 8 },
  help: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
});
