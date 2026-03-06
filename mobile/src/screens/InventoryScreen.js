import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import api from "../config/api";
import { API_ENDPOINTS, COLORS, MATERIAL_STATUS, STATUS_COLORS } from "../config/constants";
import { setCurrentMaterial } from "../store/materialSlice";
import moment from "moment";

const InventoryScreen = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const [materials, setMaterials] = useState([]);
  const [selectedStage, setSelectedStage] = useState(null);
  const [loading, setLoading] = useState(false);
  const user = useSelector((state) => state.auth.user);

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    try {
      setLoading(true);
      const response = await api.get(API_ENDPOINTS.MATERIALS.GET);
      setMaterials(response.data.materials || []);
    } catch (error) {
      console.error("Error loading materials:", error);
      Alert.alert("Error", "Failed to load materials");
    } finally {
      setLoading(false);
    }
  };

  const getStageMaterials = (stage) => {
    return materials.filter(m => m.current_status === stage);
  };

  const getStageCount = (stage) => {
    return getStageMaterials(stage).length;
  };

  const getStatusBackgroundColor = (status) => {
    const color = STATUS_COLORS[status] || COLORS.gray;
    return color + "1A"; // Add 10% opacity for material cards
  };

  const getStatusBorderColor = (status) => {
    const color = STATUS_COLORS[status] || COLORS.gray;
    return color + "4D"; // Add 30% opacity for softer border
  };

  const getStatusColor = (status) => STATUS_COLORS[status] || COLORS.gray;

  const getStatusIconBackground = (status) => {
    const color = STATUS_COLORS[status] || COLORS.gray;
    return color + "20"; // Add 20% opacity for light icon background
  };

  const handleStagePress = (stage) => {
    setSelectedStage(stage);
  };

  const handleBackToStages = () => {
    setSelectedStage(null);
  };

  const handleMaterialPress = async (material) => {
    try {
      const response = await api.get(`${API_ENDPOINTS.MATERIALS.GET}/${material.material_id}`);
      dispatch(setCurrentMaterial(response.data));
      navigation.navigate("MaterialDetail");
    } catch (error) {
      console.error("Error loading material details:", error);
      Alert.alert("Error", "Failed to load material details");
    }
  };

  const stages = [
    { key: MATERIAL_STATUS.QUARANTINE, label: "Quarantine", icon: "warning" },
    { key: MATERIAL_STATUS.UNDER_TEST, label: "Testing", icon: "flask" },
    { key: MATERIAL_STATUS.APPROVED, label: "Approved", icon: "checkmark-circle" },
    { key: MATERIAL_STATUS.REJECTED, label: "Rejected", icon: "close-circle" },
    { key: MATERIAL_STATUS.DISPENSED, label: "Dispensed", icon: "send" },
  ];

  // Show stage boxes or materials list
  if (selectedStage === null) {
    // Stage Boxes View
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.container}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={loadMaterials} />
          }
        >
          <View style={styles.header}>
            <Text style={styles.title}>Inventory</Text>
            <Text style={styles.subtitle}>{materials.length} Total Materials</Text>
          </View>

          <View style={styles.stagesContainer}>
            {stages.map((stage) => {
              const count = getStageCount(stage.key);
              return (
                <TouchableOpacity
                  key={stage.key}
                  style={styles.stageBox}
                  onPress={() => handleStagePress(stage.key)}
                >
                  <View style={styles.stageLeft}>
                    <View style={[styles.stageIconContainer, { backgroundColor: getStatusIconBackground(stage.key) }]}>
                      <Ionicons name={stage.icon} size={32} color={getStatusColor(stage.key)} />
                    </View>
                    <Text style={styles.stageLabel}>{stage.label}</Text>
                  </View>
                  <View style={[styles.countBadge, { backgroundColor: getStatusIconBackground(stage.key) }]}>
                    <Text style={[styles.countBadgeText, { color: getStatusColor(stage.key) }]}>{count}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Materials List View (when stage is selected)
  const stageMaterials = getStageMaterials(selectedStage);
  const stageInfo = stages.find(s => s.key === selectedStage);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackToStages} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.dark} />
          <Text style={styles.backText}>Back to Inventory</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadMaterials} />
        }
      >
        <View style={styles.stageHeader}>
          <View style={[styles.stageIconContainer, { backgroundColor: getStatusIconBackground(selectedStage) }]}>
            <Ionicons name={stageInfo.icon} size={28} color={getStatusColor(selectedStage)} />
          </View>
          <View style={styles.stageHeaderText}>
            <Text style={styles.stageTitle}>{stageInfo.label}</Text>
            <Text style={styles.stageMaterialCount}>{stageMaterials.length} {stageMaterials.length === 1 ? "Material" : "Materials"}</Text>
          </View>
        </View>

        {stageMaterials.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No materials in {stageInfo.label}
            </Text>
          </View>
        ) : (
          stageMaterials.map((material) => {
            return (
              <TouchableOpacity
                key={material.material_id}
                style={[
                  styles.materialCard,
                  { 
                    backgroundColor: getStatusBackgroundColor(material.current_status),
                    borderColor: getStatusBorderColor(material.current_status),
                  }
                ]}
                onPress={() => handleMaterialPress(material)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.headerLeft}>
                    <Text style={styles.materialName}>{material.item_name}</Text>
                    <Text style={styles.itemCode}>{material.item_code}</Text>
                  </View>
                  <View
                    style={[styles.statusBadge, { backgroundColor: getStatusColor(material.current_status) }]}
                  >
                    <Text style={styles.statusText}>
                      {material.current_status}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardContent}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Batch/Lot:</Text>
                    <Text style={styles.infoValue}>{material.batch_lot_number}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>GRN:</Text>
                    <Text style={styles.infoValue}>{material.grn_number}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Supplier:</Text>
                    <Text style={styles.infoValue}>{material.supplier_name}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Manufacturer:</Text>
                    <Text style={styles.infoValue}>{material.manufacturer_name}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Remaining Qty:</Text>
                    <Text style={[styles.infoValue, styles.qtyHighlight]}>{material.remaining_quantity}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Receipt Date:</Text>
                    <Text style={styles.infoValue}>{moment(material.date_of_receipt).format("DD MMM YYYY")}</Text>
                  </View>
                  {material.exp_date && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Expiry Date:</Text>
                      <Text style={styles.infoValue}>{moment(material.exp_date).format("DD MMM YYYY")}</Text>
                    </View>
                  )}
                  {material.rack_number && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Rack:</Text>
                      <Text style={styles.infoValue}>{material.rack_number}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.cardFooter}>
                  <View style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>View Item & Take Action</Text>
                    <Ionicons name="arrow-forward" size={16} color={COLORS.white} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.light,
  },
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.dark,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.gray,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  backText: {
    fontSize: 16,
    color: COLORS.dark,
    marginLeft: 8,
    fontWeight: "500",
  },
  stagesContainer: {
    padding: 20,
    marginTop: 10,
  },
  stageBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.white,
    marginBottom: 15,
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  stageLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  stageIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  stageLabel: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.dark,
    flex: 1,
  },
  countBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  countBadgeText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  stageHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    padding: 10,
    marginHorizontal: 12,
    marginTop: 15,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  stageHeaderText: {
    marginLeft: 15,
    flex: 1,
  },
  stageTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.dark,
    marginBottom: 3,
  },
  stageMaterialCount: {
    fontSize: 14,
    color: COLORS.gray,
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.gray,
    textAlign: "center",
  },
  materialCard: {
    marginHorizontal: 12,
    marginVertical: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
    marginRight: 10,
  },
  materialName: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.dark,
    marginBottom: 3,
  },
  itemCode: {
    fontSize: 14,
    color: COLORS.dark,
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 12,
  },
  cardContent: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.dark,
    fontWeight: "600",
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.dark,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  qtyHighlight: {
    color: COLORS.primary,
    fontWeight: "700",
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    paddingTop: 12,
    paddingBottom: 4,
    alignItems: "center",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007AFFD9",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonText: {
    fontSize: 13,
    color: COLORS.white,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});

export default InventoryScreen;

