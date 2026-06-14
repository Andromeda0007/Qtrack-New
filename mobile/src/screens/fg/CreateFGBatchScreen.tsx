import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { productionApi } from '../../api/production';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { DatePickerInput } from '../../components/common/DatePickerInput';
import { OperationResultModal } from '../../components/common/OperationResultModal';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../../utils/theme';
import { formatDateByFormat, type DateFormat } from '../../utils/formatters';
import { extractError } from '../../api/client';
import { UnitOfMeasure } from '../../types';

const PACK_TYPES = [
  { value: 'BAG',       label: 'Bag' },
  { value: 'BOX',       label: 'Box' },
  { value: 'DRUM',      label: 'Drum' },
  { value: 'CARTON',    label: 'Carton' },
  { value: 'CONTAINER', label: 'Container' },
  { value: 'OTHER',     label: 'Other' },
];

const DATE_FORMATS: { value: DateFormat; label: string }[] = [
  { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
  { value: 'MM-YYYY',    label: 'MM-YYYY'    },
];

const todayISO = new Date().toISOString().split('T')[0];

const KG_DEC = /^\d*(?:\.\d{0,3})?$/;
const INT_RE  = /^\d*$/;

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

export const CreateFGBatchScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]         = useState<any | null>(null);
  const [errorModal, setErrorModal] = useState<{ title: string; message: string } | null>(null);

  const [unit, setUnit]             = useState<UnitOfMeasure>('COUNT');
  const [totalQty, setTotalQty]     = useState('');
  const [containers, setContainers] = useState('');
  const [perContainer, setPerContainer] = useState('');
  const [packType, setPackType]     = useState('CARTON');
  const [dateFormat, setDateFormat] = useState<DateFormat>('DD-MM-YYYY');

  const [form, setForm] = useState({
    product_name:    '',
    fg_batch_number: '',
    fgtn_number:     '',
    manufacture_date: '',
    expiry_date:      '',
    remarks:          '',
  });
  const [packSizeCount, setPackSizeCount] = useState('');
  const [packSizeUnit, setPackSizeUnit]   = useState('');

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const showError = (title: string, message: string) => setErrorModal({ title, message });

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
    return expected !== t ? `Total should be ${expected} (${c} × ${p})` : null;
  }, [totalQty, containers, perContainer, unit]);

  const validate = (): boolean => {
    if (!form.product_name.trim()) {
      showError('Required', 'Product name is required.');
      return false;
    }
    if (!form.fg_batch_number.trim()) {
      showError('Required', 'FG Batch number is required.');
      return false;
    }
    if (!totalQty || !containers || !perContainer) {
      showError('Required', 'Total, containers, and qty per container are all required.');
      return false;
    }
    const t = parseFloat(totalQty);
    const c = parseInt(containers, 10);
    const p = parseFloat(perContainer);
    if (isNaN(t) || t <= 0 || isNaN(c) || c < 1 || isNaN(p) || p <= 0) {
      showError('Invalid', 'All quantities must be positive.');
      return false;
    }
    if (qtyMismatch) {
      showError('Quantity mismatch', qtyMismatch);
      return false;
    }
    if (!form.manufacture_date) {
      showError('Required', 'Manufacture Date is required.');
      return false;
    }
    if (!form.expiry_date) {
      showError('Required', 'Expiry Date is required.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await productionApi.createFGBatch({
        product_name:     form.product_name.trim(),
        batch_number:     form.fg_batch_number.trim(),
        fgtn_number:      form.fgtn_number.trim() || undefined,
        manufacture_date: form.manufacture_date,
        expiry_date:      form.expiry_date,
        quantity:         parseFloat(totalQty),
        carton_count:     parseInt(containers, 10),
        pack_size_count:  packSizeCount ? parseInt(packSizeCount, 10) : undefined,
        pack_size_unit:   packSizeUnit.trim() || undefined,
        remarks:          form.remarks.trim() || undefined,
      });
      setResult(res);
    } catch (error) {
      showError('Error', extractError(error));
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
        <Text style={styles.headerTitle}>Create Finished Good</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          <SectionTitle title="Product" />
          <View style={styles.card}>
            <Input
              label="Product Name *"
              placeholder="e.g. Paracetamol 500mg Tablets"
              value={form.product_name}
              onChangeText={(v) => set('product_name', v)}
            />
          </View>

          <SectionTitle title="Batch Reference" />
          <View style={styles.card}>
            <Input
              label="FGTN No."
              placeholder="e.g. FGTN-2026-001"
              value={form.fgtn_number}
              onChangeText={(v) => set('fgtn_number', v)}
              autoCapitalize="characters"
            />
            <Input
              label="Batch / Lot Number *"
              placeholder="e.g. BTH-2026-001"
              value={form.fg_batch_number}
              onChangeText={(v) => set('fg_batch_number', v)}
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
                  onPress={() => { setUnit(u); setTotalQty(''); setContainers(''); setPerContainer(''); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.unitText, unit === u && styles.unitTextActive]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label={`Total Quantity * (${unitLabel})`}
              placeholder={unit === 'COUNT' ? 'e.g. 5000' : 'e.g. 200.000'}
              value={totalQty}
              onChangeText={(v) => handleQtyChange(setTotalQty, v)}
              onBlur={onQtyBlur}
              keyboardType={unit === 'COUNT' ? 'number-pad' : 'decimal-pad'}
            />
            <Input
              label="No. of Cartons *"
              placeholder="e.g. 100"
              value={containers}
              onChangeText={(v) => { const c = v.replace(/[^\d]/g, ''); setContainers(c); }}
              onBlur={onQtyBlur}
              keyboardType="number-pad"
            />
            <Input
              label={`Quantity per Carton * (${unitLabel})`}
              placeholder={unit === 'COUNT' ? 'e.g. 50' : 'e.g. 2.000'}
              value={perContainer}
              onChangeText={(v) => handleQtyChange(setPerContainer, v)}
              onBlur={onQtyBlur}
              keyboardType={unit === 'COUNT' ? 'number-pad' : 'decimal-pad'}
            />
            {qtyMismatch ? <Text style={styles.errorText}>{qtyMismatch}</Text> : null}

            <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Pack Type *</Text>
            <ChipRow options={PACK_TYPES} selected={packType} onSelect={setPackType} />

            <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Pack Size (inner pack)</Text>
            <View style={styles.packSizeRow}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Count"
                  placeholder="e.g. 10"
                  value={packSizeCount}
                  onChangeText={(v) => setPackSizeCount(v.replace(/[^\d]/g, ''))}
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flex: 2, marginLeft: 8 }}>
                <Input
                  label="Unit"
                  placeholder="e.g. tablets/blister"
                  value={packSizeUnit}
                  onChangeText={setPackSizeUnit}
                />
              </View>
            </View>
          </View>

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitleInline}>Dates</Text>
            <View style={styles.formatToggle}>
              {DATE_FORMATS.map((f) => (
                <TouchableOpacity
                  key={f.value}
                  style={[styles.formatTab, dateFormat === f.value && styles.formatTabActive]}
                  onPress={() => setDateFormat(f.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.formatTabText, dateFormat === f.value && styles.formatTabTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.card}>
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

          <SectionTitle title="Remarks" />
          <View style={styles.card}>
            <TextInput
              style={styles.remarksInput}
              placeholder="Optional notes about this batch…"
              placeholderTextColor={Colors.textTertiary ?? '#aaa'}
              value={form.remarks}
              onChangeText={(v) => set('remarks', v)}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <Button title="Create" onPress={handleSubmit} loading={submitting} style={styles.submitBtn} />
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <OperationResultModal
        visible={!!errorModal}
        variant="danger"
        title={errorModal?.title ?? ''}
        message={errorModal?.message ?? ''}
        onDismiss={() => setErrorModal(null)}
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
              <Text style={styles.successTitle}>FG Batch Created</Text>
              <Text style={styles.successSub}>Batch placed in Finished Good</Text>
            </View>

            <View style={styles.detailCard}>
              <Text style={styles.detailCardTitle}>FG Batch Details</Text>
              <CardRow label="FG Batch No." value={result?.batch_number ?? ''} />
              <View style={styles.divider} />
              <CardRow label="Product Name"  value={form.product_name} />
              <View style={styles.divider} />
              <CardRow label="Quantity"       value={totalQty ? `${totalQty} ${unitLabel}` : ''} />
              <View style={styles.divider} />
              <CardRow label="Cartons"        value={containers} />
              <View style={styles.divider} />
              <CardRow label="Mfg. Date"      value={formatDateByFormat(form.manufacture_date, dateFormat)} />
              <View style={styles.divider} />
              <CardRow label="Exp. Date"      value={formatDateByFormat(form.expiry_date, dateFormat)} />
              <View style={styles.divider} />
              <View style={styles.cardRow}>
                <Text style={styles.cardRowLabel}>Status</Text>
                <View style={styles.fgBadge}>
                  <Text style={styles.fgBadgeText}>FINISHED GOOD</Text>
                </View>
              </View>
            </View>

            <Button
              title="Done"
              onPress={() => { setResult(null); navigation.goBack(); }}
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

  sectionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8, marginTop: 16, marginLeft: 4, marginRight: 4,
  },
  sectionTitle: {
    fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary,
    marginBottom: 8, marginTop: 16, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  sectionTitleInline: {
    fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, ...Shadow.sm, marginBottom: 4,
  },
  fieldLabel: {
    fontSize: FontSize.sm, fontWeight: '600',
    color: Colors.textPrimary, marginBottom: 8, marginTop: 4,
  },

  formatToggle: { flexDirection: 'row', gap: 4 },
  formatTab: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: '#fafafa',
  },
  formatTabActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '15' },
  formatTabText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  formatTabTextActive: { color: Colors.primary },

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
  packSizeRow: { flexDirection: 'row', alignItems: 'flex-start' },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: '#f5f5f5',
  },
  chipSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '18' },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  chipTextSelected: { color: Colors.primary, fontWeight: '700' },

  errorText: { color: Colors.danger, fontSize: FontSize.xs, marginTop: 4, marginBottom: 4 },
  submitBtn: { marginTop: 16 },

  remarksInput: {
    minHeight: 96, fontSize: FontSize.md, color: Colors.textPrimary,
    backgroundColor: Colors.inputBg ?? '#F8F9FA',
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: BorderRadius.md, padding: Spacing.md,
  },

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
  successSub:   { fontSize: FontSize.sm, color: Colors.textMuted },

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

  fgBadge: {
    backgroundColor: '#FFF3CD', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3,
  },
  fgBadgeText: { fontSize: FontSize.xs, color: '#856404', fontWeight: '700', letterSpacing: 0.5 },
  doneBtn: {},
});
