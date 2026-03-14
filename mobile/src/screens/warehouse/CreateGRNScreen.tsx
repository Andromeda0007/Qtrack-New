import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { inventoryApi } from '../../api/inventory';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../../utils/theme';
import { Material, Supplier } from '../../types';
import { extractError } from '../../api/client';

const PACK_TYPES = ['Bag', 'Box', 'Drum', 'Can', 'Bottle', 'Carton', 'Pallet', 'Other'];

const SelectModal: React.FC<{
  visible: boolean;
  title: string;
  items: { id: number; label: string }[];
  onSelect: (item: { id: number; label: string }) => void;
  onClose: () => void;
  emptyMessage: string;
}> = ({ visible, title, items, onSelect, onClose, emptyMessage }) => (
  <Modal visible={visible} animationType="slide" transparent>
    <View style={styles.pickerOverlay}>
      <View style={styles.pickerSheet}>
        <View style={styles.pickerHeader}>
          <Text style={styles.pickerTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        {items.length === 0 ? (
          <View style={styles.pickerEmpty}>
            <Ionicons name="alert-circle-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.pickerEmptyText}>{emptyMessage}</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(i) => i.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.pickerItem} onPress={() => onSelect(item)} activeOpacity={0.7}>
                <Text style={styles.pickerItemText}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </View>
  </Modal>
);

export const CreateGRNScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [showMaterialPicker, setShowMaterialPicker] = useState(false);
  const [showSupplierPicker, setShowSupplierPicker] = useState(false);
  const [showPackTypePicker, setShowPackTypePicker] = useState(false);

  const [form, setForm] = useState({
    material_id: 0,
    material_label: '',
    supplier_id: 0,
    supplier_label: '',
    batch_number: '',
    total_quantity: '',
    pack_size: '',
    pack_type: '',
    manufacture_date: '',
    expiry_date: '',
    invoice_number: '',
    remarks: '',
  });

  const set = (key: string, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    inventoryApi.getMaterials().then(setMaterials).catch(() => {});
    inventoryApi.getSuppliers().then(setSuppliers).catch(() => {});
  }, []);

  const validate = () => {
    if (!form.material_id) { Alert.alert('Required', 'Please select a material.'); return false; }
    if (!form.batch_number.trim()) { Alert.alert('Required', 'Batch number is required.'); return false; }
    const qty = parseFloat(form.total_quantity);
    if (!form.total_quantity || isNaN(qty) || qty <= 0) {
      Alert.alert('Required', 'Please enter a valid quantity.'); return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await inventoryApi.createGRN({
        material_id: form.material_id,
        supplier_id: form.supplier_id || undefined,
        batch_number: form.batch_number.trim(),
        total_quantity: parseFloat(form.total_quantity),
        pack_size: form.pack_size ? parseFloat(form.pack_size) : undefined,
        pack_type: form.pack_type || undefined,
        manufacture_date: form.manufacture_date || undefined,
        expiry_date: form.expiry_date || undefined,
        invoice_number: form.invoice_number || undefined,
        remarks: form.remarks || undefined,
      });
      navigation.goBack();
      Alert.alert('GRN Created', `Batch ${form.batch_number} has been received and placed in Quarantine.`);
    } catch (error) {
      Alert.alert('Error', extractError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create GRN</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Section: Material & Supplier */}
          <Text style={styles.sectionTitle}>Material Details</Text>
          <View style={styles.card}>

            {/* Material Picker */}
            <Text style={styles.fieldLabel}>Material <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowMaterialPicker(true)} activeOpacity={0.7}>
              <Text style={[styles.pickerBtnText, !form.material_label && styles.pickerBtnPlaceholder]}>
                {form.material_label || 'Select material'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={Colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.fieldGap} />

            {/* Supplier Picker */}
            <Text style={styles.fieldLabel}>Supplier <Text style={styles.optional}>(optional)</Text></Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowSupplierPicker(true)} activeOpacity={0.7}>
              <Text style={[styles.pickerBtnText, !form.supplier_label && styles.pickerBtnPlaceholder]}>
                {form.supplier_label || 'Select supplier'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Section: Batch Info */}
          <Text style={styles.sectionTitle}>Batch Information</Text>
          <View style={styles.card}>
            <Input
              label="Batch Number *"
              placeholder="e.g. BTH-2025-001"
              value={form.batch_number}
              onChangeText={(v) => set('batch_number', v)}
              autoCapitalize="characters"
            />
            <Input
              label="Total Quantity *"
              placeholder="e.g. 500"
              value={form.total_quantity}
              onChangeText={(v) => set('total_quantity', v)}
              keyboardType="decimal-pad"
            />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Pack Size"
                  placeholder="e.g. 25"
                  value={form.pack_size}
                  onChangeText={(v) => set('pack_size', v)}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Pack Type</Text>
                <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowPackTypePicker(true)} activeOpacity={0.7}>
                  <Text style={[styles.pickerBtnText, !form.pack_type && styles.pickerBtnPlaceholder]}>
                    {form.pack_type || 'Select'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Section: Dates */}
          <Text style={styles.sectionTitle}>Dates</Text>
          <View style={styles.card}>
            <Input
              label="Manufacture Date"
              placeholder="YYYY-MM-DD"
              value={form.manufacture_date}
              onChangeText={(v) => set('manufacture_date', v)}
              keyboardType="numbers-and-punctuation"
            />
            <Input
              label="Expiry Date"
              placeholder="YYYY-MM-DD"
              value={form.expiry_date}
              onChangeText={(v) => set('expiry_date', v)}
              keyboardType="numbers-and-punctuation"
            />
          </View>

          {/* Section: Other */}
          <Text style={styles.sectionTitle}>Additional Info</Text>
          <View style={styles.card}>
            <Input
              label="Invoice Number"
              placeholder="e.g. INV-20250301"
              value={form.invoice_number}
              onChangeText={(v) => set('invoice_number', v)}
            />
            <Input
              label="Remarks"
              placeholder="Any notes about this shipment..."
              value={form.remarks}
              onChangeText={(v) => set('remarks', v)}
              multiline
            />
          </View>

          <View style={styles.infoNote}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.info} />
            <Text style={styles.infoNoteText}>
              Batch will be placed in <Text style={{ fontWeight: '700' }}>Quarantine</Text> on receipt and moved to QC testing.
            </Text>
          </View>

          <Button
            title="Submit GRN"
            onPress={handleSubmit}
            loading={submitting}
            style={styles.submitBtn}
          />
          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Material Picker Modal */}
      <SelectModal
        visible={showMaterialPicker}
        title="Select Material"
        items={materials.map((m) => ({ id: m.id, label: m.material_name }))}
        onSelect={(item) => { set('material_id', item.id); set('material_label', item.label); setShowMaterialPicker(false); }}
        onClose={() => setShowMaterialPicker(false)}
        emptyMessage={'No materials found.\nAsk Warehouse Head to add materials first.'}
      />

      {/* Supplier Picker Modal */}
      <SelectModal
        visible={showSupplierPicker}
        title="Select Supplier"
        items={suppliers.map((s) => ({ id: s.id, label: s.supplier_name }))}
        onSelect={(item) => { set('supplier_id', item.id); set('supplier_label', item.label); setShowSupplierPicker(false); }}
        onClose={() => setShowSupplierPicker(false)}
        emptyMessage={'No suppliers found.\nAsk Warehouse Head to add suppliers first.'}
      />

      {/* Pack Type Picker Modal */}
      <SelectModal
        visible={showPackTypePicker}
        title="Select Pack Type"
        items={PACK_TYPES.map((t, i) => ({ id: i + 1, label: t }))}
        onSelect={(item) => { set('pack_type', item.label); setShowPackTypePicker(false); }}
        onClose={() => setShowPackTypePicker(false)}
        emptyMessage=""
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
  content: { padding: Spacing.md },

  sectionTitle: {
    fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary,
    marginBottom: 8, marginTop: 16, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, ...Shadow.sm, marginBottom: 4,
  },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  fieldGap: { height: 4 },

  fieldLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary, marginBottom: 6, marginTop: 4 },
  required: { color: Colors.danger },
  optional: { color: Colors.textMuted, fontWeight: '400', fontSize: FontSize.xs },

  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md,
    paddingHorizontal: 12, paddingVertical: 13, backgroundColor: '#fafafa', marginBottom: 8,
  },
  pickerBtnText: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '500' },
  pickerBtnPlaceholder: { color: Colors.textMuted, fontWeight: '400' },

  infoNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.info + '12', borderRadius: BorderRadius.sm,
    padding: 12, marginTop: 16, marginBottom: 8,
  },
  infoNoteText: { flex: 1, fontSize: FontSize.xs, color: Colors.info, lineHeight: 18 },

  submitBtn: { marginTop: 16 },

  // Picker modal
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '60%', paddingBottom: 32,
  },
  pickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  pickerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  pickerItemText: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '500' },
  pickerEmpty: { alignItems: 'center', padding: Spacing.xl },
  pickerEmptyText: { textAlign: 'center', color: Colors.textMuted, marginTop: 12, lineHeight: 22 },
});
