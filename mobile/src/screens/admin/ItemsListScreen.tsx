import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, FlatList, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../../utils/theme';
import { materialsApi } from '../../api/materials';
import { Material } from '../../types';

type Filter = 'ALL' | 'ACTIVE' | 'INACTIVE';

/**
 * Warehouse Head: list of Items (materials).
 *
 * Prefetches the full list (including inactive) once on screen focus and
 * applies search/filter entirely client-side — no network trip on filter.
 */
export const ItemsListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('ACTIVE');

  const load = useCallback(async () => {
    try {
      const list = await materialsApi.list(true);
      setItems(list);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((m) => {
      if (filter === 'ACTIVE' && !m.is_active) return false;
      if (filter === 'INACTIVE' && m.is_active) return false;
      if (!q) return true;
      return (
        m.material_code.toLowerCase().includes(q) ||
        m.material_name.toLowerCase().includes(q)
      );
    });
  }, [items, query, filter]);

  const renderFilter = (key: Filter, label: string, count: number) => (
    <TouchableOpacity
      key={key}
      onPress={() => setFilter(key)}
      style={[styles.chip, filter === key && styles.chipActive]}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, filter === key && styles.chipTextActive]}>
        {label} · {count}
      </Text>
    </TouchableOpacity>
  );

  const activeCount = items.filter((m) => m.is_active).length;
  const inactiveCount = items.length - activeCount;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Items</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('CreateItem')}
          style={styles.iconBtn}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.search}
          placeholder="Search by code or name"
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.chipsRow}>
        {renderFilter('ACTIVE', 'Active', activeCount)}
        {renderFilter('INACTIVE', 'Inactive', inactiveCount)}
        {renderFilter('ALL', 'All', items.length)}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="cube-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No items</Text>
          <Text style={styles.emptyHint}>
            {items.length === 0
              ? 'Tap + to add your first item.'
              : 'Try a different filter or search.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ padding: Spacing.md }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={Colors.primary}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, !item.is_active && styles.rowInactive]}
              onPress={() => navigation.navigate('EditItem', { id: item.id })}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.code}>{item.material_code}</Text>
                <Text style={styles.name} numberOfLines={1}>{item.material_name}</Text>
                {!item.is_active ? (
                  <View style={styles.metaRow}>
                    <Text style={[styles.metaTag, styles.inactiveTag]}>Inactive</Text>
                  </View>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    backgroundColor: Colors.primary,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: FontSize.lg, fontWeight: '800' },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: Spacing.md, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  search: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary, padding: 0 },

  chipsRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: Spacing.md, marginBottom: Spacing.sm,
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: '#f5f5f5',
  },
  chipActive: { backgroundColor: Colors.primary + '18', borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: Colors.primary, fontWeight: '800' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    padding: 14, marginBottom: 10, ...Shadow.sm,
  },
  rowInactive: { opacity: 0.6 },
  code: {
    fontSize: FontSize.sm, color: Colors.primary, fontWeight: '800', letterSpacing: 0.5,
  },
  name: { fontSize: FontSize.md, color: Colors.textPrimary, marginTop: 2, fontWeight: '600' },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  metaTag: {
    fontSize: FontSize.xs, fontWeight: '700',
    backgroundColor: Colors.borderLight, color: Colors.textSecondary,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden',
  },
  inactiveTag: { backgroundColor: Colors.warningLight, color: '#856404' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary, marginTop: 14 },
  emptyHint: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 6, textAlign: 'center' },
});
