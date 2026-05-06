import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { FGBatchListView } from '../../components/common/FGBatchListView';
import { Colors, FontSize, Spacing } from '../../utils/theme';

export const FGBatchListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { status, title = 'FG Batches' } = (route.params ?? {}) as { status?: string; title?: string };

  const handleRowPress = (batch: any) => {
    navigation.navigate('FGBatchDetail', {
      fgBatchId: batch.id,
      fgBatchNumber: batch.batch_number,
      batch,
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.body}>
        <FGBatchListView
          status={status}
          onRowPress={handleRowPress}
          accentColor={Colors.accent}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 12, backgroundColor: Colors.primary,
  },
  backBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '800', color: '#fff' },
  body: { flex: 1, backgroundColor: Colors.background, paddingTop: Spacing.md },
});
