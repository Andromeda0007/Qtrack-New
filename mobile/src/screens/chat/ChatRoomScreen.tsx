import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Pressable,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { chatApi, createChatWebSocket } from "../../api/chat";
import { useAuthStore } from "../../store/authStore";
import { Colors, FontSize, Spacing } from "../../utils/theme";
import { formatTimeIST } from "../../utils/formatters";
import { ChatMessage } from "../../types";

export const ChatRoomScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const {
    roomId: initialRoomId,
    userId,
    roomName,
    otherUserId: otherUserIdParam,
    isGroup,
  } = route.params;
  const otherUserId = otherUserIdParam ?? userId ?? null;
  const { user, token } = useAuthStore();

  const [roomId, setRoomId] = useState<number | null>(initialRoomId ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(!!initialRoomId);
  const [connected, setConnected] = useState(false);
  const [sending, setSending] = useState(false);

  // Action sheet
  const [selectedMsg, setSelectedMsg] = useState<ChatMessage | null>(null);

  // Inline edit — tracked outside FlatList via separate state map
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const flatListRef = useRef<FlatList>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const insets = useSafeAreaInsets();

  const connectWS = useCallback(
    (rid: number) => {
      if (!token || wsRef.current) return;
      const ws = createChatWebSocket(token);
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => setConnected(false);
      ws.onerror = () => setConnected(false);
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.room_id !== rid) return;

          if (payload.type === "message") {
            setMessages((prev) => [...prev, payload as ChatMessage]);
            setTimeout(
              () => flatListRef.current?.scrollToEnd({ animated: true }),
              80,
            );
            // Auto mark as read — user is looking at this room right now.
            chatApi.markRoomRead(rid).catch(() => {});
          } else if (payload.type === "edit") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === payload.message_id
                  ? { ...m, content: payload.content }
                  : m,
              ),
            );
          } else if (payload.type === "delete") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === payload.message_id
                  ? {
                      ...m,
                      is_deleted: true,
                      content: "This message was deleted",
                    }
                  : m,
              ),
            );
          }
        } catch {}
      };
    },
    [token],
  );

  useEffect(() => {
    if (initialRoomId) {
      chatApi
        .getMessages(initialRoomId)
        .then(setMessages)
        .catch(() => {})
        .finally(() => setLoading(false));
      connectWS(initialRoomId);
      // Mark everything in this room as read on open.
      chatApi.markRoomRead(initialRoomId).catch(() => {});
    }
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [initialRoomId]);

  const sendMessage = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText("");
    try {
      let rid = roomId;
      if (!rid) {
        const res = await chatApi.startDM(userId);
        rid = res.room_id;
        setRoomId(rid);
        connectWS(rid);
        await new Promise((r) => setTimeout(r, 400));
      }
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ room_id: rid, content }));
      }
    } catch {
      setText(content);
    } finally {
      setSending(false);
    }
  };

  const handleLongPress = (msg: ChatMessage) => {
    if (msg.sender_id !== user?.id || msg.is_deleted) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedMsg(msg);
  };

  const handleEdit = () => {
    if (!selectedMsg) return;
    setEditText(selectedMsg.content);
    setEditingId(selectedMsg.id);
    setSelectedMsg(null);
  };

  const handleDeleteForMe = () => {
    if (!selectedMsg) return;
    setMessages((prev) => prev.filter((m) => m.id !== selectedMsg.id));
    setSelectedMsg(null);
  };

  const handleDeleteForAll = async () => {
    if (!selectedMsg) return;
    const id = selectedMsg.id;
    setSelectedMsg(null);
    // Optimistic
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, is_deleted: true, content: "This message was deleted" }
          : m,
      ),
    );
    try {
      await chatApi.deleteMessageForAll(id);
    } catch {}
  };

  const submitEdit = async () => {
    const content = editText.trim();
    const id = editingId;
    if (!id || !content) return;
    // Close edit mode first
    setEditingId(null);
    setEditText("");
    // Optimistic update
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content } : m)),
    );
    try {
      await chatApi.editMessage(id, content);
    } catch {
      // On failure, keep optimistic — could revert if needed
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const renderMessage = ({
    item,
    index,
  }: {
    item: ChatMessage;
    index: number;
  }) => {
    const isMe = item.sender_id === user?.id;
    const prevItem = messages[index - 1];
    const showSender =
      !isMe && (!prevItem || prevItem.sender_id !== item.sender_id);
    const isDeleted = item.is_deleted;
    const isEditing = editingId === item.id;

    return (
      <View
        style={[
          styles.bubbleWrap,
          isMe ? styles.bubbleWrapMe : styles.bubbleWrapThem,
        ]}
      >
        {showSender && (
          <Text style={styles.senderName}>{item.sender_name}</Text>
        )}

        {isEditing ? (
          /* Edit mode: render outside bubble, full width */
          <View style={styles.editContainer}>
            <TextInput
              style={styles.editInput}
              value={editText}
              onChangeText={setEditText}
              autoFocus
              multiline
              maxLength={1000}
              blurOnSubmit={false}
              onSubmitEditing={submitEdit}
            />
            <View style={styles.editActions}>
              <TouchableOpacity
                onPress={cancelEdit}
                style={styles.editActionBtn}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={22}
                  color={Colors.danger}
                />
                <Text style={[styles.editActionText, { color: Colors.danger }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitEdit}
                style={styles.editActionBtn}
                disabled={!editText.trim()}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={22}
                  color={Colors.success}
                />
                <Text
                  style={[styles.editActionText, { color: Colors.success }]}
                >
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            onLongPress={() => handleLongPress(item)}
            delayLongPress={350}
            activeOpacity={0.85}
          >
            <View
              style={[
                styles.bubble,
                isMe ? styles.bubbleMe : styles.bubbleThem,
                isDeleted && styles.bubbleDeleted,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  isMe && !isDeleted && styles.bubbleTextMe,
                  isDeleted && styles.deletedText,
                ]}
              >
                {isDeleted ? "This message was deleted" : item.content}
              </Text>
              <Text
                style={[
                  styles.bubbleTime,
                  isMe && !isDeleted && styles.bubbleTimeMe,
                ]}
              >
                {formatTimeIST(item.created_at)}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const bottomPadding = Math.round(insets.bottom * 0.8);

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      {/* Header — primary, extends into status bar */}
      <View style={[styles.headerWrap, { paddingTop: insets.top || 12 }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerInfo}
            onPress={() => {
              if (otherUserId) {
                navigation.navigate("ChatContactDetail", {
                  userId: otherUserId,
                  displayName: roomName,
                });
              } else if (isGroup && (roomId ?? initialRoomId)) {
                navigation.navigate("ChatGroupInfo", {
                  roomId: roomId ?? initialRoomId!,
                  roomName: roomName ?? undefined,
                });
              }
            }}
            disabled={!otherUserId && !(isGroup && (roomId ?? initialRoomId))}
            activeOpacity={0.7}
          >
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>
                {(roomName || "?")[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.headerNameWrap}>
              <Text style={styles.headerName} numberOfLines={1}>
                {roomName}
              </Text>
              {otherUserId ? (
                <Text style={styles.headerHint} numberOfLines={1}>
                  Tap for contact info
                </Text>
              ) : isGroup ? (
                <Text style={styles.headerHint} numberOfLines={1}>
                  Tap here for group info
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.chatContent}>
        {/* Messages */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(m) => m.id.toString()}
            renderItem={renderMessage}
            extraData={editingId}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={48}
                  color={Colors.textMuted}
                />
                <Text style={styles.emptyChatText}>
                  No messages yet. Say hello!
                </Text>
              </View>
            }
          />
        )}

        {/* Input — bottom padding 80% of safe area (20% reduction) */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View
            style={[
              styles.inputBar,
              { paddingBottom: Spacing.sm + bottomPadding },
            ]}
          >
            <TextInput
              style={styles.input}
              placeholder="Message..."
              placeholderTextColor={Colors.textMuted}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              onPress={sendMessage}
              disabled={!text.trim() || sending}
              style={[
                styles.sendBtn,
                (!text.trim() || sending) && styles.sendDisabled,
              ]}
              activeOpacity={0.8}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>

      {/* Action Sheet Modal */}
      <Modal
        visible={!!selectedMsg}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedMsg(null)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setSelectedMsg(null)}
        >
          <Pressable style={styles.sheet}>
            {/* Preview */}
            <View style={styles.sheetPreviewWrap}>
              <Text style={styles.sheetPreviewLabel}>Message</Text>
              <Text style={styles.sheetMsgPreview} numberOfLines={3}>
                {selectedMsg?.content}
              </Text>
            </View>

            <View style={styles.sheetDivider} />

            <TouchableOpacity style={styles.sheetOption} onPress={handleEdit}>
              <View
                style={[
                  styles.sheetIconWrap,
                  { backgroundColor: Colors.primary + "18" },
                ]}
              >
                <Ionicons
                  name="pencil-outline"
                  size={19}
                  color={Colors.primary}
                />
              </View>
              <Text style={styles.sheetOptionText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetOption}
              onPress={handleDeleteForMe}
            >
              <View
                style={[styles.sheetIconWrap, { backgroundColor: "#6b728018" }]}
              >
                <Ionicons
                  name="eye-off-outline"
                  size={19}
                  color={Colors.textSecondary}
                />
              </View>
              <Text style={styles.sheetOptionText}>Delete for me</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetOption}
              onPress={handleDeleteForAll}
            >
              <View
                style={[
                  styles.sheetIconWrap,
                  { backgroundColor: Colors.danger + "18" },
                ]}
              >
                <Ionicons
                  name="trash-outline"
                  size={19}
                  color={Colors.danger}
                />
              </View>
              <Text style={[styles.sheetOptionText, { color: Colors.danger }]}>
                Delete for everyone
              </Text>
            </TouchableOpacity>

            <View style={styles.sheetDivider} />

            <TouchableOpacity
              style={[styles.sheetOption, styles.cancelOption]}
              onPress={() => setSelectedMsg(null)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },

  headerWrap: { backgroundColor: Colors.primary },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  headerInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerNameWrap: { flex: 1, justifyContent: "center", minWidth: 0 },
  headerName: { fontSize: FontSize.md, fontWeight: "700", color: "#fff" },
  headerHint: { fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  headerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerAvatarText: { fontSize: 18, fontWeight: "700", color: "#fff" },

  chatContent: { flex: 1, backgroundColor: Colors.background },

  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  messageList: { padding: Spacing.md, paddingBottom: 8 },

  bubbleWrap: { marginBottom: 6, maxWidth: "78%" },
  bubbleWrapMe: { alignSelf: "flex-end", alignItems: "flex-end" },
  bubbleWrapThem: { alignSelf: "flex-start", alignItems: "flex-start" },

  senderName: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primary,
    marginBottom: 3,
    marginLeft: 4,
  },

  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  bubbleMe: { backgroundColor: Colors.primary, borderBottomRightRadius: 5 },
  bubbleThem: { backgroundColor: "#fff", borderBottomLeftRadius: 5 },
  bubbleDeleted: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },

  bubbleText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  bubbleTextMe: { color: "#fff" },
  deletedText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontStyle: "italic",
  },
  bubbleTime: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  bubbleTimeMe: { color: "rgba(255,255,255,0.65)" },

  // Inline edit (outside the bubble, full-width)
  editContainer: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    minWidth: 220,
    maxWidth: 300,
    shadowColor: Colors.primary,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  editInput: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    lineHeight: 20,
    maxHeight: 120,
    paddingVertical: 4,
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.md,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 8,
  },
  editActionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  editActionText: { fontSize: 13, fontWeight: "600" },

  emptyChat: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyChatText: { fontSize: FontSize.sm, color: Colors.textMuted },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    backgroundColor: Colors.background,
    borderRadius: 21,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  sendDisabled: { opacity: 0.4 },

  // Action sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: 36,
    overflow: "hidden",
  },
  sheetPreviewWrap: { paddingHorizontal: Spacing.lg, paddingVertical: 14 },
  sheetPreviewLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textMuted,
    textTransform: "uppercase",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  sheetMsgPreview: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontStyle: "italic",
  },
  sheetDivider: { height: 1, backgroundColor: Colors.borderLight },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 15,
  },
  sheetIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetOptionText: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    fontWeight: "500",
  },
  cancelOption: { justifyContent: "center" },
  cancelText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    fontWeight: "600",
    textAlign: "center",
    flex: 1,
  },
});
