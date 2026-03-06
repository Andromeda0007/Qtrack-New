import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, BorderRadius, Spacing, Shadow } from '../../utils/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
  variant?: 'default' | 'flat' | 'elevated';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  padding = Spacing.md,
  variant = 'default',
}) => (
  <View style={[
    styles.card,
    variant === 'elevated' && styles.elevated,
    variant === 'flat' && styles.flat,
    { padding },
    style,
  ]}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    ...Shadow.md,
    marginBottom: Spacing.sm,
  },
  elevated: {
    ...Shadow.lg,
  },
  flat: {
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
});
