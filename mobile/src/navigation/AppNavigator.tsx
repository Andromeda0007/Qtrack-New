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
import { IssueStockScreen } from '../screens/warehouse/IssueStockScreen';
import { QCScanScreen } from '../screens/scanner/QRScannerScreen';
import { CheckStatusScreen } from '../screens/scanner/CheckStatusScreen';
import { QuarantineListScreen } from '../screens/inventory/QuarantineListScreen';
import { UnderTestListScreen } from '../screens/inventory/UnderTestListScreen';
import { ApprovedListScreen } from '../screens/inventory/ApprovedListScreen';
import { RejectedListScreen } from '../screens/inventory/RejectedListScreen';
import { RetestListScreen } from '../screens/inventory/RetestListScreen';
import { ProductionListScreen } from '../screens/inventory/ProductionListScreen';
import { AddARNumberScreen } from '../screens/qc/AddARNumberScreen';
import { ApproveBatchScreen } from '../screens/qc/ApproveBatchScreen';
import { RejectBatchScreen } from '../screens/qc/RejectBatchScreen';
import { InitiateRetestScreen } from '../screens/qc/InitiateRetestScreen';
import { InspectFGScreen } from '../screens/qa/InspectFGScreen';
import { ApproveFGScreen } from '../screens/qa/ApproveFGScreen';
import { RejectFGScreen } from '../screens/qa/RejectFGScreen';
import { ItemsListScreen } from '../screens/admin/ItemsListScreen';
import { CreateItemScreen } from '../screens/admin/CreateItemScreen';
import { EditItemScreen } from '../screens/admin/EditItemScreen';

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
              name="IssueStock"
              component={IssueStockScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Scanner"
              component={QCScanScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CheckStatus"
              component={CheckStatusScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="ProductionList" component={ProductionListScreen} options={{ headerShown: false }} />
            <Stack.Screen name="QuarantineList" component={QuarantineListScreen} options={{ headerShown: false }} />
            <Stack.Screen name="UnderTestList"  component={UnderTestListScreen}  options={{ headerShown: false }} />
            <Stack.Screen name="ApprovedList"   component={ApprovedListScreen}   options={{ headerShown: false }} />
            <Stack.Screen name="RejectedList"   component={RejectedListScreen}   options={{ headerShown: false }} />
            <Stack.Screen name="RetestList"     component={RetestListScreen}     options={{ headerShown: false }} />
            <Stack.Screen name="AddARNumber"      component={AddARNumberScreen}      options={{ headerShown: false }} />
            <Stack.Screen name="ApproveBatch"     component={ApproveBatchScreen}    options={{ headerShown: false }} />
            <Stack.Screen name="RejectBatch"      component={RejectBatchScreen}     options={{ headerShown: false }} />
            <Stack.Screen name="InitiateRetest"   component={InitiateRetestScreen}  options={{ headerShown: false }} />
            <Stack.Screen name="InspectFG" component={InspectFGScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ApproveFG" component={ApproveFGScreen} options={{ headerShown: false }} />
            <Stack.Screen name="RejectFG"  component={RejectFGScreen}  options={{ headerShown: false }} />
            <Stack.Screen name="ChatRoom"  component={ChatRoomScreen}  options={{ headerShown: false }} />
            <Stack.Screen name="ChatContactDetail" component={ChatContactDetailScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ChatGroupInfo" component={ChatGroupInfoScreen} options={{ headerShown: false }} />
            <Stack.Screen name="NewChat"   component={NewChatScreen}   options={{ headerShown: false }} />
            <Stack.Screen name="NewGroup"  component={NewGroupScreen}  options={{ headerShown: false }} />
            <Stack.Screen name="ItemsList"  component={ItemsListScreen}  options={{ headerShown: false }} />
            <Stack.Screen name="CreateItem" component={CreateItemScreen} options={{ headerShown: false }} />
            <Stack.Screen name="EditItem"   component={EditItemScreen}   options={{ headerShown: false }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
