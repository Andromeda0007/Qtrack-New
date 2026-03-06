import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppNavigator } from './src/navigation/AppNavigator';
import Toast from 'react-native-toast-message';

export default function App() {
  return (
    <>
      <StatusBar style="light" backgroundColor="#1e3a5f" />
      <AppNavigator />
      <Toast />
    </>
  );
}
