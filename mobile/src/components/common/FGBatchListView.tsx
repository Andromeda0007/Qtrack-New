import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, StyleSheet, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { qaApi } from '../../api/qa';
import { formatDate } from '../../utils/formatters';
import { Colors, FontSize, Spacing, Shadow, BorderRadius } from '../../utils/theme';

interface Props {
  status?: string;
  onRowPress: (fgBatch: any) => void;
  accentColor?: string;
  emptyMessage?: string;
}

export const FGBatchListView: React.FC<Props> = ({
  status, onRowPress, accentColor = Colors.accent, emptyMessage,
}) => {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await qaApi.listFgBatches(status);
      setBatches(data);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const displayed = search.trim()
    ? batches.filter(b =>
        (b.product_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (b.batch_number || '').toLowerCase().includes(search.toLowerCase()),
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
          placeholder="Search"
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
          <Text style={styles.countLabel}>{displayed.length} batch{displayed.length !== 1 ? 'es' : ''}</Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="cube-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>{emptyMessage ?? 'No FG batches found'}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => onRowPress(item)} activeOpacity={0.8}>
            <View style={styles.cardInner}>
              <View style={styles.cardBody}>
                <View style={[styles.badge, { backgroundColor: accentColor + '20' }]}>
                  <Text style={[styles.badgeText, { color: accentColor }]}>{item.batch_number}</Text>
                </View>
                <Text style={styles.name} numberOfLines={1}>{item.product_name}</Text>
                <View style={styles.meta}>
                  <View style={styles.metaItem}>
                    <Ionicons name="layers-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{item.quantity} units</Text>
                  </View>
                  {item.expiry_date && (
                    <View style={styles.metaItem}>
                      <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
                      <Text style={styles.metaText}>Exp: {formatDate(item.expiry_date)}</Text>
                    </View>
                  )}
                  {item.carton_count && (
                    <View style={styles.metaItem}>
                      <Ionicons name="cube-outline" size={12} color={Colors.textMuted} />
                      <Text style={styles.metaText}>{item.carton_count} cartons</Text>
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
  name: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FontSize.xs, color: Colors.textMuted },
  empty: { alignItems: 'center', paddingTop: 60, gap: Spacing.md },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted },
});
