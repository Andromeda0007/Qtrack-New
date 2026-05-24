import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, FontSize, Spacing, Shadow, BorderRadius } from "../../utils/theme";
import { inventoryApi } from "../../api/inventory";

const daysPill = (days: number) => {
  if (days <= 3) return { bg: "#fde8e8", text: "#c0392b" };
  if (days <= 7) return { bg: "#fef3cd", text: "#856404" };
  return { bg: "#e8f5e9", text: "#2e7d32" };
};

export const RetestListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await inventoryApi.getExpiringSoon();
      setBatches(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Retest Due</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Retest Due</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={batches}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle-outline" size={48} color={Colors.success} />
            <Text style={styles.emptyText}>No batches due for retest in the next 15 days</Text>
          </View>
        }
        renderItem={({ item }) => {
          const days = item.days_until_retest ?? 0;
          const pill = daysPill(days);
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate("BatchDetail", { batchId: item.id })}
              activeOpacity={0.8}
            >
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.material_name}</Text>
                  <Text style={styles.itemSub}>{item.material_code} · {item.batch_number}</Text>
                </View>
                <View style={[styles.daysPill, { backgroundColor: pill.bg }]}>
                  <Text style={[styles.daysPillText, { color: pill.text }]}>
                    {days === 0 ? "Today" : `${days}d`}
                  </Text>
                </View>
              </View>
              <View style={styles.cardBottom}>
                <Text style={styles.metaText}>
                  GRN: {item.grn_number ?? "—"} · {item.unit_of_measure}
                </Text>
                <Text style={styles.metaText}>
                  Retest: {item.retest_date ? String(item.retest_date) : "—"}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primary },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: Spacing.md, paddingVertical: 10, backgroundColor: Colors.primary,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: FontSize.lg, fontWeight: "800" },
  list: { padding: Spacing.md, backgroundColor: Colors.background, flexGrow: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.background },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", paddingHorizontal: 32 },
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.sm, ...Shadow.sm,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  itemName: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  itemSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  daysPill: {
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3,
    alignSelf: "flex-start",
  },
  daysPillText: { fontSize: FontSize.xs, fontWeight: "700" },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  metaText: { fontSize: FontSize.xs, color: Colors.textSecondary },
});
