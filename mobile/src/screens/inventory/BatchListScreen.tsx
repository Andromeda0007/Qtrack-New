import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { inventoryApi } from '../../api/inventory';
import { SearchInput } from '../../components/common/SearchInput';
import { Card } from '../../components/common/Card';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Colors, FontSize, Spacing } from '../../utils/theme';
import { formatDate, formatQuantity } from '../../utils/formatters';
import { Batch } from '../../types';

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Quarantine', value: 'QUARANTINE' },
  { label: 'Under Test', value: 'UNDER_TEST' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Retest', value: 'QUARANTINE_RETEST' },
];

export const BatchListScreen: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [filtered, setFiltered] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [search, setSearch] = useState('');
  const navigation = useNavigation<any>();

  const loadBatches = useCallback(async () => {
    try {
      const data = await inventoryApi.getBatches(selectedStatus || undefined);
      setBatches(data);
      applySearch(data, search);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedStatus]);

  useEffect(() => { loadBatches(); }, [loadBatches]);

  const applySearch = (data: Batch[], query: string) => {
    if (!query.trim()) { setFiltered(data); return; }
    const q = query.toLowerCase();
    setFiltered(data.filter((b) =>
      b.batch_number.toLowerCase().includes(q) ||
      (b.material_name || '').toLowerCase().includes(q) ||
      (b.grn_number || '').toLowerCase().includes(q)
    ));
  };

  const handleSearch = (text: string) => {
    setSearch(text);
    applySearch(batches, text);
  };

  const onRefresh = () => { setRefreshing(true); loadBatches(); };

  const renderBatch = ({ item }: { item: Batch }) => (
    <TouchableOpacity onPress={() => navigation.navigate('BatchDetail', { batchId: item.id })} activeOpacity={0.8}>
      <Card>
        <View style={styles.batchHeader}>
          <Text style={styles.batchNumber}>{item.batch_number}</Text>
          <StatusBadge status={item.status} type="batch" />
        </View>
        <Text style={styles.materialName}>{item.material_name || '—'}</Text>
        <View style={styles.batchMeta}>
          <MetaItem icon="layers" label={`${formatQuantity(item.remaining_quantity)} / ${formatQuantity(item.total_quantity)}`} />
          <MetaItem icon="calendar" label={formatDate(item.expiry_date)} />
          {item.retest_date && <MetaItem icon="refresh" label={formatDate(item.retest_date)} color={Colors.warning} />}
        </View>
        {item.grn_number && <Text style={styles.grnText}>GRN: {item.grn_number}</Text>}
      </Card>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Batch Stock</Text>
        <Text style={styles.subtitle}>{filtered.length} batches</Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <SearchInput
          value={search}
          onChangeText={handleSearch}
          placeholder="Search"
        />
      </View>

      {/* Status Filters */}
      <FlatList
        data={STATUS_FILTERS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(i) => i.value}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, selectedStatus === item.value && styles.filterChipActive]}
            onPress={() => setSelectedStatus(item.value)}
          >
            <Text style={[styles.filterLabel, selectedStatus === item.value && styles.filterLabelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Batch List */}
      <FlatList
        data={filtered}
        keyExtractor={(b) => b.id.toString()}
        renderItem={renderBatch}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="cube-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No batches found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const MetaItem: React.FC<{ icon: string; label: string; color?: string }> = ({ icon, label, color = Colors.textSecondary }) => (
  <View style={styles.metaItem}>
    <Ionicons name={icon as any} size={13} color={color} />
    <Text style={[styles.metaText, { color }]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: Spacing.md, backgroundColor: Colors.primary, paddingBottom: Spacing.lg },
  title: { fontSize: FontSize.xl, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  searchWrap: { margin: Spacing.md, marginBottom: 0 },
  filterRow: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  filterLabelActive: { color: '#fff' },
  list: { padding: Spacing.md },
  batchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  batchNumber: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary, flex: 1, marginRight: Spacing.sm },
  materialName: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm },
  batchMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FontSize.xs },
  grnText: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: Spacing.xs },
  empty: { alignItems: 'center', paddingTop: Spacing.xxl, gap: Spacing.md },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted },
});
