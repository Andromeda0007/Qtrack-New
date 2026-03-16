import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { LoadingScreen } from '../components/common/LoadingScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { ChangePasswordScreen } from '../screens/auth/ChangePasswordScreen';
import { MainNavigator } from './MainNavigator';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { CreateCardScreen } from '../screens/warehouse/CreateCardScreen';
import { ChatRoomScreen } from '../screens/chat/ChatRoomScreen';
import { ChatContactDetailScreen } from '../screens/chat/ChatContactDetailScreen';
import { ChatGroupInfoScreen } from '../screens/chat/ChatGroupInfoScreen';
import { NewChatScreen } from '../screens/chat/NewChatScreen';
import { NewGroupScreen } from '../screens/chat/NewGroupScreen';
import { BatchDetailScreen } from '../screens/warehouse/BatchDetailScreen';
import { QCScanScreen } from '../screens/scanner/QRScannerScreen';
import { QuarantineListScreen } from '../screens/inventory/QuarantineListScreen';
import { UnderTestListScreen } from '../screens/inventory/UnderTestListScreen';
import { ApprovedListScreen } from '../screens/inventory/ApprovedListScreen';
import { RejectedListScreen } from '../screens/inventory/RejectedListScreen';
import { RetestListScreen } from '../screens/inventory/RetestListScreen';

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
              name="Profile"
              component={ProfileScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CreateCard"
              component={CreateCardScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="BatchDetail"
              component={BatchDetailScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Scanner"
              component={QCScanScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="QuarantineList" component={QuarantineListScreen} options={{ headerShown: false }} />
            <Stack.Screen name="UnderTestList"  component={UnderTestListScreen}  options={{ headerShown: false }} />
            <Stack.Screen name="ApprovedList"   component={ApprovedListScreen}   options={{ headerShown: false }} />
            <Stack.Screen name="RejectedList"   component={RejectedListScreen}   options={{ headerShown: false }} />
            <Stack.Screen name="RetestList"     component={RetestListScreen}     options={{ headerShown: false }} />
            <Stack.Screen name="ChatRoom"  component={ChatRoomScreen}  options={{ headerShown: false }} />
            <Stack.Screen name="ChatContactDetail" component={ChatContactDetailScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ChatGroupInfo" component={ChatGroupInfoScreen} options={{ headerShown: false }} />
            <Stack.Screen name="NewChat"   component={NewChatScreen}   options={{ headerShown: false }} />
            <Stack.Screen name="NewGroup"  component={NewGroupScreen}  options={{ headerShown: false }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
