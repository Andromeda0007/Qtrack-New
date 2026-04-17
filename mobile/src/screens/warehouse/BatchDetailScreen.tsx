import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Image, Modal, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { inventoryApi } from '../../api/inventory';
import { useAuthStore } from '../../store/authStore';
import { BASE_URL } from '../../api/client';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../../utils/theme';
import { formatDate } from '../../utils/formatters';

const toImageUrl = (path: string | null | undefined): string => {
  if (!path) return '';
  const clean = path.replace(/\\/g, '/');
  const base = BASE_URL.replace('/api/v1', '');
  return `${base}/${clean}`;
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  QUARANTINE:           { label: 'Quarantine',           bg: '#FFF3CD', text: '#856404', icon: 'hourglass-outline' },
  UNDER_TEST:           { label: 'Under Test',           bg: '#CCE5FF', text: '#004085', icon: 'flask-outline' },
  APPROVED:             { label: 'Approved',             bg: '#D4EDDA', text: '#155724', icon: 'checkmark-circle-outline' },
  REJECTED:             { label: 'Rejected',             bg: '#F8D7DA', text: '#721c24', icon: 'close-circle-outline' },
  QUARANTINE_RETEST:    { label: 'Quarantine (Retest)',  bg: '#FFF3CD', text: '#856404', icon: 'refresh-outline' },
  ISSUED_TO_PRODUCTION: { label: 'Issued to Production', bg: '#D1ECF1', text: '#0c5460', icon: 'arrow-forward-circle-outline' },
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: '#e9ecef', text: '#495057', icon: 'ellipse-outline' };
  return (
    <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
      <Ionicons name={cfg.icon as any} size={14} color={cfg.text} />
      <Text style={[styles.statusBadgeText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value || '—'}</Text>
  </View>
);

const Divider = () => <View style={styles.divider} />;

const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
  <Text style={styles.sectionTitle}>{title}</Text>
);

export const BatchDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { batchId } = route.params;
  const { user } = useAuthStore();

  const [batch, setBatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rackModal, setRackModal] = useState(false);
  const [rackInput, setRackInput] = useState('');

  const role = user?.role || '';
  const canSetRack =
    (batch?.status === 'APPROVED' || batch?.status === 'ISSUED_TO_PRODUCTION') &&
    (role === 'WAREHOUSE_USER' || role === 'WAREHOUSE_HEAD');

  const batchActions: { label: string; color: string; icon: string; onPress: () => void }[] = (() => {
    if (!batch) return [];
    const acts: { label: string; color: string; icon: string; onPress: () => void }[] = [];
    const batchNum = batch.batch_number;
    if (role === 'WAREHOUSE_USER' && batch.status === 'APPROVED') {
      acts.push({
        label: 'Issue to Production',
        color: Colors.success,
        icon: 'arrow-forward-circle-outline',
        onPress: () => navigation.navigate('IssueStock', { batchId, batchNumber: batchNum, initialRack: batch.rack_number }),
      });
    }
    if (role === 'QC_EXECUTIVE' && (batch.status === 'QUARANTINE' || batch.status === 'QUARANTINE_RETEST')) {
      acts.push({
        label: 'Add AR Number',
        color: Colors.info,
        icon: 'flask-outline',
        onPress: () => navigation.navigate('AddARNumber', { batchId, batchNumber: batchNum }),
      });
    }
    if (role === 'QC_HEAD' && batch.status === 'UNDER_TEST') {
      acts.push(
        {
          label: 'Approve',
          color: Colors.success,
          icon: 'checkmark-circle-outline',
          onPress: () => navigation.navigate('ApproveBatch', { batchId, batchNumber: batchNum }),
        },
        {
          label: 'Reject',
          color: Colors.danger,
          icon: 'close-circle-outline',
          onPress: () => navigation.navigate('RejectBatch', { batchId, batchNumber: batchNum }),
        },
      );
    }
    if (role === 'PRODUCTION_USER' && batch.status === 'APPROVED') {
      acts.push({
        label: 'Issue to Production',
        color: Colors.info,
        icon: 'arrow-forward-circle-outline',
        onPress: () => navigation.navigate('IssueStock', { batchId, batchNumber: batchNum, initialRack: batch.rack_number }),
      });
    }
    return acts;
  })();

  useFocusEffect(
    useCallback(() => {
      inventoryApi.getBatchById(batchId)
        .then(data => { setBatch(data); setLoading(false); })
        .catch(() => { setError('Failed to load batch details.'); setLoading(false); });
    }, [batchId])
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>GRN</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

          {/* Status banner */}
          <View style={styles.statusBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.batchNumberLarge}>{batch.batch_number}</Text>
              <Text style={styles.materialName}>{batch.material?.name ?? '—'}</Text>
            </View>
            <StatusBadge status={batch.status} />
          </View>

          {/* Actions */}
          {batchActions.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Actions</Text>
              <View style={styles.actionsRow}>
                {batchActions.map(a => (
                  <TouchableOpacity
                    key={a.label}
                    style={[styles.actionBtn, { borderColor: a.color }]}
                    onPress={a.onPress}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={a.icon as any} size={20} color={a.color} />
                    <Text style={[styles.actionBtnLabel, { color: a.color }]}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Print labels — only in QUARANTINE, only once */}
          {(role === 'WAREHOUSE_USER' || role === 'WAREHOUSE_HEAD') &&
           batch.container_count &&
           batch.status === 'QUARANTINE' &&
           !batch.labels_printed ? (
            <TouchableOpacity
              style={styles.printRow}
              onPress={() => navigation.navigate('PrintLabels', {
                batchId: batch.id,
                grnNumber: batch.grn_number,
                containerCount: batch.container_count,
              })}
              activeOpacity={0.85}
            >
              <Ionicons name="print-outline" size={18} color={Colors.primary} />
              <Text style={styles.printRowText}>Print container labels</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
            </TouchableOpacity>
          ) : null}

          {/* QR Code */}
          {batch.qr_code_path ? (
            <View style={styles.qrSection}>
              <Text style={styles.qrLabel}>QR Code</Text>
              <View style={styles.qrBox}>
                <Image
                  source={{ uri: toImageUrl(batch.qr_code_path) }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.qrHint}>Scan to track this item</Text>
            </View>
          ) : null}

          {/* Quantities */}
          <SectionTitle title="Quantity" />
          <View style={styles.card}>
            <View style={styles.qtyRow}>
              <View style={styles.qtyBox}>
                <Text style={styles.qtyNumSm}>{batch.total_quantity}</Text>
                <Text style={styles.qtyLbl}>Received</Text>
              </View>
              <View style={styles.qtyDivider} />
              <View style={styles.qtyBox}>
                <Text style={[styles.qtyNumSm, { color: Colors.info }]}>
                  {(() => {
                    const remRaw = batch.remaining_quantity;
                    if (remRaw == null || remRaw === '') return '—';
                    const t = parseFloat(String(batch.total_quantity ?? 0)) || 0;
                    const r = parseFloat(String(remRaw)) || 0;
                    return String(Math.max(0, t - r));
                  })()}
                </Text>
                <Text style={styles.qtyLbl}>Dispensed</Text>
              </View>
              <View style={styles.qtyDivider} />
              <View style={styles.qtyBox}>
                <Text style={[styles.qtyNumSm, { color: Colors.success }]}>
                  {batch.remaining_quantity != null && batch.remaining_quantity !== ''
                    ? batch.remaining_quantity
                    : '—'}
                </Text>
                <Text style={styles.qtyLbl}>Balance</Text>
              </View>
            </View>
          </View>

          {/* Storage */}
          <SectionTitle title="Storage" />
          <View style={styles.card}>
            <Row label="Rack no." value={batch.rack_number ? String(batch.rack_number) : '—'} />
            {canSetRack ? (
              <>
                <Divider />
                <TouchableOpacity
                  style={styles.rackBtn}
                  onPress={() => {
                    setRackInput(batch.rack_number ? String(batch.rack_number) : '');
                    setRackModal(true);
                  }}
                >
                  <Text style={styles.rackBtnText}>Update rack number</Text>
                  <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
                </TouchableOpacity>
              </>
            ) : null}
          </View>

          {/* Item Info */}
          <SectionTitle title="Item Info" />
          <View style={styles.card}>
            <Row label="GRN" value={batch.grn_number ?? '—'} />
            <Divider />
            <Row label="Item Code" value={batch.material?.code ?? '—'} />
            <Divider />
            <Row label="Item Name" value={batch.material?.name ?? '—'} />
            <Divider />
            <Row label="Batch / Lot No." value={batch.batch_number ?? '—'} />
            <Divider />
            <Row label="Pack Type" value={String(batch.pack_type ?? '—')} />
            <Divider />
            <Row label="Unit" value={String(batch.unit_of_measure ?? 'KG')} />
            <Divider />
            <Row
              label="Containers"
              value={
                batch.container_count != null && batch.container_quantity != null
                  ? `${batch.container_count} × ${batch.container_quantity}`
                  : '—'
              }
            />
          </View>

          {/* Supplier & Manufacturer */}
          <SectionTitle title="Supplier & Manufacturer" />
          <View style={styles.card}>
            <Row label="Supplier" value={batch.supplier?.name ?? '—'} />
            <Divider />
            <Row label="Manufacturer" value={String(batch.manufacturer_name ?? '—')} />
          </View>

          {/* Dates */}
          <SectionTitle title="Dates" />
          <View style={styles.card}>
            <Row label="Date of Receipt" value={formatDate(batch.date_of_receipt)} />
            <Divider />
            <Row label="Mfg. Date" value={formatDate(batch.manufacture_date)} />
            <Divider />
            <Row label="Exp. Date" value={formatDate(batch.expiry_date)} />
            {batch.retest_date ? (
              <>
                <Divider />
                <Row label="Retest Date" value={formatDate(batch.retest_date)} />
              </>
            ) : null}
          </View>

          {/* QC Info (if tested) */}
          {batch.ar_number ? (
            <>
              <SectionTitle title="QC Info" />
              <View style={styles.card}>
                <Row label="AR Number" value={batch.ar_number} />
                {batch.retest_cycle > 0 && (
                  <>
                    <Divider />
                    <Row label="Retest Cycle" value={String(batch.retest_cycle)} />
                  </>
                )}
              </View>
            </>
          ) : null}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      <Modal visible={rackModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rack number</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter rack / bin location"
              placeholderTextColor={Colors.textMuted}
              value={rackInput}
              onChangeText={setRackInput}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setRackModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSave}
                onPress={async () => {
                  try {
                    await inventoryApi.updateBatchRack(batchId, rackInput.trim() || '');
                    const b = await inventoryApi.getBatchById(batchId);
                    setBatch(b);
                    setRackModal(false);
                    Alert.alert('Saved', 'Rack number updated.');
                  } catch (e: any) {
                    Alert.alert('Error', e?.response?.data?.detail || 'Could not update rack.');
                  }
                }}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  content: { padding: Spacing.md, paddingBottom: 32 },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, gap: 12 },
  loadingText: { color: Colors.textMuted, fontSize: FontSize.sm },
  errorText: { color: Colors.danger, fontSize: FontSize.sm, textAlign: 'center' },

  statusBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: 4, ...Shadow.sm,
  },
  batchNumberLarge: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  materialName: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },

  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  statusBadgeText: { fontSize: FontSize.xs, fontWeight: '700' },

  qrSection: { alignItems: 'center', marginVertical: 16 },
  qrLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary, marginBottom: 10 },
  qrBox: {
    padding: 12, backgroundColor: '#fff', borderRadius: BorderRadius.md,
    ...Shadow.sm, borderWidth: 1, borderColor: Colors.borderLight,
  },
  qrImage: { width: 160, height: 160 },
  qrHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 8 },

  sectionTitle: {
    fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary,
    marginBottom: 8, marginTop: 16, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, ...Shadow.sm, marginBottom: 4,
  },

  qtyRow: { flexDirection: 'row', alignItems: 'center' },
  qtyBox: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  qtyNum: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  qtyNumSm: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  qtyLbl: { fontSize: 10, color: Colors.textMuted, marginTop: 2, textAlign: 'center' },
  qtyDivider: { width: 1, height: 40, backgroundColor: Colors.borderLight },

  rackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  rackBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  modalTitle: { fontSize: FontSize.md, fontWeight: '800', marginBottom: Spacing.sm },
  modalInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: 12,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: Spacing.md },
  modalCancel: { paddingVertical: 10, paddingHorizontal: 12 },
  modalCancelText: { color: Colors.textMuted, fontWeight: '600' },
  modalSave: { backgroundColor: Colors.primary, paddingVertical: 10, paddingHorizontal: 20, borderRadius: BorderRadius.md },
  modalSaveText: { color: '#fff', fontWeight: '700' },

  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 9,
  },
  rowLabel: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '500', flex: 1 },
  rowValue: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '600', flex: 1.5, textAlign: 'right' },
  divider: { height: 1, backgroundColor: Colors.borderLight },

  printRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginTop: 12, marginBottom: 4,
    borderWidth: 2, borderColor: Colors.primary + '33', ...Shadow.sm,
  },
  printRowText: { flex: 1, marginLeft: 10, color: Colors.primary, fontWeight: '700', fontSize: FontSize.sm },

  actionsRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: BorderRadius.lg,
    borderWidth: 2, backgroundColor: Colors.surface, ...Shadow.sm,
  },
  actionBtnLabel: { fontSize: FontSize.sm, fontWeight: '700' },
});
