import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Shadow } from '../../utils/theme';

interface Tab {
  key: string;
  label: string;
  icon: string;
}

interface Props {
  tabs: Tab[];
  value: string;
  onChange: (key: string) => void;
}

export const TopTabs: React.FC<Props> = ({ tabs, value, onChange }) => (
  <View style={styles.container}>
    {tabs.map((tab) => {
      const active = tab.key === value;
      return (
        <Pressable
          key={tab.key}
          style={[styles.tab, active && styles.tabActive]}
          onPress={() => onChange(tab.key)}
        >
          <Ionicons
            name={tab.icon as any}
            size={16}
            color={active ? Colors.primary : Colors.textMuted}
          />
          <Text style={[styles.label, active && styles.labelActive]}>
            {tab.label}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 10,
    backgroundColor: '#F0F0F5',
    borderRadius: 12,
    padding: 4,
    ...Shadow.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  tabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textMuted },
  labelActive: { color: Colors.primary },
});
