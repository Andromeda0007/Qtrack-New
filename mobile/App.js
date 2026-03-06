import React, { useEffect } from "react";
import { Provider } from "react-redux";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { store } from "./src/store/store";
import { restoreAuth } from "./src/store/authSlice";
import AuthNavigator from "./src/navigation/AuthNavigator";
import AppNavigator from "./src/navigation/AppNavigator";
import { useDispatch, useSelector } from "react-redux";

function AppContent() {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  useEffect(() => {
    // Restore auth state on app start
    const restoreAuthState = async () => {
      try {
        const token = await AsyncStorage.getItem("authToken");
        const userStr = await AsyncStorage.getItem("user");

        if (token && userStr) {
          const user = JSON.parse(userStr);
          dispatch(restoreAuth({ token, user }));
        }
      } catch (error) {
        console.error("Error restoring auth state:", error);
      }
    };

    restoreAuthState();
  }, [dispatch]);

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      {isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
}
