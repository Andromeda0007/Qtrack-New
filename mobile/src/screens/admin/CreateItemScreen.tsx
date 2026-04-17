import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../../utils/theme';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { materialsApi } from '../../api/materials';
import { UnitOfMeasure } from '../../types';
import { extractError } from '../../api/client';

const UNIT_OPTIONS: { value: UnitOfMeasure; label: string; hint: string }[] = [
  { value: 'KG', label: 'KG', hint: 'Weight-based (e.g. powder, liquid)' },
  { value: 'COUNT', label: 'COUNT', hint: 'Discrete pieces (e.g. tablets, bolts)' },
];

/**
 * Warehouse Head creates a new Item. Code is auto-generated server-side.
 */
export const CreateItemScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<UnitOfMeasure>('KG');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Item name is required.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await materialsApi.create({
        material_name: name.trim(),
        unit_of_measure: unit,
      });
      Toast.show({
        type: 'success',
        text1: `Item created: ${created.material_code}`,
        text2: created.material_name,
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Item</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hintBox}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.info} />
            <Text style={styles.hintText}>
              Item code will be auto-generated (e.g. <Text style={{ fontWeight: '700' }}>ITM-004</Text>).
              You only need to enter the name.
            </Text>
          </View>

          <View style={styles.card}>
            <Input
              label="Item Name *"
              placeholder="e.g. Paracetamol Powder"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Default Unit *</Text>
            <View style={styles.unitRow}>
              {UNIT_OPTIONS.map((u) => (
                <TouchableOpacity
                  key={u.value}
                  style={[styles.unitChip, unit === u.value && styles.unitChipActive]}
                  onPress={() => setUnit(u.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.unitText, unit === u.value && styles.unitTextActive]}
                  >
                    {u.label}
                  </Text>
                  <Text
                    style={[styles.unitHint, unit === u.value && styles.unitHintActive]}
                  >
                    {u.hint}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.footHint}>
              The Warehouse User can still override this unit per GRN.
            </Text>
          </View>

          <Button
            title="Create Item"
            onPress={handleSubmit}
            loading={submitting}
            style={{ marginTop: 16 }}
          />
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
  hintBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.infoLight, padding: 12, borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  hintText: { flex: 1, fontSize: FontSize.xs, color: Colors.info, lineHeight: 18 },

  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, ...Shadow.sm,
  },
  label: {
    fontSize: FontSize.sm, fontWeight: '600',
    color: Colors.textPrimary, marginBottom: 8, marginTop: 4,
  },
  unitRow: { flexDirection: 'row', gap: 10 },
  unitChip: {
    flex: 1, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: BorderRadius.md, padding: 12, backgroundColor: '#fafafa',
  },
  unitChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
  unitText: { fontSize: FontSize.md, fontWeight: '800', color: Colors.textSecondary },
  unitTextActive: { color: Colors.primary },
  unitHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4, lineHeight: 16 },
  unitHintActive: { color: Colors.primary },
  footHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 10, fontStyle: 'italic' },
});
