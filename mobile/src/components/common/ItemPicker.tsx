import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, FlatList,
  StyleSheet, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, BorderRadius, Spacing, Shadow } from '../../utils/theme';
import { Material } from '../../types';
import { materialsApi } from '../../api/materials';

interface Props {
  value: number | null;
  onChange: (material: Material | null) => void;
  label?: string;
  placeholder?: string;
  /** Hide deactivated items from the list (default true — Warehouse User flow). */
  activeOnly?: boolean;
}

/**
 * Item (Material) picker used on Create-GRN.
 *
 * On mount it prefetches the full active item list once and filters
 * client-side as the user types — no network roundtrip on every keystroke.
 * Shows "ITM-001 · Paracetamol Powder" style options.
 */
export const ItemPicker: React.FC<Props> = ({
  value, onChange, label = 'Item *', placeholder = 'Tap to select an item', activeOnly = true,
}) => {
  const [items, setItems] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await materialsApi.list(!activeOnly);
        if (!cancelled) setItems(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeOnly]);

  const selected = useMemo(
    () => items.find((m) => m.id === value) || null,
    [items, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (m) =>
        m.material_code.toLowerCase().includes(q) ||
        m.material_name.toLowerCase().includes(q),
    );
  }, [items, query]);

  const handlePick = (m: Material) => {
    onChange(m);
    setOpen(false);
    setQuery('');
  };

  const renderLabel = () => (
    <Text style={styles.placeholder}>{placeholder}</Text>
  );

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {selected ? (
        <TouchableOpacity onPress={() => setOpen(true)} activeOpacity={0.8}>
          <View style={styles.selectedBoxRow}>
            <View style={styles.selectedBox}>
              <Text style={styles.selectedKey}>Item Code</Text>
              <Text style={styles.selectedVal}>{selected.material_code}</Text>
            </View>
            <View style={[styles.selectedBox, { flex: 2 }]}>
              <Text style={styles.selectedKey}>Item Name</Text>
              <Text style={styles.selectedVal} numberOfLines={2}>{selected.material_name}</Text>
            </View>
            <Ionicons name="chevron-down" size={16} color={Colors.textMuted} style={{ alignSelf: 'center' }} />
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={() => setOpen(true)}
          style={styles.field}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>{renderLabel()}</View>
          <Ionicons name="chevron-down" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      )}

      {!loading && items.length === 0 ? (
        <Text style={styles.empty}>
          No items available. Ask your Warehouse Head to add items first.
        </Text>
      ) : null}

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.sheetTitle}>Select Item</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search by code or name"
              placeholderTextColor={Colors.textMuted}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query.length > 0 ? (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.empty}>No items match "{query}".</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(m) => String(m.id)}
              contentContainerStyle={{ padding: Spacing.sm }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const inactive = !item.is_active;
                return (
                  <TouchableOpacity
                    style={[styles.row, inactive && styles.rowInactive]}
                    onPress={() => handlePick(item)}
                    activeOpacity={0.6}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowCode}>{item.material_code}</Text>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {item.material_name}
                      </Text>
                      {inactive ? <Text style={styles.inactiveTag}>Inactive</Text> : null}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.md },
  label: {
    fontSize: FontSize.sm, fontWeight: '600',
    color: Colors.textPrimary, marginBottom: Spacing.xs,
  },
  field: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: BorderRadius.md, paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: Colors.surface,
  },
  placeholder: { color: Colors.textMuted, fontSize: FontSize.md },
  selectedBoxRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  selectedBox: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary + '55',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  selectedKey: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', marginBottom: 2 },
  selectedVal: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '700' },
  code: { fontWeight: '800', color: Colors.primary },
  empty: {
    color: Colors.textMuted, fontSize: FontSize.sm, marginTop: 6, fontStyle: 'italic',
  },

  sheet: { flex: 1, backgroundColor: Colors.background },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: Spacing.md, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary, padding: 0 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    marginBottom: 8, ...Shadow.sm,
  },
  rowInactive: { opacity: 0.55 },
  rowCode: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.primary, letterSpacing: 0.5 },
  rowName: { fontSize: FontSize.md, color: Colors.textPrimary, marginTop: 2 },
  rowUom: {
    fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary,
    backgroundColor: Colors.borderLight, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, overflow: 'hidden',
  },
  inactiveTag: {
    fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2,
    fontStyle: 'italic',
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
});
