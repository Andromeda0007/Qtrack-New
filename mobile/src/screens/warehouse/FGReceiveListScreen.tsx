import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { finishedGoodsApi, FGBatchListItem } from '../../api/finishedGoods';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../../utils/theme';
import { formatDate, formatQuantity } from '../../utils/formatters';

const EmptyState = () => (
  <View style={styles.empty}>
    <Ionicons name="checkmark-done-circle-outline" size={52} color={Colors.textMuted} />
    <Text style={styles.emptyTitle}>No FG batches awaiting receipt</Text>
    <Text style={styles.emptySub}>QA-approved batches will appear here.</Text>
  </View>
);

const FGCard: React.FC<{ item: FGBatchListItem; onPress: () => void }> = ({ item, onPress }) => (
  <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
    <View style={styles.cardTop}>
      <View style={{ flex: 1, gap: 2 }}>
        {item.fgtn_no ? (
          <Text style={styles.fgtnLabel}>FGTN: {item.fgtn_no}</Text>
        ) : null}
        <Text style={styles.batchNo}>{item.batch_number}</Text>
        <Text style={styles.productName}>{item.product_name}</Text>
      </View>
      <View style={styles.qaBadge}>
        <Text style={styles.qaBadgeText}>QA Approved</Text>
      </View>
    </View>
    <View style={styles.metaRow}>
      <View style={styles.metaItem}>
        <Ionicons name="layers-outline" size={13} color={Colors.textMuted} />
        <Text style={styles.metaText}>{formatQuantity(item.quantity)} units</Text>
      </View>
      {item.pack_size ? (
        <View style={styles.metaItem}>
          <Ionicons name="cube-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.metaText}>{item.pack_size}</Text>
        </View>
      ) : null}
      <View style={styles.metaItem}>
        <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
        <Text style={styles.metaText}>Exp: {formatDate(item.expiry_date)}</Text>
      </View>
    </View>
    <View style={styles.receiveRow}>
      <Ionicons name="arrow-down-circle-outline" size={16} color={Colors.success} />
      <Text style={styles.receiveText}>Tap to receive into warehouse</Text>
    </View>
  </TouchableOpacity>
);

export const FGReceiveListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [batches, setBatches] = useState<FGBatchListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await finishedGoodsApi.listByStatus('QA_APPROVED');
      setBatches(data);
    } catch {
      setBatches([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Receive FG</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={batches}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={batches.length === 0 ? styles.fillCenter : styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={EmptyState}
          renderItem={({ item }) => (
            <FGCard
              item={item}
              onPress={() => navigation.navigate('ReceiveFG', { batch: item })}
            />
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
    paddingHorizontal: Spacing.md, paddingVertical: 12, backgroundColor: Colors.primary,
  },
  backBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '800', color: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  fillCenter: { flex: 1, justifyContent: 'center', backgroundColor: Colors.background },
  listContent: { padding: Spacing.md, gap: Spacing.sm, backgroundColor: Colors.background },

  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, ...Shadow.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  fgtnLabel: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '700' },
  batchNo: { fontSize: FontSize.md, fontWeight: '800', color: Colors.textPrimary },
  productName: { fontSize: FontSize.sm, color: Colors.textSecondary },
  qaBadge: {
    backgroundColor: Colors.success + '20', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  qaBadgeText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.success },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600' },

  receiveRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: 10,
  },
  receiveText: { fontSize: FontSize.xs, color: Colors.success, fontWeight: '700' },

  empty: { alignItems: 'center', gap: 10, padding: Spacing.xl },
  emptyTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  emptySub: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
});
