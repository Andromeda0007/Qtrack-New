import React, { useEffect } from 'react';
import { TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { LoadingScreen } from '../components/common/LoadingScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { ChangePasswordScreen } from '../screens/auth/ChangePasswordScreen';
import { MainNavigator } from './MainNavigator';
import { ChatRoomScreen } from '../screens/chat/ChatRoomScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { CreateGRNScreen } from '../screens/warehouse/CreateGRNScreen';
import { Colors } from '../utils/theme';

const Stack = createNativeStackNavigator();

export const AppNavigator: React.FC = () => {
  const { isAuthenticated, isLoading, user, loadFromStorage } = useAuthStore();

  useEffect(() => {
    loadFromStorage();
  }, []);

  if (isLoading) return <LoadingScreen message="Starting QTrack..." />;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, headerBackTitleVisible: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : user?.is_first_login ? (
          <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainNavigator} />
            <Stack.Screen
              name="ChatRoom"
              component={ChatRoomScreen}
              options={({ navigation: nav }) => ({
                headerShown: true,
                headerBackTitleVisible: false,
                headerStyle: { backgroundColor: Colors.primary },
                headerTintColor: '#fff',
                headerTitleStyle: { fontWeight: '700', color: '#fff' },
                headerLeft: () => (
                  <TouchableOpacity
                    onPress={() => nav.goBack()}
                    style={{ paddingLeft: 0, paddingRight: 8, paddingVertical: 8 }}
                  >
                    <Ionicons name="chevron-back" size={22} color="#fff" />
                  </TouchableOpacity>
                ),
              })}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CreateGRN"
              component={CreateGRNScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
