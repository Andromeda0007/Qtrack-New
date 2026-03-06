import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, ROLES, ROLE_COLORS } from "../config/constants";

const DashboardScreen = () => {
  const navigation = useNavigation();
  const user = useSelector((state) => state.auth.user);
  const isOperator = user?.role === ROLES.OPERATOR;
  const isAdmin = user?.role === ROLES.ADMIN;

  const getRoleBadgeColor = (role) => {
    return ROLE_COLORS[role] || COLORS.gray;
  };

  return (
    <ScrollView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <View style={styles.header}>
        <Text style={styles.appBranding}>QTrack</Text>
        <View style={styles.headerTop}>
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.fullName || user?.username}</Text>
          </View>
          <View style={[styles.rolePill, { backgroundColor: getRoleBadgeColor(user?.role) }]}>
            <Text style={styles.rolePillText}>{user?.role}</Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate("Scan")}
        >
          <View style={[styles.iconContainer, { backgroundColor: COLORS.primary + "20" }]}>
            <Ionicons name="qr-code-outline" size={40} color={COLORS.primary} />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionText}>Scan QR Code</Text>
            <Text style={styles.actionSubtext}>Scan material QR codes</Text>
          </View>
        </TouchableOpacity>

        {(isOperator || isAdmin) && (
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate("CreateMaterial")}
          >
            <View style={[styles.iconContainer, { backgroundColor: COLORS.success + "20" }]}>
              <Ionicons name="add-circle-outline" size={40} color={COLORS.success} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionText}>Create Material</Text>
              <Text style={styles.actionSubtext}>Add new material entry</Text>
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate("Inventory")}
        >
          <View style={[styles.iconContainer, { backgroundColor: COLORS.info + "20" }]}>
            <Ionicons name="cube-outline" size={40} color={COLORS.info} />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionText}>Inventory</Text>
            <Text style={styles.actionSubtext}>View inventory details</Text>
          </View>
        </TouchableOpacity>

        {isAdmin && (
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate("AdminApprovals")}
          >
            <View style={[styles.iconContainer, { backgroundColor: COLORS.warning + "20" }]}>
              <Ionicons name="checkmark-circle-outline" size={40} color={COLORS.warning} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionText}>User Approvals</Text>
              <Text style={styles.actionSubtext}>Approve/reject registrations</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
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
    padding: 30,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  appBranding: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: "500",
    letterSpacing: 0.8,
    marginBottom: 18,
    opacity: 0.85,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  welcomeContainer: {
    flex: 1,
    marginRight: 15,
  },
  welcomeText: {
    fontSize: 16,
    color: COLORS.white,
    opacity: 0.9,
    marginBottom: 5,
  },
  userName: {
    fontSize: 26,
    fontWeight: "bold",
    color: COLORS.white,
  },
  rolePill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  rolePillText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  actions: {
    padding: 20,
    marginTop: 10,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  actionContent: {
    flex: 1,
  },
  actionText: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.dark,
    marginBottom: 4,
  },
  actionSubtext: {
    fontSize: 14,
    color: COLORS.gray,
  },
});

export default DashboardScreen;

