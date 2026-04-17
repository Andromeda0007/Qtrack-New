import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { TopTabs } from '../../components/common/TopTabs';
import { BatchListView } from '../../components/common/BatchListView';
import { FGBatchListView } from '../../components/common/FGBatchListView';
import { Colors, FontSize, Spacing } from '../../utils/theme';

export type WorkflowMode =
  | 'warehouse_issue'
  | 'qc_test'
  | 'qc_decision'
  | 'qa_inspect'
  | 'qa_decision'
  | 'production_consume';

interface ModeConfig {
  title: string;
  subtitle: string;
  scanFlow: string | null;
  statuses: string[];
  isFG: boolean;
  accentColor: string;
  bgColor: string;
  textColor: string;
  scanHint: string;
}

const MODE_CONFIG: Record<WorkflowMode, ModeConfig> = {
  warehouse_issue: {
    title: 'Move to Production',
    subtitle: 'Select an approved item or scan its QR',
    scanFlow: 'warehouse_issue',
    statuses: ['APPROVED'],
    isFG: false,
    accentColor: Colors.success,
    bgColor: '#D4EDDA',
    textColor: '#155724',
    scanHint: 'Scan the QR label on an approved item to move it to production.',
  },
  qc_test: {
    title: 'Start Testing',
    subtitle: 'Select a quarantine item or scan its QR',
    scanFlow: 'qc_test',
    statuses: ['QUARANTINE', 'QUARANTINE_RETEST'],
    isFG: false,
    accentColor: Colors.warning,
    bgColor: '#FFF3CD',
    textColor: '#856404',
    scanHint: 'Scan the QR label on a quarantined item to begin QC testing.',
  },
  qc_decision: {
    title: 'Approve / Reject',
    subtitle: 'Select an under-test item or scan its QR',
    scanFlow: 'qc_decision',
    statuses: ['UNDER_TEST'],
    isFG: false,
    accentColor: Colors.info,
    bgColor: '#CCE5FF',
    textColor: '#004085',
    scanHint: 'Scan the QR label on an under-test item to approve or reject it.',
  },
  qa_inspect: {
    title: 'Inspect FG',
    subtitle: 'Select a QA-pending FG batch or scan its QR',
    scanFlow: null,
    statuses: ['QA_PENDING'],
    isFG: true,
    accentColor: Colors.accent,
    bgColor: '#E8D5F5',
    textColor: '#6B21A8',
    scanHint: 'Scan the QR label on a finished-goods batch to record an inspection.',
  },
  qa_decision: {
    title: 'Approve / Reject FG',
    subtitle: 'Select a QA-pending FG batch or scan its QR',
    scanFlow: null,
    statuses: ['QA_PENDING'],
    isFG: true,
    accentColor: Colors.primary,
    bgColor: '#D1ECF1',
    textColor: '#0c5460',
    scanHint: 'Scan the QR label on an inspected FG batch to approve or reject it.',
  },
  production_consume: {
    title: 'Consume Material',
    subtitle: 'Select an approved item or scan its QR',
    scanFlow: null,
    statuses: ['APPROVED'],
    isFG: false,
    accentColor: Colors.info,
    bgColor: '#D1ECF1',
    textColor: '#0c5460',
    scanHint: 'Scan the QR label on an approved material to record consumption.',
  },
};

const TABS = [
  { key: 'cards', label: 'Items', icon: 'list-outline' },
  { key: 'scan', label: 'Scan', icon: 'scan-outline' },
];

export const WorkflowHubScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const mode = (route.params?.mode ?? 'warehouse_issue') as WorkflowMode;
  const cfg = MODE_CONFIG[mode] ?? MODE_CONFIG.warehouse_issue;

  const [tab, setTab] = useState<'cards' | 'scan'>('cards');

  const handleScanTab = () => {
    if (cfg.scanFlow) {
      navigation.navigate('Scanner', { scanFlow: cfg.scanFlow });
    } else {
      navigation.navigate('Scanner', {});
    }
  };

  const handleRowPress = (batch: any) => {
    if (cfg.isFG) {
      navigation.navigate('FGBatchDetail', {
        fgBatchId: batch.id,
        fgBatchNumber: batch.batch_number,
        mode,
      });
    } else {
      navigation.navigate('BatchDetail', { batchId: batch.id });
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{cfg.title}</Text>
          <Text style={styles.headerSub}>{cfg.subtitle}</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.body}>
        <TopTabs
          tabs={TABS}
          value={tab}
          onChange={(k) => {
            if (k === 'scan') {
              handleScanTab();
            } else {
              setTab('cards');
            }
          }}
        />

        {tab === 'cards' && (
          cfg.isFG ? (
            <FGBatchListView
              status={cfg.statuses[0]}
              onRowPress={handleRowPress}
              accentColor={cfg.accentColor}
            />
          ) : (
            <BatchListView
              statuses={cfg.statuses}
              onRowPress={handleRowPress}
              accentColor={cfg.accentColor}
              bgColor={cfg.bgColor}
              textColor={cfg.textColor}
            />
          )
        )}
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
  headerSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  body: { flex: 1, backgroundColor: Colors.background },
});
