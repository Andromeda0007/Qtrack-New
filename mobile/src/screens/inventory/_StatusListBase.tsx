import React, { useState, useEffect, useCallback } from "react";
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
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { inventoryApi } from "../../api/inventory";
import { SearchInput } from "../../components/common/SearchInput";
import { formatDate } from "../../utils/formatters";
import {
  Colors,
  FontSize,
  Spacing,
  Shadow,
  BorderRadius,
} from "../../utils/theme";

type SortMode = "last_created" | "first_created" | "expiry_soon";

const SORT_OPTIONS: { label: string; value: SortMode; icon: string }[] = [
  { label: "First Created", value: "first_created", icon: "arrow-up-outline" },
  { label: "Last Created", value: "last_created", icon: "time-outline" },
  { label: "Expiry Soon", value: "expiry_soon", icon: "alert-circle-outline" },
];

function applySort(data: any[], mode: SortMode): any[] {
  const copy = [...data];
  if (mode === "last_created") return copy.sort((a, b) => b.id - a.id);
  if (mode === "first_created") return copy.sort((a, b) => a.id - b.id);
  if (mode === "expiry_soon") {
    return copy.sort((a, b) => {
      if (!a.expiry_date) return 1;
      if (!b.expiry_date) return -1;
      return (
        new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
      );
    });
  }
  return copy;
}

interface Props {
  status: string;
  title: string;
  bgColor: string;
  textColor: string;
  icon: string;
}

export const StatusListBase: React.FC<Props> = ({
  status,
  title,
  bgColor,
  textColor,
  icon,
}) => {
  const navigation = useNavigation<any>();
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("first_created");

  const load = useCallback(async () => {
    try {
      const data = await inventoryApi.getBatches(status);
      setBatches(data);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const displayed = applySort(
    search.trim()
      ? batches.filter((b) =>
          (b.material_code || "").toLowerCase().includes(search.toLowerCase()),
        )
      : batches,
    sort,
  );

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate("BatchDetail", { batchId: item.id })}
      activeOpacity={0.8}
    >
      <View style={styles.cardInner}>
        <View style={styles.cardContent}>
          <View style={[styles.idBadge, { backgroundColor: bgColor }]}>
            <Text style={[styles.idText, { color: textColor }]}>
              #{item.id}
            </Text>
          </View>

          <Text style={styles.itemCode}>{item.material_code || "—"}</Text>
          <Text style={styles.itemName}>{item.material_name || "—"}</Text>

          <View style={styles.cardMeta}>
            <View style={styles.metaItem}>
              <Ionicons
                name="layers-outline"
                size={13}
                color={Colors.textMuted}
              />
              <Text style={styles.metaText}>
                {item.remaining_quantity} / {item.total_quantity}
              </Text>
            </View>
            {item.expiry_date ? (
              <View style={styles.metaItem}>
                <Ionicons
                  name="calendar-outline"
                  size={13}
                  color={Colors.textMuted}
                />
                <Text style={styles.metaText}>
                  {formatDate(item.expiry_date)}
                </Text>
              </View>
            ) : null}
            <View style={styles.metaItem}>
              <Ionicons
                name="barcode-outline"
                size={13}
                color={Colors.textMuted}
              />
              <Text style={styles.metaText}>{item.batch_number}</Text>
            </View>
          </View>
        </View>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={textColor}
          style={styles.chevron}
        />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={22} color="#444" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name={icon as any} size={20} color="#444" />
          <Text style={[styles.headerTitle, { color: "#444" }]}>{title}</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search..."
        />
      </View>

      {/* Sort Options */}
      <View style={styles.sortRow}>
        {SORT_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.sortChip,
              sort === opt.value && {
                backgroundColor: bgColor,
                borderColor: textColor,
              },
            ]}
            onPress={() => setSort(opt.value)}
          >
            <Ionicons
              name={opt.icon as any}
              size={12}
              color={sort === opt.value ? textColor : Colors.textSecondary}
            />
            <Text
              style={[
                styles.sortLabel,
                sort === opt.value && { color: textColor },
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={textColor} />
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(b) => b.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={textColor}
            />
          }
          ListHeaderComponent={
            <Text style={styles.countLabel}>
              {displayed.length}{" "}
              {displayed.length === 1 ? "product" : "products"}
            </Text>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="cube-outline"
                size={48}
                color={Colors.textMuted}
              />
              <Text style={styles.emptyText}>
                No {title.toLowerCase()} cards
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: FontSize.lg, fontWeight: "800", color: "#fff" },

  searchRow: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },

  sortRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  sortChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  sortLabel: { fontSize: 11, fontWeight: "600", color: Colors.textSecondary },

  list: { paddingHorizontal: Spacing.md, paddingBottom: 32 },
  countLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  cardInner: { flexDirection: "row", alignItems: "center" },
  cardContent: { flex: 1 },
  idBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  idText: { fontSize: FontSize.xs, fontWeight: "700" },
  chevron: { marginLeft: Spacing.sm },
  itemCode: {
    fontSize: FontSize.md,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  itemName: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: Spacing.sm,
  },
  cardMeta: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: FontSize.xs, color: Colors.textMuted },

  empty: { alignItems: "center", paddingTop: 60, gap: Spacing.md },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted },
});
