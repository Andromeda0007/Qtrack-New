import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import { scanMaterial } from "../store/materialSlice";
import { COLORS } from "../config/constants";

const ScanScreen = () => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { loading } = useSelector((state) => state.materials);

  const handleBarCodeScanned = async ({ data, type }) => {
    if (scanned) return;

    setScanned(true);

    try {
      // Decode QR payload if it's JSON
      let qrCode = data;
      try {
        const decoded = JSON.parse(data);
        if (decoded.id) {
          qrCode = decoded.id;
        }
      } catch (e) {
        // Not JSON, use as-is
      }

      const result = await dispatch(scanMaterial(qrCode));

      if (scanMaterial.fulfilled.match(result)) {
        navigation.navigate("MaterialDetail");
      } else {
        Alert.alert("Error", result.payload || "Failed to scan material");
        setScanned(false);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to process QR code");
      setScanned(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          Camera permission is required to scan QR codes
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const screenWidth = Dimensions.get("window").width;
  const scannerSize = screenWidth * 0.75;

  return (
    <View style={styles.container}>
      <CameraView
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.header}>
        <Text style={styles.title}>Scan QR Code</Text>
        <Text style={styles.subtitle}>Position QR code in the square frame</Text>
      </View>

      <View style={styles.overlay}>
        <View style={styles.overlayTop} />
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={[styles.scanFrame, { width: scannerSize, height: scannerSize }]}>
            <View style={styles.cornerTopLeft} />
            <View style={styles.cornerTopRight} />
            <View style={styles.cornerBottomLeft} />
            <View style={styles.cornerBottomRight} />
          </View>
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom} />
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.white} />
          <Text style={styles.loadingText}>Loading material...</Text>
        </View>
      )}

      {scanned && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => setScanned(false)}
          >
            <Text style={styles.buttonText}>Scan Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {!scanned && !loading && (
        <View style={styles.footer}>
          <Text style={styles.instructionText}>
            Align the QR code within the square frame
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.dark,
  },
  header: {
    padding: 30,
    paddingTop: 60,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.white,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.white,
    opacity: 0.8,
    textAlign: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "box-none",
  },
  overlayTop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  overlayMiddle: {
    flexDirection: "row",
    alignItems: "center",
  },
  overlaySide: {
    flex: 1,
    height: Dimensions.get("window").width * 0.75,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  scanFrame: {
    borderRadius: 20,
    borderWidth: 4,
    borderColor: COLORS.white,
    backgroundColor: "transparent",
  },
  cornerTopLeft: {
    position: "absolute",
    top: -3,
    left: -3,
    width: 40,
    height: 40,
    borderTopWidth: 6,
    borderLeftWidth: 6,
    borderColor: COLORS.primary,
    borderTopLeftRadius: 20,
  },
  cornerTopRight: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 40,
    height: 40,
    borderTopWidth: 6,
    borderRightWidth: 6,
    borderColor: COLORS.primary,
    borderTopRightRadius: 20,
  },
  cornerBottomLeft: {
    position: "absolute",
    bottom: -3,
    left: -3,
    width: 40,
    height: 40,
    borderBottomWidth: 6,
    borderLeftWidth: 6,
    borderColor: COLORS.primary,
    borderBottomLeftRadius: 20,
  },
  cornerBottomRight: {
    position: "absolute",
    bottom: -3,
    right: -3,
    width: 40,
    height: 40,
    borderBottomWidth: 6,
    borderRightWidth: 6,
    borderColor: COLORS.primary,
    borderBottomRightRadius: 20,
  },
  footer: {
    padding: 30,
    alignItems: "center",
  },
  instructionText: {
    fontSize: 14,
    color: COLORS.white,
    opacity: 0.8,
    textAlign: "center",
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 16,
    textAlign: "center",
    padding: 20,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: COLORS.white,
    marginTop: 10,
    fontSize: 16,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default ScanScreen;
