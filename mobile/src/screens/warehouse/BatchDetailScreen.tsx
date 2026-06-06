import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Image, Platform,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { inventoryApi } from '../../api/inventory';
import { useAuthStore } from '../../store/authStore';
import { BASE_URL } from '../../api/client';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../../utils/theme';
import { formatDateByFormat } from '../../utils/formatters';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { OperationResultModal } from '../../components/common/OperationResultModal';

const HISTORY_CONFIG: Record<string, { label: string; byLabel: string; atLabel: string; dot: string }> = {
  QUARANTINE:           { label: 'Quarantine',           byLabel: 'Created by',  atLabel: 'Created at',  dot: '#ffc107' },
  UNDER_TEST:           { label: 'Under Test',           byLabel: 'Updated by',  atLabel: 'Updated at',  dot: '#007bff' },
  APPROVED:             { label: 'Approved',             byLabel: 'Approved by', atLabel: 'Approved at', dot: '#28a745' },
  REJECTED:             { label: 'Rejected',             byLabel: 'Rejected by', atLabel: 'Rejected at', dot: '#dc3545' },
  QUARANTINE_RETEST:    { label: 'Quarantine',           byLabel: 'Created by',  atLabel: 'Created at',  dot: '#ffc107' },
  ISSUED_TO_PRODUCTION: { label: 'Issued to Production', byLabel: 'Issued by',   atLabel: 'Issued at',   dot: '#1e3a5f' },
  RETEST_DUE:           { label: 'Retest Due',           byLabel: 'Scheduled by', atLabel: 'Due on',     dot: '#e67e22' },
};

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
  ISSUED_TO_PRODUCTION: { label: 'Issued to Production', bg: '#e8eef5', text: '#1e3a5f', icon: 'arrow-forward-circle-outline' },
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
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [labelLoading, setLabelLoading] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [showTransferTip, setShowTransferTip] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueLoading, setIssueLoading] = useState(false);
  const [errorModal, setErrorModal] = useState<{ title: string; message: string } | null>(null);

  const role = user?.role || '';

  const showError = (title: string, message: string) => setErrorModal({ title, message });

  const isRetest = (() => {
    if (!batch || batch.status !== 'APPROVED' || !batch.retest_date) return false;
    const days = Math.ceil((new Date(batch.retest_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days <= 15;
  })();

  const canTransferToQuarantine =
    isRetest && (role === 'WAREHOUSE_USER' || role === 'WAREHOUSE_HEAD');

  const canIssueToProduction =
    batch?.status === 'APPROVED' &&
    !batch?.issued_to_production &&
    !isRetest &&
    (role === 'WAREHOUSE_USER' || role === 'WAREHOUSE_HEAD');

  const handleTransferToQuarantine = () => setShowTransferModal(true);

  const confirmIssueToProduction = async () => {
    setShowIssueModal(false);
    setIssueLoading(true);
    try {
      await inventoryApi.issueToProduction(batchId);
      const [data, hist] = await Promise.all([
        inventoryApi.getBatchById(batchId),
        inventoryApi.getBatchHistory(batchId).catch(() => []),
      ]);
      setBatch(data);
      setHistory(hist);
    } catch (e: any) {
      showError('Error', e?.response?.data?.detail || 'Could not issue batch to production.');
    } finally {
      setIssueLoading(false);
    }
  };

  const confirmTransfer = async () => {
    setShowTransferModal(false);
    setTransferLoading(true);
    try {
      const prefill = await inventoryApi.getRetestPrefill(batchId);
      navigation.navigate('CreateCard', { prefill, originalBatchId: batchId });
    } catch (e: any) {
      showError('Error', e?.response?.data?.detail || 'Could not load batch details.');
    } finally {
      setTransferLoading(false);
    }
  };

  const batchActions: { label: string; color: string; icon: string; onPress: () => void }[] = (() => {
    if (!batch) return [];
    const acts: { label: string; color: string; icon: string; onPress: () => void }[] = [];
    const batchNum = batch.batch_number;
    if (role === 'QC_EXECUTIVE' && (batch.status === 'QUARANTINE' || batch.status === 'QUARANTINE_RETEST')) {
      if (!batch.ar_number) {
        acts.push({
          label: 'Add AR Number',
          color: Colors.info,
          icon: 'flask-outline',
          onPress: () => navigation.navigate('AddARNumber', { batchId, batchNumber: batchNum }),
        });
      } else {
        acts.push({
          label: 'Start Testing',
          color: Colors.primary,
          icon: 'play-circle-outline',
          onPress: () => navigation.navigate('StartTesting', {
            batchId,
            batchNumber: batchNum,
            arNumber: batch.ar_number,
            unitOfMeasure: batch.unit_of_measure ?? 'KG',
          }),
        });
      }
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
    return acts;
  })();

  const handleViewPdf = async () => {
    setPdfLoading(true);
    try {
      const uri = await inventoryApi.downloadContainerLabelsPdf(batch.id);
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        showError('Unavailable', 'PDF viewer is not available on this device.');
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', ...(Platform.OS === 'ios' && { UTI: 'com.adobe.pdf' }) });
    } catch (e: any) {
      showError('Error', e?.message || 'Could not open PDF.');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadLabel = async () => {
    setLabelLoading(true);
    try {
      const uri = await inventoryApi.downloadQuarantineLabelPdf(batch.id, 2);
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        showError('Unavailable', 'PDF viewer is not available on this device.');
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', ...(Platform.OS === 'ios' && { UTI: 'com.adobe.pdf' }) });
    } catch (e: any) {
      showError('Error', e?.message || 'Could not download label.');
    } finally {
      setLabelLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        inventoryApi.getBatchById(batchId),
        inventoryApi.getBatchHistory(batchId).catch(() => []),
      ]).then(([data, hist]) => {
        setBatch(data);
        setHistory(hist);
        setLoading(false);
      }).catch(() => {
        setError('Failed to load batch details.');
        setLoading(false);
      });
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

          {/* Transfer to Quarantine — shown for WH User/Head when batch is due for retest */}
          {canTransferToQuarantine && (
            <View>
              {showTransferTip && (
                <View style={styles.transferTip}>
                  <Text style={styles.transferTipText}>
                    Moves this batch to Quarantine and starts a new QC cycle
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.transferBtn}
                onPress={handleTransferToQuarantine}
                onLongPress={() => {
                  setShowTransferTip(true);
                  setTimeout(() => setShowTransferTip(false), 2500);
                }}
                disabled={transferLoading}
                activeOpacity={0.65}
              >
                {transferLoading ? (
                  <ActivityIndicator size="small" color="#856404" />
                ) : (
                  <Ionicons name="swap-horizontal-outline" size={18} color="#856404" />
                )}
                <Text style={styles.transferBtnText}>Transfer to Quarantine</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Issue to Production — shown for WH User/Head on APPROVED batches not yet issued */}
          {canIssueToProduction && (
            <TouchableOpacity
              style={styles.issueBtn}
              onPress={() => setShowIssueModal(true)}
              disabled={issueLoading}
              activeOpacity={0.75}
            >
              {issueLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="arrow-forward-circle-outline" size={18} color="#fff" />
              )}
              <Text style={styles.issueBtnText}>Issue to Production</Text>
            </TouchableOpacity>
          )}

          {/* QR Code */}
          {(batch.qr_base64 || batch.qr_code_path) ? (
            <View style={styles.qrSection}>
              <Text style={styles.qrLabel}>QR Code</Text>
              <View style={styles.qrBox}>
                <Image
                  source={{
                    uri: batch.qr_base64
                      ? `data:image/png;base64,${batch.qr_base64}`
                      : toImageUrl(batch.qr_code_path),
                  }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.qrHint}>Scan to track this item</Text>
            </View>
          ) : null}

          {/* Download quarantine label */}
          <TouchableOpacity
            style={styles.printRow}
            onPress={handleDownloadLabel}
            disabled={labelLoading}
            activeOpacity={0.85}
          >
            {labelLoading
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : <Ionicons name="document-text-outline" size={18} color={Colors.primary} />
            }
            <Text style={styles.printRowText}>Download Quarantine Label</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
          </TouchableOpacity>

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
            <Row label="Date of Receipt" value={formatDateByFormat(batch.date_of_receipt, batch.date_format)} />
            <Divider />
            <Row label="Mfg. Date" value={formatDateByFormat(batch.manufacture_date, batch.date_format)} />
            <Divider />
            <Row label="Exp. Date" value={formatDateByFormat(batch.expiry_date, batch.date_format)} />
            {batch.retest_date ? (
              <>
                <Divider />
                <Row label="Retest Date" value={formatDateByFormat(batch.retest_date, batch.date_format)} />
              </>
            ) : null}
          </View>

          {/* Purchase Order */}
          <SectionTitle title="Purchase Order" />
          <View style={styles.card}>
            <Row label="PO Number" value={batch.po_number} />
            <Divider />
            <Row label="PO Date" value={formatDateByFormat(batch.po_date, batch.date_format)} />
          </View>

          {/* Invoice */}
          <SectionTitle title="Invoice" />
          <View style={styles.card}>
            <Row label="Invoice Number" value={batch.invoice_number} />
            <Divider />
            <Row label="Invoice Date" value={formatDateByFormat(batch.invoice_date, batch.date_format)} />
          </View>

          {/* Remarks */}
          <SectionTitle title="Remarks" />
          <View style={styles.card}>
            <Text style={styles.remarksText}>{batch.remarks || 'Nil'}</Text>
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

          {/* Retest Info — only visible when this GRN was created as a retest */}
          {batch.retesting_number ? (
            <>
              <SectionTitle title="Retest Info" />
              <View style={styles.card}>
                <Row label="Retesting No." value={batch.retesting_number} />
                {batch.original_batch_number ? (
                  <>
                    <Divider />
                    <Row label="Original Batch No." value={batch.original_batch_number} />
                  </>
                ) : null}
                {batch.original_grn_number ? (
                  <>
                    <Divider />
                    <Row label="Original GRN" value={batch.original_grn_number} />
                  </>
                ) : null}
              </View>
            </>
          ) : null}

          {/* History — vertical timeline */}
          {history.length > 0 && (
            <>
              <SectionTitle title="History" />
              <View style={styles.timeline}>
                {(() => {
                  const displayHistory = [...history];
                  if (batch?.retest_date) {
                    const days = Math.ceil(
                      (new Date(batch.retest_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    );
                    if (days <= 15) {
                      displayHistory.push({
                        new_status: 'RETEST_DUE',
                        changed_by_name: 'System',
                        changed_at: batch.retest_date + 'T12:00:00',
                      });
                    }
                  }
                  return displayHistory;
                })().map((h, idx, all) => {
                  const cfg = HISTORY_CONFIG[h.new_status] ?? {
                    label: h.new_status.replace(/_/g, ' '),
                    byLabel: 'By', atLabel: 'At', dot: '#999',
                  };
                  const isLast = idx === all.length - 1;
                  return (
                    <View key={idx} style={styles.timelineRow}>
                      {/* Left: dot + connector */}
                      <View style={styles.timelineLeft}>
                        <View style={[styles.timelineDot, { backgroundColor: cfg.dot }]} />
                        {!isLast && <View style={[styles.timelineLine, { backgroundColor: cfg.dot + '40' }]} />}
                      </View>
                      {/* Right: content */}
                      <View style={[styles.timelineCard, isLast && { marginBottom: 0 }]}>
                        <View style={[styles.timelineBadge, { backgroundColor: cfg.dot + '20' }]}>
                          <Text style={[styles.timelineBadgeText, { color: cfg.dot }]}>{cfg.label}</Text>
                        </View>
                        <View style={styles.timelineDetail}>
                          <Text style={styles.timelineLabel}>{cfg.byLabel}</Text>
                          <Text style={styles.timelineValue}>{h.changed_by_name ?? '—'}</Text>
                        </View>
                        <View style={styles.timelineDetail}>
                          <Text style={styles.timelineLabel}>{cfg.atLabel}</Text>
                          <Text style={styles.timelineValue}>
                            {new Date(h.changed_at).toLocaleString('en-IN', {
                              day: '2-digit', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit', hour12: true,
                            })}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {/* Labels */}
          <SectionTitle title="Labels" />
          <View style={styles.card}>
            <Row label="Labels Printed" value={batch.labels_printed ? 'Yes' : 'No'} />
            {batch.labels_printed ? (
              <>
                <Divider />
                <TouchableOpacity
                  style={styles.viewPdfBtn}
                  onPress={handleViewPdf}
                  disabled={pdfLoading}
                  activeOpacity={0.8}
                >
                  {pdfLoading ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Ionicons name="document-text-outline" size={18} color={Colors.primary} />
                  )}
                  <Text style={styles.viewPdfText}>
                    {pdfLoading ? 'Opening…' : 'View Labels PDF'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      <ConfirmModal
        visible={showTransferModal}
        variant="warning"
        title="Transfer to Quarantine"
        message="This batch is due for retest. Transferring it to Quarantine will start a fresh QC cycle."
        confirmLabel="Transfer"
        onConfirm={confirmTransfer}
        onCancel={() => setShowTransferModal(false)}
      />

      <ConfirmModal
        visible={showIssueModal}
        variant="info"
        title="Issue to Production"
        message="Mark this batch as issued to production? This action cannot be undone."
        confirmLabel="Issue"
        onConfirm={confirmIssueToProduction}
        onCancel={() => setShowIssueModal(false)}
      />

      <OperationResultModal
        visible={!!errorModal}
        variant="danger"
        title={errorModal?.title ?? ''}
        message={errorModal?.message ?? ''}
        onDismiss={() => setErrorModal(null)}
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

  viewPdfBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10,
  },
  viewPdfText: { color: Colors.primary, fontWeight: '700', fontSize: FontSize.sm },

  timeline: { paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start' },
  timelineLeft: { alignItems: 'center', width: 20, marginRight: 12 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 10 },
  timelineLine: { width: 2, flex: 1, minHeight: 28, marginTop: 4 },
  timelineCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.sm, marginBottom: Spacing.sm, ...Shadow.sm,
  },
  timelineBadge: {
    alignSelf: 'flex-start', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 3, marginBottom: 8,
  },
  timelineBadgeText: { fontSize: FontSize.xs, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  timelineDetail: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  timelineLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600' },
  timelineValue: { fontSize: FontSize.xs, color: Colors.textPrimary, fontWeight: '500', flexShrink: 1, textAlign: 'right' },

  transferBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#FFF3CD', borderRadius: BorderRadius.lg,
    paddingVertical: 14, marginTop: 12, marginBottom: 4,
    shadowColor: '#856404', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6,
  },
  transferBtnText: { color: '#856404', fontWeight: '800', fontSize: FontSize.sm },
  transferTip: {
    backgroundColor: 'rgba(30,30,30,0.88)', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 6,
    alignSelf: 'center',
  },
  transferTipText: { color: '#fff', fontSize: FontSize.xs, textAlign: 'center' },

  issueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.primary, borderRadius: BorderRadius.lg,
    paddingVertical: 14, marginTop: 12, marginBottom: 4,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  issueBtnText: { color: '#fff', fontWeight: '800', fontSize: FontSize.sm },

  remarksText: {
    fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 22,
  },

  actionsRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: BorderRadius.lg,
    borderWidth: 2, backgroundColor: Colors.surface, ...Shadow.sm,
  },
  actionBtnLabel: { fontSize: FontSize.sm, fontWeight: '700' },
});
