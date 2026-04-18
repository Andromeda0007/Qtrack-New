import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { inventoryApi } from '../../api/inventory';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../../utils/theme';

export const PrintLabelsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { batchId, grnNumber, containerCount } = route.params as {
    batchId: number;
    grnNumber?: string;
    containerCount?: number;
  };

  const [uri, setUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const u = await inventoryApi.downloadContainerLabelsPdf(batchId);
        setUri(u);
      } catch (e: any) {
        setError(e?.message || 'Failed to download labels PDF.');
      } finally {
        setLoading(false);
      }
    })();
  }, [batchId]);

  const handleSave = async () => {
    if (!uri || busy) return;
    setBusy(true);
    try {
      const dest = `${FileSystem.documentDirectory}container-labels-${batchId}.pdf`;
      await FileSystem.copyAsync({ from: uri, to: dest });
      await inventoryApi.markLabelsPrinted(batchId);
      Alert.alert('Saved', 'PDF saved to your Files app.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Unable to save PDF.');
    } finally {
      setBusy(false);
    }
  };

  const handlePrint = async () => {
    if (!uri || busy) return;
    setBusy(true);
    try {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      await inventoryApi.markLabelsPrinted(batchId);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Unable to open share sheet.');
    } finally {
      setBusy(false);
    }
  };


  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Container Labels</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.body}>
        <View style={styles.card}>
          <Ionicons name="document-text-outline" size={40} color={Colors.primary} />
          <Text style={styles.cardTitle}>{grnNumber ?? `Batch #${batchId}`}</Text>
          {containerCount != null && (
            <Text style={styles.cardSub}>{containerCount} label{containerCount !== 1 ? 's' : ''} — one per container</Text>
          )}
          {loading && (
            <View style={styles.statusRow}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.statusText}>Preparing labels…</Text>
            </View>
          )}
          {error && <Text style={styles.errText}>{error}</Text>}
          {uri && !error && (
            <Text style={styles.readyText}>Ready to print.</Text>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryBtn, (!uri || busy) && styles.btnDisabled]}
            onPress={handlePrint}
            disabled={!uri || busy}
            activeOpacity={0.8}
          >
            <Ionicons name="print-outline" size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>Print</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryBtn, (!uri || busy) && styles.btnDisabled]}
            onPress={handleSave}
            disabled={!uri || busy}
            activeOpacity={0.8}
          >
            <Ionicons name="download-outline" size={20} color={Colors.primary} />
            <Text style={styles.secondaryBtnText}>Save to Files</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          Tap Print → share sheet opens → tap{' '}
          <Text style={{ fontWeight: '700' }}>Print</Text> in the menu → full printer settings (printer, copies, pages).
        </Text>
      </View>
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
  body: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md, gap: Spacing.md },

  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, alignItems: 'center', gap: 8, ...Shadow.sm,
  },
  cardTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary, marginTop: 8 },
  cardSub: { fontSize: FontSize.sm, color: Colors.textMuted },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  statusText: { color: Colors.textSecondary, fontSize: FontSize.sm },
  errText: { color: Colors.danger, fontSize: FontSize.sm, marginTop: 10, textAlign: 'center' },
  readyText: { color: Colors.success, fontSize: FontSize.sm, marginTop: 10, fontWeight: '700' },

  actions: { gap: Spacing.sm },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: BorderRadius.lg, ...Shadow.sm,
  },
  primaryBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: Colors.surface, paddingVertical: 14, borderRadius: BorderRadius.lg,
    borderWidth: 2, borderColor: Colors.primary, ...Shadow.sm,
  },
  secondaryBtnText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },

  hint: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: 8 },
});
