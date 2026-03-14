import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../utils/theme';
import { RoleName } from '../types';

import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { BatchListScreen } from '../screens/inventory/BatchListScreen';
import { QCScanScreen } from '../screens/scanner/QRScannerScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { ChatRoomsScreen } from '../screens/chat/ChatRoomsScreen';
import { AdminScreen } from '../screens/admin/AdminScreen';
const Tab = createBottomTabNavigator();

const ROLE_TABS: Record<RoleName, Array<{ name: string; component: any; icon: string; label: string }>> = {
  WAREHOUSE_HEAD: [
    { name: 'Dashboard',     component: DashboardScreen,     icon: 'home',          label: 'Home' },
    { name: 'Admin',         component: AdminScreen,         icon: 'shield',        label: 'Admin' },
    { name: 'Notifications', component: NotificationsScreen, icon: 'notifications', label: 'Notifications' },
    { name: 'Chat',          component: ChatRoomsScreen,     icon: 'chatbubbles',   label: 'Chat' },
  ],
  WAREHOUSE_USER: [
    { name: 'Dashboard',     component: DashboardScreen,     icon: 'home',          label: 'Home' },
    { name: 'Scanner',       component: QCScanScreen,        icon: 'scan',          label: 'Scan' },
    { name: 'Batches',       component: BatchListScreen,     icon: 'cube',          label: 'Stock' },
    { name: 'Notifications', component: NotificationsScreen, icon: 'notifications', label: 'Notifications' },
    { name: 'Chat',          component: ChatRoomsScreen,     icon: 'chatbubbles',   label: 'Chat' },
  ],
  QC_EXECUTIVE: [
    { name: 'Dashboard',     component: DashboardScreen,     icon: 'home',          label: 'Home' },
    { name: 'Scanner',       component: QCScanScreen,        icon: 'scan',          label: 'Scan' },
    { name: 'Batches',       component: BatchListScreen,     icon: 'flask',         label: 'Batches' },
    { name: 'Notifications', component: NotificationsScreen, icon: 'notifications', label: 'Notifications' },
    { name: 'Chat',          component: ChatRoomsScreen,     icon: 'chatbubbles',   label: 'Chat' },
  ],
  QC_HEAD: [
    { name: 'Dashboard',     component: DashboardScreen,     icon: 'home',          label: 'Home' },
    { name: 'Scanner',       component: QCScanScreen,        icon: 'scan',          label: 'Scan' },
    { name: 'Batches',       component: BatchListScreen,     icon: 'flask',         label: 'Batches' },
    { name: 'Notifications', component: NotificationsScreen, icon: 'notifications', label: 'Notifications' },
    { name: 'Chat',          component: ChatRoomsScreen,     icon: 'chatbubbles',   label: 'Chat' },
  ],
  QA_EXECUTIVE: [
    { name: 'Dashboard',     component: DashboardScreen,     icon: 'home',          label: 'Home' },
    { name: 'Scanner',       component: QCScanScreen,        icon: 'scan',          label: 'Scan' },
    { name: 'Notifications', component: NotificationsScreen, icon: 'notifications', label: 'Notifications' },
    { name: 'Chat',          component: ChatRoomsScreen,     icon: 'chatbubbles',   label: 'Chat' },
  ],
  QA_HEAD: [
    { name: 'Dashboard',     component: DashboardScreen,     icon: 'home',          label: 'Home' },
    { name: 'Scanner',       component: QCScanScreen,        icon: 'scan',          label: 'Scan' },
    { name: 'Notifications', component: NotificationsScreen, icon: 'notifications', label: 'Notifications' },
    { name: 'Chat',          component: ChatRoomsScreen,     icon: 'chatbubbles',   label: 'Chat' },
  ],
  PRODUCTION_USER: [
    { name: 'Dashboard',     component: DashboardScreen,     icon: 'home',          label: 'Home' },
    { name: 'Scanner',       component: QCScanScreen,        icon: 'scan',          label: 'Scan' },
    { name: 'Notifications', component: NotificationsScreen, icon: 'notifications', label: 'Notifications' },
    { name: 'Chat',          component: ChatRoomsScreen,     icon: 'chatbubbles',   label: 'Chat' },
  ],
  PURCHASE_USER: [
    { name: 'Dashboard',     component: DashboardScreen,     icon: 'home',          label: 'Home' },
    { name: 'Batches',       component: BatchListScreen,     icon: 'cube',          label: 'Stock' },
    { name: 'Notifications', component: NotificationsScreen, icon: 'notifications', label: 'Notifications' },
    { name: 'Chat',          component: ChatRoomsScreen,     icon: 'chatbubbles',   label: 'Chat' },
  ],
};

export const MainNavigator: React.FC = () => {
  const { user } = useAuthStore();
  const role = (user?.role || 'PURCHASE_USER') as RoleName;
  const tabs = ROLE_TABS[role] || ROLE_TABS.PURCHASE_USER;

  const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 58 : 54;
  const BOTTOM_PADDING = Platform.OS === 'ios' ? 24 : 10;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.borderLight,
          borderTopWidth: 1,
          height: TAB_BAR_HEIGHT + BOTTOM_PADDING,
          paddingTop: 8,
          paddingBottom: BOTTOM_PADDING,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
        tabBarIcon: ({ focused, color }) => {
          const tab = tabs.find((t) => t.name === route.name);
          const iconName = tab
            ? (focused ? tab.icon : `${tab.icon}-outline`)
            : 'home-outline';
          return <Ionicons name={iconName as any} size={22} color={color} />;
        },
      })}
    >
      {tabs.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{ tabBarLabel: tab.label }}
        />
      ))}
    </Tab.Navigator>
  );
};
