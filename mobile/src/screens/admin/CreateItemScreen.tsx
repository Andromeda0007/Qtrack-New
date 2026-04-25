import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../../utils/theme';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { materialsApi } from '../../api/materials';
import { extractError } from '../../api/client';

export const CreateItemScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Item name is required.');
      return;
    }
    if (!code.trim()) {
      Alert.alert('Required', 'Item code is required.');
      return;
    }
    setConfirming(true);
  };

  const handleConfirm = async () => {
    setConfirming(false);
    setSubmitting(true);
    try {
      const created = await materialsApi.create({
        material_name: name.trim(),
        material_code: code.trim().toUpperCase(),
        description: description.trim() || undefined,
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
          <View style={styles.card}>
            <Input
              label="Item Name *"
              placeholder="e.g. Paracetamol Powder"
              value={name}
              onChangeText={setName}
            />
            <Input
              label="Item Code *"
              placeholder="e.g. ITM-016"
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
            />
            <Input
              label="Description"
              placeholder="Optional — e.g. Analgesic API, 25 kg bags"
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </View>

          <Button
            title="Create Item"
            onPress={handleSubmit}
            loading={submitting}
            style={{ marginTop: 16 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Confirmation modal */}
      <Modal visible={confirming} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetIcon}>
              <Ionicons name="cube-outline" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.sheetTitle}>Confirm New Item</Text>
            <Text style={styles.sheetSub}>Please review before creating.</Text>

            <View style={styles.detailBox}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Item Name</Text>
                <Text style={styles.detailValue}>{name.trim()}</Text>
              </View>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Item Code</Text>
                <Text style={[styles.detailValue, styles.codeText]}>{code.trim().toUpperCase()}</Text>
              </View>
              {description.trim() ? (
                <>
                  <View style={styles.detailDivider} />
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Description</Text>
                    <Text style={styles.detailValue}>{description.trim()}</Text>
                  </View>
                </>
              ) : null}
            </View>

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setConfirming(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Go Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleConfirm}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.confirmBtnText}>Create</Text>
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
    paddingHorizontal: Spacing.md, paddingVertical: 10, backgroundColor: Colors.primary,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: FontSize.lg, fontWeight: '800' },

  content: { padding: Spacing.md, paddingBottom: 32, backgroundColor: Colors.background, flexGrow: 1 },
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, ...Shadow.sm,
  },

  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: Spacing.lg,
  },
  sheet: {
    backgroundColor: '#fff', borderRadius: BorderRadius.xl ?? 20,
    padding: Spacing.lg, width: '100%', alignItems: 'center', ...Shadow.md,
  },
  sheetIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  sheetTitle: {
    fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4,
  },
  sheetSub: { fontSize: FontSize.sm, color: Colors.textMuted, marginBottom: 20 },

  detailBox: {
    width: '100%', backgroundColor: Colors.background,
    borderRadius: BorderRadius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderLight, marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', paddingVertical: 8,
  },
  detailDivider: { height: 1, backgroundColor: Colors.borderLight },
  detailLabel: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '500', flex: 1 },
  detailValue: {
    fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '600',
    flex: 1.5, textAlign: 'right',
  },
  codeText: { color: Colors.primary, fontWeight: '800', letterSpacing: 0.5 },

  btnRow: { flexDirection: 'row', gap: 12, width: '100%' },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center',
  },
  cancelBtnText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textSecondary },
  confirmBtn: {
    flex: 1, paddingVertical: 13, borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  confirmBtnText: { fontSize: FontSize.md, fontWeight: '800', color: '#fff' },
});
