import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../../utils/theme';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { materialsApi } from '../../api/materials';
import { Material, MaterialBatchCounts } from '../../types';
import { extractError } from '../../api/client';

export const EditItemScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const id: number = route.params?.id;

  const [item, setItem] = useState<Material | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const m = await materialsApi.get(id);
        setItem(m);
        setName(m.material_name);
        setDescription(m.description ?? '');
        setIsActive(m.is_active);
      } catch (e) {
        Alert.alert('Error', extractError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const dirty =
    item &&
    (name !== item.material_name ||
      description !== (item.description ?? ''));

  const handleSave = async () => {
    if (!item) return;
    if (!name.trim()) {
      Alert.alert('Required', 'Name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      const updated = await materialsApi.update(item.id, {
        material_name: name.trim(),
        description: description.trim() || undefined,
      });
      setItem(updated);
      Toast.show({ type: 'success', text1: 'Item updated' });
    } catch (e) {
      Alert.alert('Error', extractError(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!item) return;
    setDeactivating(true);
    try {
      // Fetch impact
      let counts: MaterialBatchCounts | null = null;
      try {
        counts = await materialsApi.batchCounts(item.id);
      } catch {
        // Non-fatal; proceed with a generic warning
      }
      const lines: string[] = [];
      if (counts && counts.total_active > 0) {
        if (counts.quarantine) lines.push(`Quarantine: ${counts.quarantine}`);
        if (counts.under_test) lines.push(`Under Test: ${counts.under_test}`);
        if (counts.approved) lines.push(`Approved: ${counts.approved}`);
        if (counts.quarantine_retest) lines.push(`Retest: ${counts.quarantine_retest}`);
        if (counts.issued_to_production) lines.push(`Issued: ${counts.issued_to_production}`);
      }
      const msg =
        counts && counts.total_active > 0
          ? `${counts.total_active} active batch(es) exist (${lines.join(', ')}).\n\n` +
            'Deactivating hides this item from future GRN creation. ' +
            'Existing batches continue to work unchanged. Proceed?'
          : 'This item has no active batches. Deactivate?';

      Alert.alert('Deactivate item?', msg, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = await materialsApi.update(item.id, { is_active: false });
              setItem(updated);
              setIsActive(false);
              Toast.show({ type: 'info', text1: 'Item deactivated' });
              navigation.goBack();
            } catch (e) {
              Alert.alert('Error', extractError(e));
            }
          },
        },
      ]);
    } finally {
      setDeactivating(false);
    }
  };

  const handleReactivate = async () => {
    if (!item) return;
    try {
      const updated = await materialsApi.update(item.id, { is_active: true });
      setItem(updated);
      setIsActive(true);
      Toast.show({ type: 'success', text1: 'Item re-activated' });
    } catch (e) {
      Alert.alert('Error', extractError(e));
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}><ActivityIndicator color="#fff" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Item</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.codeRow}>
              <Text style={styles.codeLabel}>Item Code</Text>
              <Text style={styles.codeValue}>{item?.material_code}</Text>
            </View>

            <Input
              label="Item Name *"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Paracetamol Powder"
            />
            <Input
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Optional description"
              multiline
            />

            {!isActive ? (
              <View style={styles.inactiveBanner}>
                <Ionicons name="alert-circle" size={16} color="#856404" />
                <Text style={styles.inactiveBannerText}>
                  This item is currently <Text style={{ fontWeight: '800' }}>inactive</Text> and hidden
                  from the Warehouse User's picker.
                </Text>
              </View>
            ) : null}
          </View>

          <Button
            title="Save changes"
            onPress={handleSave}
            loading={saving}
            disabled={!dirty}
            style={{ marginTop: 16 }}
          />

          {isActive ? (
            <TouchableOpacity
              onPress={handleDeactivate}
              style={styles.deactivateBtn}
              disabled={deactivating}
              activeOpacity={0.7}
            >
              <Ionicons name="power" size={16} color={Colors.danger} />
              <Text style={styles.deactivateText}>Deactivate item</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleReactivate}
              style={styles.reactivateBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={16} color={Colors.success} />
              <Text style={styles.reactivateText}>Re-activate item</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 10, backgroundColor: Colors.primary,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: FontSize.lg, fontWeight: '800' },

  content: { padding: Spacing.md, paddingBottom: 32, backgroundColor: Colors.background, flexGrow: 1 },
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, ...Shadow.sm,
  },
  codeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: 12, marginBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  codeLabel: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '600' },
  codeValue: {
    fontSize: FontSize.md, color: Colors.primary, fontWeight: '800', letterSpacing: 0.5,
  },

  inactiveBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.warningLight, padding: 10, borderRadius: BorderRadius.md,
    marginTop: 14,
  },
  inactiveBannerText: { flex: 1, fontSize: FontSize.xs, color: '#856404', lineHeight: 16 },

  deactivateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 16, paddingVertical: 12, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.danger, backgroundColor: '#fff5f5',
  },
  deactivateText: { color: Colors.danger, fontWeight: '700', fontSize: FontSize.md },

  reactivateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 16, paddingVertical: 12, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.success, backgroundColor: '#f4fdf6',
  },
  reactivateText: { color: Colors.success, fontWeight: '700', fontSize: FontSize.md },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
