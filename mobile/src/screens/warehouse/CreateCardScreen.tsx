import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, Modal, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { inventoryApi } from '../../api/inventory';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../../utils/theme';
import { formatDateTime } from '../../utils/formatters';
import { extractError } from '../../api/client';

const PACK_TYPES = [
  { value: 'BAG', label: 'Bag' },
  { value: 'BOX', label: 'Box' },
  { value: 'DRUM', label: 'Drum' },
  { value: 'CARTON', label: 'Carton' },
  { value: 'CONTAINER', label: 'Container' },
  { value: 'OTHER', label: 'Other' },
];

const todayISO = new Date().toISOString().split('T')[0]; // YYYY-MM-DD for backend
const todayDisplay = todayISO.split('-').reverse().join('-'); // DD-MM-YYYY for display

/** Convert YYYY-MM-DD → DD-MM-YYYY for display on the card */
const toDisplay = (val: string): string => {
  if (!val) return '—';
  const parts = val.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return val;
};

/** Convert DD-MM-YYYY → YYYY-MM-DD for the backend */
const toISO = (val: string): string => {
  const parts = val.trim().split(/[-/]/);
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return val;
};

type CardResult = {
  batch_id: number;
  item_code: string;
  item_name: string;
  batch_number: string;
  grn_number: string;
  total_quantity: string;
  container_quantity: string;
  pack_type: string;
  supplier_name: string;
  manufacturer_name: string;
  date_of_receipt: string;
  manufacture_date: string;
  expiry_date: string;
  status: string;
  created_at: string;
  qr_base64: string;
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
  const [submitting, setSubmitting] = useState(false);
  const [card, setCard] = useState<CardResult | null>(null);

  const [form, setForm] = useState({
    item_code: '',
    item_name: '',
    grn_number: '',
    batch_number: '',
    total_quantity: '',
    container_quantity: '',
    pack_type: 'BAG',
    supplier_name: '',
    manufacturer_name: '',
    date_of_receipt: todayDisplay,
    manufacture_date: '',
    expiry_date: '',
  });

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const validate = (): boolean => {
    const fields: [keyof typeof form, string][] = [
      ['item_code', 'Item Code'],
      ['item_name', 'Item Name'],
      ['grn_number', 'Product Number'],
      ['batch_number', 'Batch / Lot Number'],
      ['total_quantity', 'Received Total Quantity'],
      ['container_quantity', 'Container / Bag / Drum Quantity'],
      ['supplier_name', 'Supplier Name'],
      ['manufacturer_name', 'Manufacturer Name'],
      ['date_of_receipt', 'Date of Receipt'],
      ['manufacture_date', 'Manufacture Date'],
      ['expiry_date', 'Expiry Date'],
    ];
    for (const [key, label] of fields) {
      if (!form[key]?.trim()) {
        Alert.alert('Required', `${label} is required.`);
        return false;
      }
    }
    if (isNaN(parseFloat(form.total_quantity)) || parseFloat(form.total_quantity) <= 0) {
      Alert.alert('Invalid', 'Total quantity must be a positive number.');
      return false;
    }
    if (isNaN(parseFloat(form.container_quantity)) || parseFloat(form.container_quantity) <= 0) {
      Alert.alert('Invalid', 'Container quantity must be a positive number.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const result = await inventoryApi.createProduct({
        item_code: form.item_code.trim(),
        item_name: form.item_name.trim(),
        grn_number: form.grn_number.trim(),
        batch_number: form.batch_number.trim(),
        total_quantity: parseFloat(form.total_quantity),
        container_quantity: parseFloat(form.container_quantity),
        pack_type: form.pack_type,
        supplier_name: form.supplier_name.trim(),
        manufacturer_name: form.manufacturer_name.trim(),
        date_of_receipt: toISO(form.date_of_receipt),
        manufacture_date: toISO(form.manufacture_date),
        expiry_date: toISO(form.expiry_date),
      });
      setCard(result);
    } catch (error) {
      Alert.alert('Error', extractError(error));
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
        <Text style={styles.headerTitle}>Create Card</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          <SectionTitle title="Product Info" />
          <View style={styles.card}>
            <Input label="Item Code *" placeholder="e.g. ITM-001" value={form.item_code} onChangeText={(v) => set('item_code', v)} autoCapitalize="characters" />
            <Input label="Item Name *" placeholder="e.g. Rubik's Cube" value={form.item_name} onChangeText={(v) => set('item_name', v)} />
          </View>

          <SectionTitle title="Supplier & Manufacturer" />
          <View style={styles.card}>
            <Input label="Supplier Name *" placeholder="e.g. ABC Trading Co." value={form.supplier_name} onChangeText={(v) => set('supplier_name', v)} />
            <Input label="Manufacturer Name *" placeholder="e.g. Rubik's Brand Ltd." value={form.manufacturer_name} onChangeText={(v) => set('manufacturer_name', v)} />
          </View>

          <SectionTitle title="Batch & Product Reference" />
          <View style={styles.card}>
            <Input label="Batch / Lot Number *" placeholder="e.g. BTH-2026-001" value={form.batch_number} onChangeText={(v) => set('batch_number', v)} autoCapitalize="characters" />
            <Input label="Product Number *" placeholder="e.g. PRD-2026-0042" value={form.grn_number} onChangeText={(v) => set('grn_number', v)} autoCapitalize="characters" />
          </View>

          <SectionTitle title="Quantity & Packaging" />
          <View style={styles.card}>
            <Input label="Received Total Quantity *" placeholder="e.g. 100" value={form.total_quantity} onChangeText={(v) => set('total_quantity', v)} keyboardType="decimal-pad" />
            <Input label="Container / Bag / Drum Quantity *" placeholder="e.g. 10 (qty per container)" value={form.container_quantity} onChangeText={(v) => set('container_quantity', v)} keyboardType="decimal-pad" />
            <Text style={styles.fieldLabel}>Pack Type *</Text>
            <ChipRow options={PACK_TYPES} selected={form.pack_type} onSelect={(v) => set('pack_type', v)} />
          </View>

          <SectionTitle title="Dates" />
          <View style={styles.card}>
            <Input label="Date of Receipt *" placeholder="DD-MM-YYYY" value={form.date_of_receipt} onChangeText={(v) => set('date_of_receipt', v)} keyboardType="numbers-and-punctuation" />
            <Input label="Manufacture Date *" placeholder="DD-MM-YYYY" value={form.manufacture_date} onChangeText={(v) => set('manufacture_date', v)} keyboardType="numbers-and-punctuation" />
            <Input label="Expiry Date *" placeholder="DD-MM-YYYY" value={form.expiry_date} onChangeText={(v) => set('expiry_date', v)} keyboardType="numbers-and-punctuation" />
          </View>

          <View style={styles.infoNote}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.info} />
            <Text style={styles.infoNoteText}>
              Product will be placed in <Text style={{ fontWeight: '700' }}>Quarantine</Text>. A QR code will be generated for tracking.
            </Text>
          </View>

          <Button title="Create Card" onPress={handleSubmit} loading={submitting} style={styles.submitBtn} />
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Product Card Success Modal */}
      <Modal visible={!!card} animationType="slide" transparent>
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
              <Text style={styles.successTitle}>Product Card Created!</Text>
              <Text style={styles.successSub}>Batch placed in Quarantine</Text>
            </View>

            {/* QR Code */}
            {card?.qr_base64 ? (
              <View style={styles.qrSection}>
                <Text style={styles.qrLabel}>QR Code</Text>
                <View style={styles.qrBox}>
                  <Image
                    source={{ uri: `data:image/png;base64,${card.qr_base64}` }}
                    style={styles.qrImage}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.qrHint}>Scan this QR to track the product</Text>
              </View>
            ) : null}

            {/* Details Card */}
            <View style={styles.detailCard}>
              <Text style={styles.detailCardTitle}>Product Details</Text>

              <CardRow label="Item Code" value={card?.item_code ?? ''} />
              <View style={styles.divider} />
              <CardRow label="Item Name" value={card?.item_name ?? ''} />
              <View style={styles.divider} />
              <CardRow label="Batch / Lot No." value={card?.batch_number ?? ''} />
              <View style={styles.divider} />
              <CardRow label="Product Number" value={card?.grn_number ?? ''} />
              <View style={styles.divider} />
              <CardRow label="Total Quantity" value={card?.total_quantity ?? ''} />
              <View style={styles.divider} />
              <CardRow label="Container Qty" value={`${card?.container_quantity ?? ''} / ${card?.pack_type ?? ''}`} />
              <View style={styles.divider} />
              <CardRow label="Supplier Name" value={card?.supplier_name ?? ''} />
              <View style={styles.divider} />
              <CardRow label="Manufacturer" value={card?.manufacturer_name ?? ''} />
              <View style={styles.divider} />
              <CardRow label="Date of Receipt" value={toDisplay(card?.date_of_receipt ?? '')} />
              <View style={styles.divider} />
              <CardRow label="Mfg. Date" value={toDisplay(card?.manufacture_date ?? '')} />
              <View style={styles.divider} />
              <CardRow label="Exp. Date" value={toDisplay(card?.expiry_date ?? '')} />
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
                value={card?.created_at ? formatDateTime(card.created_at) : ''}
              />
            </View>

            <Button
              title="Done"
              onPress={() => { setCard(null); navigation.goBack(); }}
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
    fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8, marginTop: 4,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: '#f5f5f5',
  },
  chipSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '18' },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  chipTextSelected: { color: Colors.primary, fontWeight: '700' },

  infoNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.info + '12', borderRadius: BorderRadius.sm,
    padding: 12, marginTop: 16, marginBottom: 8,
  },
  infoNoteText: { flex: 1, fontSize: FontSize.xs, color: Colors.info, lineHeight: 18 },
  submitBtn: { marginTop: 16 },

  // Modal
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
});
