import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { inventoryApi } from '../../api/inventory';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Colors, FontSize, Spacing } from '../../utils/theme';
import { formatDate, formatQuantity } from '../../utils/formatters';
import { useAuthStore } from '../../store/authStore';
import { extractError } from '../../api/client';

export const QCScanScreen: React.FC = () => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [batchData, setBatchData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();
  const navigation = useNavigation<any>();

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setLoading(true);
    try {
      const result = await inventoryApi.scanQR(data);
      setBatchData(result);
    } catch (error) {
      Alert.alert('Scan Error', extractError(error), [
        { text: 'Try Again', onPress: () => { setScanned(false); setBatchData(null); } },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const resetScan = () => {
    setScanned(false);
    setBatchData(null);
    setLoading(false);
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.permText}>Requesting camera permission...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Ionicons name="camera-off" size={48} color={Colors.danger} />
          <Text style={styles.permText}>Camera permission denied.</Text>
          <Text style={styles.permSubtext}>Please enable camera access in Settings.</Text>
          <Button title="Grant Permission" onPress={requestPermission} style={{ marginTop: Spacing.md }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>QR Scanner</Text>
        <Text style={styles.headerSub}>Point at a QTrack QR code</Text>
      </View>

      {!batchData ? (
        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          />
          {/* Overlay frame */}
          <View style={styles.overlay}>
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            {loading ? (
              <Text style={styles.scanHint}>Looking up batch...</Text>
            ) : (
              <Text style={styles.scanHint}>Align QR code within the frame</Text>
            )}
          </View>
        </View>
      ) : (
        <ScrollView style={styles.resultContainer} contentContainerStyle={styles.resultContent}>
          <View style={styles.resultHeader}>
            <Ionicons name="checkmark-circle" size={32} color={Colors.success} />
            <Text style={styles.resultTitle}>Batch Found</Text>
          </View>

          <Card>
            <Text style={styles.batchNumber}>{batchData.batch_number}</Text>
            <StatusBadge status={batchData.status} type="batch" />

            <View style={styles.infoGrid}>
              <InfoRow label="Material" value={batchData.material_name || '—'} />
              <InfoRow label="Remaining Qty" value={formatQuantity(batchData.remaining_quantity)} />
              <InfoRow label="Retest Date" value={formatDate(batchData.retest_date)} />
              <InfoRow label="AR Number" value={batchData.ar_number || '—'} />
            </View>
          </Card>

          {/* Role-based action buttons */}
          <RoleActions batchData={batchData} role={user?.role || ''} onAction={resetScan} />

          <Button title="Scan Another" onPress={resetScan} variant="outline" fullWidth style={{ marginTop: Spacing.md }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const RoleActions: React.FC<{ batchData: any; role: string; onAction: () => void }> = ({ batchData, role, onAction }) => {
  const navigation = useNavigation<any>();
  const status = batchData?.status;

  const goTo = (screen: string, params?: any) => {
    navigation.navigate(screen, { batchId: batchData.id, batchNumber: batchData.batch_number, ...params });
  };

  if (role === 'QC_EXECUTIVE' || role === 'QC_HEAD') {
    if (status === 'QUARANTINE' || status === 'QUARANTINE_RETEST') {
      return (
        <Button title="Add AR Number & Start Testing" onPress={() => goTo('AddARNumber')} fullWidth style={{ marginTop: Spacing.sm }} />
      );
    }
    if (status === 'UNDER_TEST' && role === 'QC_HEAD') {
      return (
        <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
          <Button title="Approve Material" onPress={() => goTo('ApproveBatch')} variant="success" fullWidth />
          <Button title="Reject Material" onPress={() => goTo('RejectBatch')} variant="danger" fullWidth />
        </View>
      );
    }
    if (status === 'APPROVED' && role === 'QC_HEAD') {
      return <Button title="Initiate Retest" onPress={() => goTo('InitiateRetest')} variant="outline" fullWidth style={{ marginTop: Spacing.sm }} />;
    }
  }

  if ((role === 'WAREHOUSE_USER' || role === 'WAREHOUSE_HEAD') && status === 'APPROVED') {
    return <Button title="Issue to Production" onPress={() => goTo('IssueStock')} fullWidth style={{ marginTop: Spacing.sm }} />;
  }

  if ((role === 'QA_EXECUTIVE' || role === 'QA_HEAD') && status === 'QA_PENDING') {
    return (
      <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
        <Button title="Submit Inspection" onPress={() => goTo('InspectFG')} fullWidth />
        {role === 'QA_HEAD' && <Button title="Approve FG" onPress={() => goTo('ApproveFG')} variant="success" fullWidth />}
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  header: { padding: Spacing.md, backgroundColor: Colors.primary },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.background },
  permText: { fontSize: FontSize.md, color: Colors.textPrimary, textAlign: 'center' },
  permSubtext: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  scannerContainer: { flex: 1, position: 'relative' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  scanFrame: {
    width: 250, height: 250, position: 'relative',
    borderColor: 'rgba(255,255,255,0.3)', borderWidth: 1,
  },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: Colors.accent, borderWidth: 3 },
  topLeft: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0 },
  topRight: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0 },
  scanHint: { color: '#fff', marginTop: Spacing.xl, fontSize: FontSize.sm, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  resultContainer: { flex: 1, backgroundColor: Colors.background },
  resultContent: { padding: Spacing.md },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  resultTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  batchNumber: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.primary, marginBottom: Spacing.sm },
  infoGrid: { marginTop: Spacing.md, gap: Spacing.sm },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  infoValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
});
