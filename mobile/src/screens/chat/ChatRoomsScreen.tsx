import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, Alert, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { chatApi } from '../../api/chat';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Colors, FontSize, Spacing } from '../../utils/theme';
import { ChatRoom } from '../../types';
import { extractError } from '../../api/client';

const ROOM_TYPE_ICONS: Record<string, string> = {
  GLOBAL: 'globe',
  DEPARTMENT: 'people',
  PRIVATE: 'lock-closed',
};

export const ChatRoomsScreen: React.FC = () => {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [creating, setCreating] = useState(false);
  const navigation = useNavigation<any>();

  const loadRooms = useCallback(async () => {
    try {
      const data = await chatApi.getRooms();
      setRooms(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadRooms(); }, []);

  const handleCreateRoom = async () => {
    if (!roomName.trim()) { Alert.alert('Error', 'Room name is required'); return; }
    setCreating(true);
    try {
      await chatApi.createRoom(roomName.trim(), 'DEPARTMENT');
      setRoomName('');
      setShowCreate(false);
      loadRooms();
    } catch (error) {
      Alert.alert('Error', extractError(error));
    } finally {
      setCreating(false);
    }
  };

  const renderRoom = ({ item }: { item: ChatRoom }) => (
    <TouchableOpacity onPress={() => navigation.navigate('ChatRoom', { roomId: item.id, roomName: item.name })} activeOpacity={0.8}>
      <Card>
        <View style={styles.roomRow}>
          <View style={[styles.roomIcon, { backgroundColor: item.room_type === 'GLOBAL' ? Colors.primaryLight + '20' : Colors.accent + '20' }]}>
            <Ionicons name={ROOM_TYPE_ICONS[item.room_type] as any} size={22} color={item.room_type === 'GLOBAL' ? Colors.primary : Colors.accent} />
          </View>
          <View style={styles.roomInfo}>
            <Text style={styles.roomName}>{item.name}</Text>
            <Text style={styles.roomType}>{item.room_type.charAt(0) + item.room_type.slice(1).toLowerCase()}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Chat</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)} style={styles.addBtn}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={rooms}
        keyExtractor={(r) => r.id.toString()}
        renderItem={renderRoom}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRooms(); }} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No chat rooms yet</Text>
            <Button title="Create a Room" onPress={() => setShowCreate(true)} variant="outline" />
          </View>
        }
      />

      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Create Chat Room</Text>
            <Input label="Room Name" placeholder="e.g. QC Team, Warehouse" value={roomName} onChangeText={setRoomName} />
            <View style={styles.modalActions}>
              <Button title="Cancel" onPress={() => setShowCreate(false)} variant="outline" style={{ flex: 1 }} />
              <Button title="Create" onPress={handleCreateRoom} loading={creating} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, backgroundColor: Colors.primary },
  title: { fontSize: FontSize.xl, fontWeight: '800', color: '#fff' },
  addBtn: { padding: 8 },
  list: { padding: Spacing.md },
  roomRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  roomIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  roomInfo: { flex: 1 },
  roomName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
  roomType: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: Spacing.xxl, gap: Spacing.md },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md },
  modalActions: { flexDirection: 'row', gap: Spacing.sm },
});
