import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { chatApi } from "../../api/chat";
import {
  Colors,
  FontSize,
  Spacing,
  BorderRadius,
  Shadow,
} from "../../utils/theme";

type GroupInfo = {
  name: string;
  description: string;
  members: { id: number; name: string; username: string }[];
};

const Row: React.FC<{ icon: string; label: string; value: string }> = ({
  icon,
  label,
  value,
}) => (
  <View style={styles.row}>
    <View style={styles.rowIconWrap}>
      <Ionicons name={icon as any} size={20} color={Colors.primary} />
    </View>
    <View style={styles.rowContent}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || "—"}</Text>
    </View>
  </View>
);

const MemberRow: React.FC<{ name: string; username: string }> = ({
  name,
  username,
}) => (
  <View style={styles.memberRow}>
    <View style={styles.rowIconWrap}>
      <Ionicons name="person-outline" size={20} color={Colors.primary} />
    </View>
    <View style={styles.memberRowContent}>
      <Text style={styles.memberName}>{name || username}</Text>
      <Text style={styles.memberUsername}>{username}</Text>
    </View>
  </View>
);

export const ChatGroupInfoScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { roomId, roomName } = route.params as {
    roomId: number;
    roomName?: string;
  };

  const [info, setInfo] = useState<GroupInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    chatApi
      .getGroupInfo(roomId)
      .then(setInfo)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [roomId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Group info</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !info) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Group info</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Could not load group info</Text>
        </View>
      </SafeAreaView>
    );
  }

  const name = info.name || roomName || "Group";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group info</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name[0].toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.memberCount}>{info.members.length} members</Text>
        </View>

        <Text style={[styles.sectionTitle, styles.sectionTitleFirst]}>Description</Text>
        <View style={styles.card}>
          <Text style={styles.descriptionText}>
            {info.description.trim() || "No description"}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Members</Text>
        <View style={styles.membersCard}>
          {info.members.map((m, index) => (
            <View key={m.id}>
              {index > 0 && <View style={styles.memberDivider} />}
              <MemberRow name={m.name} username={m.username} />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f0f2f5" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: "800", color: "#fff" },

  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { fontSize: FontSize.sm, color: Colors.textMuted },

  scroll: { flex: 1 },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 40,
  },

  avatarWrap: { alignItems: "center", paddingVertical: Spacing.lg },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 36, fontWeight: "700", color: "#fff" },
  name: {
    fontSize: FontSize.xl,
    fontWeight: "800",
    color: Colors.textPrimary,
    marginTop: 12,
  },
  memberCount: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },

  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  sectionTitleFirst: {
    marginTop: Spacing.sm,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  descriptionText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  rowIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + "14",
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  rowContent: { flex: 1 },
  rowLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: 2,
    fontWeight: "600",
  },
  rowValue: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    fontWeight: "500",
  },
  divider: { height: 1, backgroundColor: "#eee", marginLeft: 52 },

  membersCard: {
    backgroundColor: "#fff",
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    ...Shadow.sm,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm + 4,
  },
  memberRowContent: { flex: 1 },
  memberName: {
    fontSize: FontSize.md,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  memberUsername: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  memberDivider: {
    height: 1,
    backgroundColor: "#eee",
    marginLeft: 52,
  },
});
