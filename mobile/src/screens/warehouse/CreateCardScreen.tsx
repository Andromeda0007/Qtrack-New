import React, { useMemo, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Modal, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { inventoryApi } from '../../api/inventory';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { ItemPicker } from '../../components/common/ItemPicker';
import { OperationResultModal } from '../../components/common/OperationResultModal';
import { DatePickerInput } from '../../components/common/DatePickerInput';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../../utils/theme';
import { formatDateByFormat, formatDateTime, type DateFormat } from '../../utils/formatters';
import { extractError } from '../../api/client';
import { Material, UnitOfMeasure } from '../../types';

const PACK_TYPES = [
  { value: 'BAG', label: 'Bag' },
  { value: 'BOX', label: 'Box' },
  { value: 'DRUM', label: 'Drum' },
  { value: 'CARTON', label: 'Carton' },
  { value: 'CONTAINER', label: 'Container' },
  { value: 'OTHER', label: 'Other' },
];

const todayISO = new Date().toISOString().split('T')[0];

const DATE_FORMATS: { value: DateFormat; label: string }[] = [
  { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
  { value: 'MM-YYYY',    label: 'MM-YYYY' },
];

// Allow up to 3 decimals in KG mode (1 gm precision). COUNT requires integers.
const KG_DEC = /^\d*(?:\.\d{0,3})?$/;
const INT_RE = /^\d*$/;

type ContainerInfo = {
  container_number: number;
  unique_code: string;
  qr_base64?: string;
};

type GRNResult = {
  batch_id: number;
  item_code: string;
  item_name: string;
  batch_number: string;
  grn_number: string;
  unit_of_measure: UnitOfMeasure;
  container_count: number;
  container_quantity: string;
  total_quantity: string;
  pack_type: string;
  supplier_name: string;
  manufacturer_name: string;
  date_of_receipt: string;
  manufacture_date: string;
  expiry_date: string;
  status: string;
  created_at: string;
  qr_base64?: string;
  containers?: ContainerInfo[];
  retesting_number?: string;
};

const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
  <Text style={styles.sectionTitle}>{title}</Text>
);

const ChipRow: React.FC<{
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (v: string) => void;
}> = ({ options, selected, onSelect }) => (
  <View style={styles.chipRow}>
    {options.map((o) => (
      <TouchableOpacity
        key={o.value}
        style={[styles.chip, selected === o.value && styles.chipSelected]}
        onPress={() => onSelect(o.value)}
        activeOpacity={0.7}
      >
        <Text style={[styles.chipText, selected === o.value && styles.chipTextSelected]}>
          {o.label}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
);

const CardRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.cardRow}>
    <Text style={styles.cardRowLabel}>{label}</Text>
    <Text style={styles.cardRowValue}>{value || '—'}</Text>
  </View>
);

export const CreateCardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const prefill = route.params?.prefill ?? null;
  const originalBatchId: number | undefined = route.params?.originalBatchId;

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<GRNResult | null>(null);
  const [errorModal, setErrorModal] = useState({ visible: false, title: '', message: '' });

  const [selectedItem, setSelectedItem] = useState<Material | null>(null);
  const [unit, setUnit] = useState<UnitOfMeasure>('KG');
  const [totalQty, setTotalQty] = useState('');
  const [containers, setContainers] = useState('');
  const [perContainer, setPerContainer] = useState('');
  const [packType, setPackType] = useState('BAG');
  const [dateFormat, setDateFormat] = useState<DateFormat>('DD-MM-YYYY');

  const [form, setForm] = useState({
    grn_number: '',
    retesting_number: '',
    batch_number: '',
    supplier_name: '',
    manufacturer_name: '',
    date_of_receipt: todayISO,
    manufacture_date: '',
    expiry_date: '',
    po_number: '',
    po_date: '',
    invoice_number: '',
    invoice_date: '',
    remarks: '',
  });

  const showError = (title: string, message: string) =>
    setErrorModal({ visible: true, title, message });

  // Pre-populate form when arriving from "Transfer to Quarantine" flow
  useEffect(() => {
    if (!prefill) return;
    const uom = (prefill.unit_of_measure || 'KG') as UnitOfMeasure;
    setUnit(uom);
    setTotalQty(String(prefill.total_quantity ?? ''));
    setContainers(String(prefill.container_count ?? ''));
    setPerContainer(String(prefill.container_quantity ?? ''));
    setPackType((prefill.pack_type || 'BAG').toUpperCase());
    setForm({
      grn_number: '',
      retesting_number: '',
      batch_number: '',
      supplier_name: prefill.supplier_name ?? '',
      manufacturer_name: prefill.manufacturer_name ?? '',
      date_of_receipt: todayISO,
      manufacture_date: prefill.manufacture_date ? String(prefill.manufacture_date).substring(0, 10) : '',
      expiry_date: prefill.expiry_date ? String(prefill.expiry_date).substring(0, 10) : '',
      po_number: '',
      po_date: '',
      invoice_number: '',
      invoice_date: '',
      remarks: '',
    });
    if (prefill.material_id) {
      setSelectedItem({
        id: prefill.material_id,
        material_name: prefill.material_name ?? '',
        material_code: prefill.material_code ?? '',
        unit_of_measure: uom,
        is_active: true,
      } as Material);
    }
  }, []);

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  /** Enforce unit-specific numeric input (KG/L: 3 decimals; COUNT: integer). */
  const sanitize = (v: string): string => (unit === 'COUNT' ? v.replace(/[^\d]/g, '') : v);

  const handleQtyChange = (
    setter: React.Dispatch<React.SetStateAction<string>>,
    raw: string,
  ) => {
    const cleaned = sanitize(raw);
    if ((unit === 'KG' || unit === 'L') && !KG_DEC.test(cleaned)) return;
    if (unit === 'COUNT' && !INT_RE.test(cleaned)) return;
    setter(cleaned);
  };

  /** Auto-fill the missing third field whenever two are present. */
  const onQtyBlur = () => {
    const t = parseFloat(totalQty);
    const c = parseFloat(containers);
    const p = parseFloat(perContainer);
    if (!isNaN(t) && !isNaN(c) && c > 0 && isNaN(p)) {
      const per = unit === 'COUNT' ? Math.round(t / c) : +(t / c).toFixed(3);
      if (isFinite(per) && per > 0) setPerContainer(String(per));
    } else if (!isNaN(t) && !isNaN(p) && p > 0 && isNaN(c)) {
      const n = Math.round(t / p);
      if (isFinite(n) && n > 0) setContainers(String(n));
    } else if (!isNaN(c) && !isNaN(p) && isNaN(t)) {
      const tot = unit === 'COUNT' ? c * p : +(c * p).toFixed(3);
      if (isFinite(tot) && tot > 0) setTotalQty(String(tot));
    }
  };

  const unitLabel = unit === 'KG' ? 'kg' : unit === 'L' ? 'L' : 'count';

  const qtyMismatch: string | null = useMemo(() => {
    const t = parseFloat(totalQty);
    const c = parseFloat(containers);
    const p = parseFloat(perContainer);
    if ([t, c, p].some(isNaN)) return null;
    const expected = c * p;
    if (unit === 'KG' || unit === 'L') {
      return Math.abs(expected - t) > 0.001
        ? `Total should be ${expected.toFixed(3)} ${unitLabel} (${c} × ${p})`
        : null;
    }
    return expected !== t
      ? `Total should be ${expected} (${c} × ${p})`
      : null;
  }, [totalQty, containers, perContainer, unit]);

  const validate = (): boolean => {
    if (!selectedItem) { showError('Required', 'Please select an item.'); return false; }
    if (!form.grn_number.trim()) { showError('Required', 'GRN number is required.'); return false; }
    if (originalBatchId != null && !form.retesting_number.trim()) {
      showError('Required', 'Retesting number is required.'); return false;
    }
    if (!form.batch_number.trim()) { showError('Required', 'Batch / Lot number is required.'); return false; }
    if (!form.supplier_name.trim() || !form.manufacturer_name.trim()) {
      showError('Required', 'Supplier and Manufacturer are required.'); return false;
    }
    if (!totalQty || !containers || !perContainer) {
      showError('Required', 'Total, containers, and qty per container are all required.'); return false;
    }
    const t = parseFloat(totalQty);
    const c = parseInt(containers, 10);
    const p = parseFloat(perContainer);
    if (isNaN(t) || t <= 0 || isNaN(c) || c < 1 || isNaN(p) || p <= 0) {
      showError('Invalid', 'All quantities must be positive.'); return false;
    }
    if (qtyMismatch) { showError('Quantity mismatch', qtyMismatch); return false; }
    if (!form.date_of_receipt) { showError('Required', 'Date of Receipt is required.'); return false; }
    if (!form.manufacture_date) { showError('Required', 'Manufacture Date is required.'); return false; }
    if (!form.expiry_date) { showError('Required', 'Expiry Date is required.'); return false; }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate() || !selectedItem) return;
    setSubmitting(true);
    try {
      const res = await inventoryApi.createGRN({
        material_id: selectedItem.id,
        grn_number: form.grn_number.trim(),
        batch_number: form.batch_number.trim(),
        supplier_name: form.supplier_name.trim(),
        manufacturer_name: form.manufacturer_name.trim(),
        date_of_receipt: form.date_of_receipt,
        manufacture_date: form.manufacture_date,
        expiry_date: form.expiry_date,
        pack_type: packType,
        unit_of_measure: unit,
        container_count: parseInt(containers, 10),
        container_quantity: parseFloat(perContainer),
        total_quantity: parseFloat(totalQty),
        date_format: dateFormat,
        ...(form.po_number.trim() && { po_number: form.po_number.trim() }),
        ...(form.po_date && { po_date: form.po_date }),
        ...(form.invoice_number.trim() && { invoice_number: form.invoice_number.trim() }),
        ...(form.invoice_date && { invoice_date: form.invoice_date }),
        ...(form.remarks.trim() && { remarks: form.remarks.trim() }),
        ...(originalBatchId != null && { original_batch_id: originalBatchId }),
        ...(originalBatchId != null && { retesting_number: form.retesting_number.trim() }),
      });
      setResult(res);
    } catch (error) {
      showError('Error', extractError(error));
    } finally {
      setSubmitting(false);
    }
  };

  // Whenever an item is picked, sync the unit hint from the item's default.
  const handleItemChange = (m: Material | null) => {
    setSelectedItem(m);
    if (m && (m.unit_of_measure === 'KG' || m.unit_of_measure === 'COUNT' || m.unit_of_measure === 'L')) {
      setUnit(m.unit_of_measure);
    }
  };

  const representativeQR = result?.qr_base64 || result?.containers?.[0]?.qr_base64;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create GRN</Text>
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
          <SectionTitle title="Item" />
          <View style={styles.card}>
            <ItemPicker value={selectedItem?.id ?? null} onChange={handleItemChange} />
          </View>

          <SectionTitle title="Supplier & Manufacturer" />
          <View style={styles.card}>
            <Input
              label="Supplier Name *"
              placeholder="e.g. ABC Trading Co."
              value={form.supplier_name}
              onChangeText={(v) => set('supplier_name', v)}
            />
            <Input
              label="Manufacturer Name *"
              placeholder="e.g. Generic Pharma Ltd."
              value={form.manufacturer_name}
              onChangeText={(v) => set('manufacturer_name', v)}
            />
          </View>

          <SectionTitle title="Batch Reference" />
          <View style={styles.card}>
            <Input
              label="Batch / Lot Number *"
              placeholder="e.g. BTH-2026-001"
              value={form.batch_number}
              onChangeText={(v) => set('batch_number', v)}
              autoCapitalize="characters"
            />
          </View>

          <SectionTitle title="Quantity & Packaging" />
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Unit *</Text>
            <View style={styles.unitRow}>
              {(['KG', 'COUNT', 'L'] as UnitOfMeasure[]).map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitChip, unit === u && styles.unitChipActive]}
                  onPress={() => {
                    setUnit(u);
                    setTotalQty(''); setContainers(''); setPerContainer('');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.unitText, unit === u && styles.unitTextActive]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label={`Received Total Quantity * (${unitLabel})`}
              placeholder={unit === 'COUNT' ? 'e.g. 200' : 'e.g. 4000.000'}
              value={totalQty}
              onChangeText={(v) => handleQtyChange(setTotalQty, v)}
              onBlur={onQtyBlur}
              keyboardType={unit === 'COUNT' ? 'number-pad' : 'decimal-pad'}
            />
            <Input
              label="No. of Containers *"
              placeholder="e.g. 100"
              value={containers}
              onChangeText={(v) => {
                const cleaned = v.replace(/[^\d]/g, '');
                setContainers(cleaned);
              }}
              onBlur={onQtyBlur}
              keyboardType="number-pad"
            />
            <Input
              label={`Quantity per Container * (${unitLabel})`}
              placeholder={unit === 'COUNT' ? 'e.g. 10' : 'e.g. 40.000'}
              value={perContainer}
              onChangeText={(v) => handleQtyChange(setPerContainer, v)}
              onBlur={onQtyBlur}
              keyboardType={unit === 'COUNT' ? 'number-pad' : 'decimal-pad'}
            />
            {qtyMismatch ? (
              <Text style={styles.errorText}>{qtyMismatch}</Text>
            ) : null}

            <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Pack Type *</Text>
            <ChipRow options={PACK_TYPES} selected={packType} onSelect={setPackType} />
          </View>

          <SectionTitle title="Dates" />
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Date Format</Text>
            <View style={styles.unitRow}>
              {DATE_FORMATS.map((df) => (
                <TouchableOpacity
                  key={df.value}
                  style={[styles.unitChip, dateFormat === df.value && styles.unitChipActive]}
                  onPress={() => setDateFormat(df.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.unitText, { fontSize: 11 }, dateFormat === df.value && styles.unitTextActive]}>
                    {df.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <DatePickerInput
              label="Date of Receipt *"
              isoValue={form.date_of_receipt}
              format={dateFormat}
              onChange={(iso) => set('date_of_receipt', iso)}
            />
            <DatePickerInput
              label="Manufacture Date *"
              isoValue={form.manufacture_date}
              format={dateFormat}
              onChange={(iso) => set('manufacture_date', iso)}
            />
            <DatePickerInput
              label="Expiry Date *"
              isoValue={form.expiry_date}
              format={dateFormat}
              onChange={(iso) => set('expiry_date', iso)}
            />
          </View>

          <SectionTitle title="Purchase Order" />
          <View style={styles.card}>
            <Input
              label="PO Number"
              placeholder="e.g. PO-2026-001"
              value={form.po_number}
              onChangeText={(v) => set('po_number', v)}
              autoCapitalize="characters"
            />
            <DatePickerInput
              label="PO Date"
              isoValue={form.po_date}
              format={dateFormat}
              onChange={(iso) => set('po_date', iso)}
            />
          </View>

          <SectionTitle title="Invoice" />
          <View style={styles.card}>
            <Input
              label="Invoice Number"
              placeholder="e.g. INV-2026-001"
              value={form.invoice_number}
              onChangeText={(v) => set('invoice_number', v)}
              autoCapitalize="characters"
            />
            <DatePickerInput
              label="Invoice Date"
              isoValue={form.invoice_date}
              format={dateFormat}
              onChange={(iso) => set('invoice_date', iso)}
            />
          </View>

          {originalBatchId != null && (
            <>
              <SectionTitle title="Retesting" />
              <View style={styles.card}>
                <Input
                  label="Retesting Number *"
                  placeholder="e.g. RTN-2026-001"
                  value={form.retesting_number}
                  onChangeText={(v) => set('retesting_number', v)}
                  autoCapitalize="characters"
                />
              </View>
            </>
          )}

          <SectionTitle title="GRN" />
          <View style={styles.card}>
            <Input
              label="GRN Number *"
              placeholder="e.g. GRN-2026-042"
              value={form.grn_number}
              onChangeText={(v) => set('grn_number', v)}
              autoCapitalize="characters"
            />
          </View>

          <SectionTitle title="Remarks" />
          <View style={styles.card}>
            <TextInput
              style={styles.remarksInput}
              placeholder="Add any remarks or notes..."
              placeholderTextColor={Colors.textSecondary}
              value={form.remarks}
              onChangeText={(v) => set('remarks', v)}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <Button
            title="Create"
            onPress={handleSubmit}
            loading={submitting}
            style={styles.submitBtn}
          />
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <OperationResultModal
        visible={errorModal.visible}
        variant="danger"
        title={errorModal.title}
        message={errorModal.message}
        onDismiss={() => setErrorModal({ visible: false, title: '', message: '' })}
        dismissLabel="OK"
      />

      <Modal visible={!!result} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView
            style={styles.modalSheet}
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.successHeader}>
              <View style={styles.successCircle}>
                <Ionicons name="checkmark" size={32} color="#fff" />
              </View>
              <Text style={styles.successTitle}>GRN Created</Text>
              <Text style={styles.successSub}>Batch placed in Quarantine</Text>
            </View>

            {representativeQR ? (
              <View style={styles.qrSection}>
                <Text style={styles.qrLabel}>Container 1 QR (representative)</Text>
                <View style={styles.qrBox}>
                  <Image
                    source={{ uri: `data:image/png;base64,${representativeQR}` }}
                    style={styles.qrImage}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.qrHint}>
                  {result?.container_count ?? 0} unique QRs generated · one per container
                </Text>
              </View>
            ) : null}

            <View style={styles.detailCard}>
              <Text style={styles.detailCardTitle}>GRN Details</Text>

              <CardRow label="GRN" value={result?.grn_number ?? ''} />
              {result?.retesting_number ? (
                <>
                  <View style={styles.divider} />
                  <CardRow label="Retesting No." value={result.retesting_number} />
                </>
              ) : null}
              <View style={styles.divider} />
              <CardRow label="Item Code" value={result?.item_code ?? ''} />
              <View style={styles.divider} />
              <CardRow label="Item Name" value={result?.item_name ?? ''} />
              <View style={styles.divider} />
              <CardRow label="Batch / Lot No." value={result?.batch_number ?? ''} />
              <View style={styles.divider} />
              <CardRow
                label="Total Quantity"
                value={
                  result
                    ? `${result.total_quantity} ${result.unit_of_measure !== 'COUNT' ? result.unit_of_measure : ''}`.trim()
                    : ''
                }
              />
              <View style={styles.divider} />
              <CardRow
                label="Containers"
                value={
                  result
                    ? `${result.container_count} × ${result.container_quantity} ` +
                      `${result.unit_of_measure !== 'COUNT' ? result.unit_of_measure : ''} ` +
                      `(${result.pack_type})`
                    : ''
                }
              />
              <View style={styles.divider} />
              <CardRow label="Supplier" value={result?.supplier_name ?? ''} />
              <View style={styles.divider} />
              <CardRow label="Manufacturer" value={result?.manufacturer_name ?? ''} />
              <View style={styles.divider} />
              <CardRow label="Date of Receipt" value={formatDateByFormat(result?.date_of_receipt, dateFormat)} />
              <View style={styles.divider} />
              <CardRow label="Mfg. Date" value={formatDateByFormat(result?.manufacture_date, dateFormat)} />
              <View style={styles.divider} />
              <CardRow label="Exp. Date" value={formatDateByFormat(result?.expiry_date, dateFormat)} />
              <View style={styles.divider} />
              <View style={styles.cardRow}>
                <Text style={styles.cardRowLabel}>Status</Text>
                <View style={styles.quarantineBadge}>
                  <Text style={styles.quarantineBadgeText}>QUARANTINE</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <CardRow
                label="Created At"
                value={result?.created_at ? formatDateTime(result.created_at) : ''}
              />
            </View>

            <Button
              title="Done"
              onPress={() => {
                setResult(null);
                if (originalBatchId != null) {
                  navigation.navigate('RetestList');
                } else {
                  navigation.goBack();
                }
              }}
              style={styles.doneBtn}
            />
            <View style={{ height: 32 }} />
          </ScrollView>
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

  sectionTitle: {
    fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary,
    marginBottom: 8, marginTop: 16, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, ...Shadow.sm, marginBottom: 4,
  },
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

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: '#f5f5f5',
  },
  chipSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '18' },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  chipTextSelected: { color: Colors.primary, fontWeight: '700' },

  errorText: { color: Colors.danger, fontSize: FontSize.xs, marginTop: 4, marginBottom: 4 },

  remarksInput: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    minHeight: 40,
    padding: 0,
    paddingTop: 4,
  },

  submitBtn: { marginTop: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  modalSheet: {
    flex: 1, marginTop: 50,
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  modalContent: { padding: Spacing.lg, paddingBottom: 16 },

  successHeader: { alignItems: 'center', marginBottom: 20 },
  successCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.success, justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  successTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  successSub: { fontSize: FontSize.sm, color: Colors.textMuted },

  qrSection: { alignItems: 'center', marginBottom: 20 },
  qrLabel: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  qrBox: {
    padding: 12, backgroundColor: '#fff', borderRadius: BorderRadius.md,
    ...Shadow.md, borderWidth: 1, borderColor: Colors.borderLight,
  },
  qrImage: { width: 180, height: 180 },
  qrHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 10 },

  detailCard: {
    backgroundColor: Colors.background, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: 20,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  detailCardTitle: {
    fontSize: FontSize.md, fontWeight: '800', color: Colors.textPrimary,
    marginBottom: 12, paddingBottom: 8,
    borderBottomWidth: 2, borderBottomColor: Colors.primary,
  },
  cardRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 8,
  },
  cardRowLabel: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '500', flex: 1 },
  cardRowValue: {
    fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '600',
    flex: 1.5, textAlign: 'right',
  },
  divider: { height: 1, backgroundColor: Colors.borderLight },

  quarantineBadge: {
    backgroundColor: '#FFF3CD', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3,
  },
  quarantineBadgeText: { fontSize: FontSize.xs, color: '#856404', fontWeight: '700', letterSpacing: 0.5 },
  doneBtn: {},
  printBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: BorderRadius.lg,
    borderWidth: 2, borderColor: Colors.primary, backgroundColor: Colors.surface,
    marginBottom: Spacing.sm,
  },
  printBtnText: { color: Colors.primary, fontWeight: '700', fontSize: FontSize.md },
});
