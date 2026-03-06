import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";

// Screens
import DashboardScreen from "../screens/DashboardScreen";
import ScanScreen from "../screens/ScanScreen";
import MaterialDetailScreen from "../screens/MaterialDetailScreen";
import CreateMaterialScreen from "../screens/CreateMaterialScreen";
import InventoryScreen from "../screens/InventoryScreen";
import ProfileScreen from "../screens/ProfileScreen";
import AdminApprovalScreen from "../screens/AdminApprovalScreen";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Main Stack Navigator
const MainStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Scan"
        component={ScanScreen}
        options={{ title: "Scan QR Code" }}
      />
      <Stack.Screen
        name="MaterialDetail"
        component={MaterialDetailScreen}
        options={{ title: "Material Details" }}
      />
      <Stack.Screen
        name="CreateMaterial"
        component={CreateMaterialScreen}
        options={{ title: "Create Material" }}
      />
      <Stack.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{ title: "Inventory" }}
      />
      <Stack.Screen
        name="AdminApprovals"
        component={AdminApprovalScreen}
        options={{ title: "User Approvals" }}
      />
    </Stack.Navigator>
  );
};

// Tab Navigator
const AppNavigator = () => {
  const user = useSelector((state) => state.auth.user);
  const isOperator = user?.role === "Operator";
  const isAdmin = user?.role === "Admin";

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === "Home") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "Scan") {
            iconName = focused ? "qr-code" : "qr-code-outline";
          } else if (route.name === "Inventory") {
            iconName = focused ? "cube" : "cube-outline";
          } else if (route.name === "Approvals") {
            iconName = focused ? "checkmark-circle" : "checkmark-circle-outline";
          } else if (route.name === "Profile") {
            iconName = focused ? "person" : "person-outline";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "#8E8E93",
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={MainStack} />
      <Tab.Screen name="Scan" component={ScanScreen} />
      <Tab.Screen name="Inventory" component={InventoryScreen} />
      {isAdmin && (
        <Tab.Screen name="Approvals" component={AdminApprovalScreen} />
      )}
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

export default AppNavigator;
