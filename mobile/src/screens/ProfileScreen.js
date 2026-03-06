import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
  StatusBar,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../store/authSlice";
import { COLORS, ROLE_COLORS, ROLES } from "../config/constants";
import { Ionicons } from "@expo/vector-icons";

const ProfileScreen = () => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => {
          dispatch(logout());
        },
      },
    ]);
  };

  const getRoleBadgeColor = (role) => {
    return ROLE_COLORS[role] || COLORS.gray;
  };

  const InfoItem = ({ icon, label, value }) => (
    <View style={styles.infoItem}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={20} color={COLORS.primary} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: getRoleBadgeColor(user?.role) }]}>
            <Text style={styles.avatarText}>
              {user?.fullName?.charAt(0) || user?.username?.charAt(0) || "U"}
            </Text>
          </View>
          <View
            style={[
              styles.roleBadge,
              { backgroundColor: getRoleBadgeColor(user?.role) },
            ]}
          >
            <Text style={styles.roleBadgeText}>{user?.role}</Text>
          </View>
        </View>

        <Text style={styles.name}>{user?.fullName || user?.username}</Text>
        <Text style={styles.username}>@{user?.username}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Information</Text>
        <View style={styles.card}>
          <InfoItem icon="mail-outline" label="Email" value={user?.email} />
          <View style={styles.divider} />
          <InfoItem
            icon="person-outline"
            label="Username"
            value={user?.username}
          />
          <View style={styles.divider} />
          <InfoItem
            icon="shield-checkmark-outline"
            label="Role"
            value={user?.role}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Application</Text>
        <View style={styles.card}>
          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="code-outline" size={24} color={COLORS.primary} />
              <Text style={styles.menuItemText}>Version</Text>
            </View>
            <Text style={styles.versionText}>1.0.0</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={COLORS.white} />
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>
        QTrack - Warehouse & Material Tracking
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.light,
  },
  header: {
    backgroundColor: COLORS.primary,
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 15,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.3)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: "bold",
    color: COLORS.white,
  },
  roleBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: COLORS.white,
  },
  roleBadgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "bold",
  },
  name: {
    fontSize: 26,
    fontWeight: "bold",
    color: COLORS.white,
    marginBottom: 3,
  },
  username: {
    fontSize: 16,
    color: COLORS.white,
    opacity: 0.9,
    fontWeight: "500",
    marginBottom: -1,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.dark,
    marginBottom: 12,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + "15",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: COLORS.dark,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.light,
    marginVertical: 3,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuItemText: {
    fontSize: 16,
    color: COLORS.dark,
    marginLeft: 15,
    fontWeight: "500",
  },
  versionText: {
    fontSize: 14,
    color: COLORS.gray,
    fontWeight: "500",
  },
  logoutButton: {
    flexDirection: "row",
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    padding: 17,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 20,
    marginTop: 30,
    marginBottom: 15,
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 10,
    marginBottom: 20,
  },
});

export default ProfileScreen;

