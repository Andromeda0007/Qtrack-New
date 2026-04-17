import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, StyleSheet, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { inventoryApi } from '../../api/inventory';
import { formatDate } from '../../utils/formatters';
import { Colors, FontSize, Spacing, Shadow, BorderRadius } from '../../utils/theme';

interface Props {
  statuses: string[];
  onRowPress: (batch: any) => void;
  accentColor?: string;
  emptyMessage?: string;
}

export const BatchListView: React.FC<Props> = ({
  statuses, onRowPress, accentColor = Colors.primary, emptyMessage,
}) => {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const data = statuses.length === 1
        ? await inventoryApi.getBatches(statuses[0])
        : await inventoryApi.getBatchesByStatuses(statuses);
      setBatches(data);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statuses.join(',')]);

  useEffect(() => { load(); }, [load]);

  const displayed = search.trim()
    ? batches.filter(b =>
        (b.material_code || '').toLowerCase().includes(search.toLowerCase()) ||
        (b.material_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (b.grn_number || '').toLowerCase().includes(search.toLowerCase()),
      )
    : batches;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={accentColor} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by item code, name or GRN…"
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={displayed}
        keyExtractor={b => b.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={accentColor} />
        }
        ListHeaderComponent={
          <Text style={styles.countLabel}>{displayed.length} item{displayed.length !== 1 ? 's' : ''}</Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="cube-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>{emptyMessage ?? 'No items found'}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => onRowPress(item)} activeOpacity={0.8}>
            <View style={styles.cardInner}>
              <View style={styles.cardBody}>
                <View style={[styles.badge, { backgroundColor: accentColor + '20' }]}>
                  <Text style={[styles.badgeText, { color: accentColor }]}>{item.grn_number || `#${item.id}`}</Text>
                </View>
                <Text style={styles.code}>{item.material_code || '—'}</Text>
                <Text style={styles.name} numberOfLines={1}>{item.material_name || '—'}</Text>
                <View style={styles.meta}>
                  {item.total_quantity != null && (
                    <View style={styles.metaItem}>
                      <Ionicons name="layers-outline" size={12} color={Colors.textMuted} />
                      <Text style={styles.metaText}>{item.remaining_quantity ?? item.total_quantity} {item.unit_of_measure ?? 'KG'}</Text>
                    </View>
                  )}
                  {item.expiry_date && (
                    <View style={styles.metaItem}>
                      <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
                      <Text style={styles.metaText}>{formatDate(item.expiry_date)}</Text>
                    </View>
                  )}
                  {item.batch_number && (
                    <View style={styles.metaItem}>
                      <Ionicons name="barcode-outline" size={12} color={Colors.textMuted} />
                      <Text style={styles.metaText}>{item.batch_number}</Text>
                    </View>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={accentColor} />
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Spacing.md, marginBottom: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    paddingHorizontal: 12, paddingVertical: 9, ...Shadow.sm,
  },
  searchInput: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary },
  list: { paddingHorizontal: Spacing.md, paddingBottom: 24 },
  countLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600', marginBottom: Spacing.sm },
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.sm, ...Shadow.sm,
  },
  cardInner: { flexDirection: 'row', alignItems: 'center' },
  cardBody: { flex: 1 },
  badge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6 },
  badgeText: { fontSize: FontSize.xs, fontWeight: '800' },
  code: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  name: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2, marginBottom: 8 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FontSize.xs, color: Colors.textMuted },
  empty: { alignItems: 'center', paddingTop: 60, gap: Spacing.md },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted },
});
