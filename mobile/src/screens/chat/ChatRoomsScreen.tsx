import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { chatApi, createChatWebSocket } from "../../api/chat";
import { useAuthStore } from "../../store/authStore";
import { SearchInput } from "../../components/common/SearchInput";
import {
  Colors,
  FontSize,
  Spacing,
  BorderRadius,
  Shadow,
} from "../../utils/theme";
import { formatTimeOrDateIST } from "../../utils/formatters";
import { ChatConversation } from "../../types";

type UserResult = {
  id: number;
  name: string;
  username: string;
  role: string | null;
};

const Avatar: React.FC<{ name: string; size?: number; isGroup?: boolean }> = ({
  name,
  size = 48,
  isGroup,
}) => (
  <View
    style={[
      styles.avatar,
      { width: size, height: size, borderRadius: size / 2 },
    ]}
  >
    {isGroup ? (
      <Ionicons name="people" size={size * 0.45} color="#fff" />
    ) : (
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>
        {(name || "?")[0].toUpperCase()}
      </Text>
    )}
  </View>
);

export const ChatRoomsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { token } = useAuthStore();
  const [rooms, setRooms] = useState<ChatConversation[]>([]);
  const [allUsers, setAllUsers] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const roomsRef = useRef<ChatConversation[]>([]);

  // Keep ref in sync so WS handler always sees latest rooms
  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  const load = useCallback(async () => {
    try {
      const [roomData, userData] = await Promise.all([
        chatApi.getRooms(),
        chatApi.searchUsers(""),
      ]);
      setRooms(roomData);
      setAllUsers(userData);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Connect WS when screen is focused, disconnect on blur
  useFocusEffect(
    useCallback(() => {
      load();

      if (token && !wsRef.current) {
        const ws = createChatWebSocket(token);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);

            if (payload.type === "message") {
              const rid: number = payload.room_id;
              const existing = roomsRef.current.find((r) => r.id === rid);

              if (existing) {
                // Update last message preview + timestamp in place, bubble room to top
                setRooms((prev) => {
                  const updated = prev.map((r) =>
                    r.id === rid
                      ? {
                          ...r,
                          last_message: payload.content,
                          last_message_at: payload.created_at,
                        }
                      : r,
                  );
                  // Sort: room with latest message first
                  return [...updated].sort((a, b) => {
                    const ta = a.last_message_at
                      ? new Date(a.last_message_at).getTime()
                      : 0;
                    const tb = b.last_message_at
                      ? new Date(b.last_message_at).getTime()
                      : 0;
                    return tb - ta;
                  });
                });
              } else {
                // New room (first message ever) — reload full list
                load();
              }
            }
          } catch {}
        };
      }

      return () => {
        wsRef.current?.close();
        wsRef.current = null;
      };
    }, [token]),
  );

  const sections = useMemo(() => {
    if (!query.trim()) {
      return rooms.length > 0
        ? [
            {
              title: "CONVERSATIONS",
              data: rooms.map((r) => ({ type: "room" as const, room: r })),
            },
          ]
        : [];
    }

    const q = query.toLowerCase();

    // Matching existing rooms
    const matchedRooms = rooms
      .filter((r) => r.name?.toLowerCase().includes(q))
      .map((r) => ({ type: "room" as const, room: r }));

    // Users not already in a room
    const existingUserIds = new Set(
      rooms
        .filter((r) => !r.is_group && r.other_user)
        .map((r) => r.other_user!.id),
    );
    const matchedUsers = allUsers
      .filter(
        (u) =>
          !existingUserIds.has(u.id) &&
          (u.name.toLowerCase().includes(q) ||
            u.username.toLowerCase().includes(q)),
      )
      .map((u) => ({ type: "user" as const, user: u }));

    const result = [];
    if (matchedRooms.length)
      result.push({ title: "CONVERSATIONS", data: matchedRooms });
    if (matchedUsers.length)
      result.push({ title: "START NEW CHAT", data: matchedUsers });
    return result;
  }, [query, rooms, allUsers]);

  const openRoom = (room: ChatConversation) => {
    navigation.navigate("ChatRoom", {
      roomId: room.id,
      roomName: room.name,
      otherUserId: room.other_user?.id,
      isGroup: room.is_group ?? false,
    });
  };

  const startDM = (user: UserResult) => {
    navigation.navigate("ChatRoom", { userId: user.id, roomName: user.name });
  };

  type ListItem =
    | { type: "room"; room: ChatConversation }
    | { type: "user"; user: UserResult };

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === "room") {
      const r = item.room;
      return (
        <TouchableOpacity
          style={styles.roomItem}
          onPress={() => openRoom(r)}
          activeOpacity={0.75}
        >
          <Avatar name={r.name ?? "?"} isGroup={r.is_group} />
          <View style={styles.roomInfo}>
            <View style={styles.roomTop}>
              <Text style={styles.roomName} numberOfLines={1}>
                {r.name}
              </Text>
              <Text style={styles.roomTime}>
                {formatTimeOrDateIST(r.last_message_at)}
              </Text>
            </View>
            <View style={styles.roomBottom}>
              <Text style={styles.lastMsg} numberOfLines={1}>
                {r.last_message ?? "No messages yet"}
              </Text>
              {r.unread_count > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{r.unread_count}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    const u = item.user;
    return (
      <Pressable
        style={({ pressed }) => [
          styles.roomItem,
          pressed && styles.itemPressed,
        ]}
        onPress={() => startDM(u)}
      >
        <Avatar name={u.name} />
        <View style={styles.roomInfo}>
          <Text style={styles.roomName}>{u.name}</Text>
          <Text style={styles.lastMsg}>@{u.username}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header — primary to match app */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => navigation.navigate("NewChat")}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search + list */}
      <View style={styles.content}>
        {/* Search */}
        <View style={styles.searchWrap}>
          <SearchInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
          />
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <SectionList
            sections={sections as any}
            keyExtractor={(item: any) =>
              item.type === "room"
                ? `room-${item.room.id}`
                : `user-${item.user.id}`
            }
            renderSectionHeader={({ section }) =>
              sections.length > 1 ? (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    {(section as any).title}
                  </Text>
                </View>
              ) : null
            }
            renderItem={renderItem as any}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load();
                }}
                tintColor={Colors.primary}
              />
            }
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              query.trim() ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>No results for "{query}"</Text>
                </View>
              ) : (
                <View style={styles.empty}>
                  <Ionicons
                    name="chatbubbles-outline"
                    size={56}
                    color={Colors.textMuted}
                  />
                  <Text style={styles.emptyTitle}>No conversations yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Tap + to start a chat
                  </Text>
                </View>
              )
            }
            stickySectionHeadersEnabled={false}
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
  },
  headerTitle: { fontSize: FontSize.xl, fontWeight: "800", color: "#fff" },
  newBtn: { padding: 4 },
  content: { flex: 1, backgroundColor: Colors.background },

  searchWrap: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },

  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  sectionHeader: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    backgroundColor: Colors.background,
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: "700",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  roomItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: Spacing.md,
    backgroundColor: Colors.surface,
  },
  avatar: {
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "#fff", fontWeight: "700" },
  roomInfo: { flex: 1 },
  roomTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  roomName: {
    fontSize: FontSize.md,
    fontWeight: "700",
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  roomTime: { fontSize: FontSize.xs, color: Colors.textMuted },
  roomBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lastMsg: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  unreadText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  itemPressed: { backgroundColor: Colors.primary + "12" },
  separator: { height: 1, backgroundColor: Colors.borderLight, marginLeft: 76 },

  empty: { alignItems: "center", paddingTop: 70, gap: 10 },
  emptyTitle: {
    fontSize: FontSize.md,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  emptySubtitle: { fontSize: FontSize.sm, color: Colors.textMuted },
  emptyText: { fontSize: FontSize.sm, color: Colors.textMuted },
});
