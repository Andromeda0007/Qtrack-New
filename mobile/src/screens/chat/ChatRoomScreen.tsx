import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { chatApi } from '../../api/chat';
import { useAuthStore } from '../../store/authStore';
import { Colors, FontSize, Spacing } from '../../utils/theme';
import { formatDateTime } from '../../utils/formatters';
import { Message } from '../../types';
import { extractError } from '../../api/client';

export const ChatRoomScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { roomId, roomName } = route.params;
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const loadMessages = useCallback(async () => {
    try {
      const data = await chatApi.getMessages(roomId);
      setMessages(data.reverse());
    } catch {}
  }, [roomId]);

  useEffect(() => {
    navigation.setOptions({
      title: roomName,
      headerStyle: { backgroundColor: Colors.primary },
    });
    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSend = async () => {
    if (!text.trim()) return;
    const messageText = text.trim();
    setText('');
    setSending(true);
    try {
      const msg = await chatApi.sendMessage(roomId, messageText);
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      const err = extractError(error);
      if (err.includes('link')) {
        Alert.alert('Not Allowed', 'External links are not permitted in chat messages.');
      } else {
        Alert.alert('Error', err);
      }
      setText(messageText);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === user?.id;
    return (
      <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.theirBubble]}>
        {!isMe && <Text style={styles.senderName}>User #{item.sender_id}</Text>}
        {item.message_text && <Text style={[styles.messageText, isMe && styles.myText]}>{item.message_text}</Text>}
        {item.media_url && <Text style={[styles.mediaText, isMe && styles.myText]}>📎 Media attachment</Text>}
        <Text style={[styles.messageTime, isMe && styles.myTime]}>{formatDateTime(item.created_at)}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(m) => m.id.toString()}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No messages yet. Say hello!</Text>
          </View>
        }
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={Colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity onPress={handleSend} disabled={sending || !text.trim()} style={[styles.sendBtn, (!text.trim() || sending) && styles.sendDisabled]}>
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  messageList: { padding: Spacing.md, paddingBottom: Spacing.sm },
  messageBubble: { maxWidth: '80%', marginBottom: Spacing.sm, padding: 10, borderRadius: 14 },
  myBubble: { alignSelf: 'flex-end', backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  theirBubble: { alignSelf: 'flex-start', backgroundColor: '#fff', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  senderName: { fontSize: 11, fontWeight: '700', color: Colors.primary, marginBottom: 3 },
  messageText: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  myText: { color: '#fff' },
  mediaText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic' },
  messageTime: { fontSize: 10, color: Colors.textMuted, marginTop: 4, alignSelf: 'flex-end' },
  myTime: { color: 'rgba(255,255,255,0.6)' },
  empty: { flex: 1, alignItems: 'center', paddingTop: Spacing.xxl },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm,
    padding: Spacing.sm, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120,
    backgroundColor: Colors.background, borderRadius: 22,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: FontSize.sm, color: Colors.textPrimary,
    borderWidth: 1, borderColor: Colors.border,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  sendDisabled: { opacity: 0.5 },
});
