import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api from "../config/api";
import { API_ENDPOINTS, COLORS, ROLE_COLORS } from "../config/constants";

export default function AdminApprovalScreen() {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingUserId, setProcessingUserId] = useState(null);

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const fetchPendingUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get(API_ENDPOINTS.USERS.PENDING);
      setPendingUsers(response.data.pendingUsers || []);
    } catch (error) {
      console.error("Fetch pending users error:", error);
      Alert.alert(
        "Error",
        error.response?.data?.error || "Failed to fetch pending users"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleApprove = async (userId, username) => {
    Alert.alert(
      "Approve User",
      `Approve ${username}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: async () => {
            try {
              setProcessingUserId(userId);
              await api.post(`${API_ENDPOINTS.USERS.APPROVE}/${userId}/approve`);
              Alert.alert("Success", `${username} has been approved`);
              fetchPendingUsers();
            } catch (error) {
              console.error("Approve error:", error);
              Alert.alert(
                "Error",
                error.response?.data?.error || "Failed to approve user"
              );
            } finally {
              setProcessingUserId(null);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleReject = async (userId, username) => {
    Alert.alert(
      "Reject User",
      `Reject ${username}? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            try {
              setProcessingUserId(userId);
              await api.post(`${API_ENDPOINTS.USERS.REJECT}/${userId}/reject`);
              Alert.alert("Success", `${username} has been rejected`);
              fetchPendingUsers();
            } catch (error) {
              console.error("Reject error:", error);
              Alert.alert(
                "Error",
                error.response?.data?.error || "Failed to reject user"
              );
            } finally {
              setProcessingUserId(null);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const getRoleColor = (roleName) => {
    return ROLE_COLORS[roleName] || COLORS.gray;
  };

  const renderUserItem = ({ item }) => {
    const isProcessing = processingUserId === item.user_id;
    const roleColor = getRoleColor(item.role_name);

    return (
      <View style={styles.userCard}>
        <View style={styles.cardHeader}>
          <View style={[styles.avatar, { backgroundColor: roleColor }]}>
            <Text style={styles.avatarText}>
              {item.full_name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userMainInfo}>
            <Text style={styles.userName}>{item.full_name}</Text>
            <Text style={styles.userUsername}>@{item.username}</Text>
            <View style={[styles.roleTag, { backgroundColor: roleColor + "20" }]}>
              <Text style={[styles.roleTagText, { color: roleColor }]}>
                {item.role_name}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.userDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="mail-outline" size={16} color={COLORS.gray} style={styles.detailIcon} />
            <Text style={styles.detailText}>{item.email}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={16} color={COLORS.gray} style={styles.detailIcon} />
            <Text style={styles.detailText}>
              Registered {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.approveButton, isProcessing && styles.buttonDisabled]}
            onPress={() => handleApprove(item.user_id, item.username)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color={COLORS.white} style={styles.actionIcon} />
                <Text style={styles.approveButtonText}>Approve</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.rejectButton, isProcessing && styles.buttonDisabled]}
            onPress={() => handleReject(item.user_id, item.username)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="close" size={20} color={COLORS.white} style={styles.actionIcon} />
                <Text style={styles.rejectButtonText}>Reject</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading pending approvals...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>User Approvals</Text>
          {pendingUsers.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingUsers.length}</Text>
            </View>
          )}
        </View>
        <Text style={styles.headerSubtitle}>
          {pendingUsers.length > 0
            ? `${pendingUsers.length} pending approval${
                pendingUsers.length > 1 ? "s" : ""
              }`
            : "All registrations processed"}
        </Text>
      </View>

      {pendingUsers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No pending approvals</Text>
          <Text style={styles.emptySubtext}>
            All user registrations have been processed
          </Text>
        </View>
      ) : (
        <FlatList
          data={pendingUsers}
          renderItem={renderUserItem}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchPendingUsers();
              }}
              colors={[COLORS.primary]}
            />
          }
        />
      )}
    </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.light,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.light,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: COLORS.gray,
  },
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.dark,
  },
  badge: {
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "bold",
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 5,
  },
  listContent: {
    padding: 15,
  },
  userCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.white,
  },
  userMainInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.dark,
    marginBottom: 2,
  },
  userUsername: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 8,
  },
  roleTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleTagText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  userDetails: {
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  detailIcon: {
    marginRight: 10,
  },
  detailText: {
    fontSize: 14,
    color: COLORS.dark,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  approveButton: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: COLORS.success,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  actionIcon: {
    marginRight: 6,
  },
  approveButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "bold",
  },
  rejectButton: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  rejectButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "bold",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.gray,
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: "center",
  },
});
