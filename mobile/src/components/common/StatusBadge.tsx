import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BatchStatusColors, FGStatusColors, BorderRadius, FontSize } from '../../utils/theme';

interface StatusBadgeProps {
  status: string;
  type?: 'batch' | 'fg';
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  type = 'batch',
  size = 'md',
}) => {
  const colorMap = type === 'batch' ? BatchStatusColors : FGStatusColors;
  const config = colorMap[status] || { bg: '#e2e3e5', text: '#383d41', label: status };

  return (
    <View style={[
      styles.badge,
      { backgroundColor: config.bg },
      size === 'sm' && styles.badgeSm,
    ]}>
      <Text style={[
        styles.text,
        { color: config.text },
        size === 'sm' && styles.textSm,
      ]}>
        {config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  text: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  textSm: {
    fontSize: 10,
  },
});
