import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { chatApi } from "../../api/chat";
import { SearchInput } from "../../components/common/SearchInput";
import {
  Colors,
  FontSize,
  Spacing,
  BorderRadius,
  Shadow,
} from "../../utils/theme";

type UserResult = {
  id: number;
  name: string;
  username: string;
  role: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  WAREHOUSE_HEAD: "Warehouse Head",
  WAREHOUSE_USER: "Warehouse User",
  QC_EXECUTIVE: "QC Executive",
  QC_HEAD: "QC Head",
  QA_EXECUTIVE: "QA Executive",
  QA_HEAD: "QA Head",
  PRODUCTION_USER: "Production User",
  PURCHASE_USER: "Purchase User",
};

const ROLE_ORDER = [
  "WAREHOUSE_HEAD",
  "WAREHOUSE_USER",
  "QC_HEAD",
  "QC_EXECUTIVE",
  "QA_HEAD",
  "QA_EXECUTIVE",
  "PRODUCTION_USER",
  "PURCHASE_USER",
];

export const NewChatScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [allUsers, setAllUsers] = useState<UserResult[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    chatApi
      .searchUsers("")
      .then(setAllUsers)
      .finally(() => setLoading(false));
  }, []);

  const sections = useMemo(() => {
    const filtered = query.trim()
      ? allUsers.filter(
          (u) =>
            u.name.toLowerCase().includes(query.toLowerCase()) ||
            u.username.toLowerCase().includes(query.toLowerCase()),
        )
      : allUsers;

    const grouped: Record<string, UserResult[]> = {};
    for (const u of filtered) {
      const key = u.role ?? "OTHER";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(u);
    }

    return ROLE_ORDER.filter((r) => grouped[r]?.length).map((r) => ({
      title: ROLE_LABELS[r] ?? r,
      data: grouped[r],
    }));
  }, [allUsers, query]);

  const startChat = (user: UserResult) => {
    navigation.replace("ChatRoom", { userId: user.id, roomName: user.name });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Message</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.content}>
      <Pressable
        style={({ pressed }) => [
          styles.createGroupRow,
          pressed && styles.createGroupRowPressed,
        ]}
        onPress={() => navigation.navigate("NewGroup")}
      >
        <View style={styles.createGroupIconWrap}>
          <Ionicons name="people" size={20} color={Colors.primary} />
        </View>
        <Text style={styles.createGroupText}>Create group</Text>
        <Ionicons name="add" size={22} color={Colors.primary} />
      </Pressable>

      <View style={styles.searchWrap}>
        <SearchInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search..."
          autoFocus
        />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(u) => u.id.toString()}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.userItem,
                pressed && styles.userItemPressed,
              ]}
              onPress={() => startChat(item)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(item.name || "?")[0].toUpperCase()}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.name}</Text>
                <Text style={styles.userHandle}>@{item.username}</Text>
              </View>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No users found</Text>
            </View>
          }
          stickySectionHeadersEnabled
        />
      )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primary },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
  },
  backBtn: {
    width: 38,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: "800",
    color: "#fff",
  },
  content: { flex: 1, backgroundColor: Colors.background },

  createGroupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: "#fff",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadow.sm,
  },
  createGroupRowPressed: { backgroundColor: Colors.primary + "12" },
  createGroupIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + "18",
    justifyContent: "center",
    alignItems: "center",
  },
  createGroupText: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: "600",
    color: Colors.textPrimary,
  },

  searchWrap: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },

  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  sectionHeader: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  userItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
    backgroundColor: Colors.surface,
  },
  userItemPressed: {
    backgroundColor: Colors.primary + "12",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 17, fontWeight: "700", color: "#fff" },
  userInfo: { flex: 1 },
  userName: {
    fontSize: FontSize.md,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  userHandle: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  separator: { height: 1, backgroundColor: Colors.borderLight, marginLeft: 72 },

  empty: { alignItems: "center", paddingTop: 60 },
  emptyText: { fontSize: FontSize.sm, color: Colors.textMuted },
});
