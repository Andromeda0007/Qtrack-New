import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  moveToUnderTest,
  approveMaterial,
  rejectMaterial,
  updateRackNumber,
  dispenseMaterial,
} from "../store/materialSlice";
import {
  COLORS,
  MATERIAL_STATUS,
  STATUS_COLORS,
  ROLES,
} from "../config/constants";
import moment from "moment";

const MaterialDetailScreen = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { currentMaterial, history, canEdit } = useSelector(
    (state) => state.materials
  );
  const user = useSelector((state) => state.auth.user);
  const isOperator = user?.role === ROLES.OPERATOR;
  const isAdmin = user?.role === ROLES.ADMIN;
  const canPerformActions = isOperator || isAdmin;

  if (!currentMaterial) {
    return (
      <View style={styles.container}>
        <Text>No material selected</Text>
      </View>
    );
  }

  const handleAction = (action, params = {}) => {
    if (!canPerformActions) {
      Alert.alert(
        "Access Denied",
        "You do not have permission to perform this action"
      );
      return;
    }

    switch (action) {
      case "sampling":
        Alert.alert(
          "Move to Under Test",
          "Move this material to Under Test stage?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Yes, Move",
              onPress: () => {
                dispatch(
                  moveToUnderTest({
                    materialId: currentMaterial.material_id,
                    comments: "",
                  })
                );
              },
            },
          ]
        );
        break;

      case "approve":
        Alert.alert(
          "Approve Material",
          "Approve this material?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Approve",
              onPress: () => {
                dispatch(
                  approveMaterial({
                    materialId: currentMaterial.material_id,
                    retestDate: "",
                    comments: "",
                  })
                );
              },
            },
          ]
        );
        break;

      case "reject":
        Alert.prompt(
          "Reject Material",
          "Enter rejection reason:",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Reject",
              style: "destructive",
              onPress: (rejectionReason) => {
                if (!rejectionReason || rejectionReason.trim() === "") {
                  Alert.alert("Error", "Rejection reason is required");
                  return;
                }
                dispatch(
                  rejectMaterial({
                    materialId: currentMaterial.material_id,
                    rejectionReason,
                    comments: "",
                  })
                );
              },
            },
          ],
          "plain-text"
        );
        break;

      case "rack":
        Alert.prompt(
          "Update Rack Number",
          "Enter rack number:",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Update",
              onPress: (rackNumber) => {
                if (!rackNumber || rackNumber.trim() === "") {
                  Alert.alert("Error", "Rack number is required");
                  return;
                }
                dispatch(
                  updateRackNumber({
                    materialId: currentMaterial.material_id,
                    rackNumber,
                  })
                );
              },
            },
          ],
          "plain-text"
        );
        break;

      case "dispense":
        Alert.prompt(
          "Dispense Material",
          "Enter quantity to dispense:",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Next",
              onPress: (quantity) => {
                const qty = parseFloat(quantity);
                if (!quantity || isNaN(qty) || qty <= 0) {
                  Alert.alert("Error", "Please enter a valid quantity");
                  return;
                }
                if (qty > currentMaterial.remaining_quantity) {
                  Alert.alert("Error", `Only ${currentMaterial.remaining_quantity} available`);
                  return;
                }
                Alert.prompt(
                  "Product/Batch",
                  "Enter product/batch name:",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Dispense",
                      onPress: (issuedToProductBatch) => {
                        if (!issuedToProductBatch || issuedToProductBatch.trim() === "") {
                          Alert.alert("Error", "Product/batch name is required");
                          return;
                        }
                        dispatch(
                          dispenseMaterial({
                            materialId: currentMaterial.material_id,
                            issuedQuantity: qty,
                            issuedToProductBatch,
                          })
                        );
                      },
                    },
                  ],
                  "plain-text"
                );
              },
            },
          ],
          "numeric"
        );
        break;
    }
  };

  const getStatusColor = (status) => STATUS_COLORS[status] || COLORS.gray;

  const canMoveToUnderTest =
    currentMaterial.current_status === MATERIAL_STATUS.QUARANTINE && canPerformActions;
  const canApproveReject =
    currentMaterial.current_status === MATERIAL_STATUS.UNDER_TEST && canPerformActions;
  const canUpdateRack =
    currentMaterial.current_status === MATERIAL_STATUS.APPROVED && canPerformActions;
  const canDispense =
    currentMaterial.current_status === MATERIAL_STATUS.APPROVED && canPerformActions;

  return (
    <ScrollView style={styles.container}>
      {/* Material Info Card */}
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>Material Information</Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: getStatusColor(currentMaterial.current_status),
              },
            ]}
          >
            <Text style={styles.statusText}>
              {currentMaterial.current_status}
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>QR Code:</Text>
          <Text style={styles.value}>{currentMaterial.qr_code}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Item Code:</Text>
          <Text style={styles.value}>{currentMaterial.item_code}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Item Name:</Text>
          <Text style={styles.value}>{currentMaterial.item_name}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Batch/Lot:</Text>
          <Text style={styles.value}>{currentMaterial.batch_lot_number}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>GRN Number:</Text>
          <Text style={styles.value}>{currentMaterial.grn_number}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Received Quantity:</Text>
          <Text style={styles.value}>
            {currentMaterial.received_total_quantity}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Remaining Quantity:</Text>
          <Text style={[styles.value, styles.importantValue]}>
            {currentMaterial.remaining_quantity}
          </Text>
        </View>

        {currentMaterial.rack_number && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Rack Number:</Text>
            <Text style={styles.value}>{currentMaterial.rack_number}</Text>
          </View>
        )}

        <View style={styles.infoRow}>
          <Text style={styles.label}>Supplier:</Text>
          <Text style={styles.value}>{currentMaterial.supplier_name}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Manufacturer:</Text>
          <Text style={styles.value}>{currentMaterial.manufacturer_name}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Receipt Date:</Text>
          <Text style={styles.value}>
            {moment(currentMaterial.date_of_receipt).format("DD MMM YYYY")}
          </Text>
        </View>

        {currentMaterial.exp_date && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Expiry Date:</Text>
            <Text style={styles.value}>
              {moment(currentMaterial.exp_date).format("DD MMM YYYY")}
            </Text>
          </View>
        )}
      </View>

      {/* Action Buttons (Operator/Admin only) */}
      {canPerformActions && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Actions</Text>

          {canMoveToUnderTest && (
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryButton]}
              onPress={() => handleAction("sampling")}
            >
              <Ionicons name="flask" size={20} color={COLORS.white} />
              <Text style={styles.actionButtonText}>Move to Under Test</Text>
            </TouchableOpacity>
          )}

          {canApproveReject && (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.successButton]}
                onPress={() => handleAction("approve")}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={COLORS.white}
                />
                <Text style={styles.actionButtonText}>Approve</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.dangerButton]}
                onPress={() => handleAction("reject")}
              >
                <Ionicons name="close-circle" size={20} color={COLORS.white} />
                <Text style={styles.actionButtonText}>Reject</Text>
              </TouchableOpacity>
            </>
          )}

          {canUpdateRack && (
            <TouchableOpacity
              style={[styles.actionButton, styles.infoButton]}
              onPress={() => handleAction("rack")}
            >
              <Ionicons name="location" size={20} color={COLORS.white} />
              <Text style={styles.actionButtonText}>Update Rack Number</Text>
            </TouchableOpacity>
          )}

          {canDispense && (
            <TouchableOpacity
              style={[styles.actionButton, styles.warningButton]}
              onPress={() => handleAction("dispense")}
            >
              <Ionicons name="send" size={20} color={COLORS.white} />
              <Text style={styles.actionButtonText}>
                Dispense to Manufacturing
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* History */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Audit History</Text>
        {history.length === 0 ? (
          <Text style={styles.emptyText}>No history available</Text>
        ) : (
          history.map((item, index) => (
            <View key={index} style={styles.historyItem}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyAction}>{item.action_type}</Text>
                <Text style={styles.historyDate}>
                  {moment(item.timestamp).format("DD MMM YYYY HH:mm")}
                </Text>
              </View>
              <Text style={styles.historyUser}>
                By: {item.performed_by_name} ({item.performed_by_role})
              </Text>
              {item.from_status && item.to_status && (
                <Text style={styles.historyStatus}>
                  {item.from_status} → {item.to_status}
                </Text>
              )}
              {item.comments && (
                <Text style={styles.historyComment}>{item.comments}</Text>
              )}
              {item.rejection_reason && (
                <Text style={styles.historyRejection}>
                  Rejection Reason: {item.rejection_reason}
                </Text>
              )}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.light,
  },
  card: {
    backgroundColor: COLORS.white,
    margin: 15,
    padding: 15,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.dark,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.light,
  },
  label: {
    fontSize: 14,
    color: COLORS.gray,
    flex: 1,
  },
  value: {
    fontSize: 14,
    color: COLORS.dark,
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
  },
  importantValue: {
    color: COLORS.primary,
    fontWeight: "bold",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.dark,
    marginBottom: 15,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  successButton: {
    backgroundColor: COLORS.success,
  },
  dangerButton: {
    backgroundColor: COLORS.danger,
  },
  infoButton: {
    backgroundColor: COLORS.info,
  },
  warningButton: {
    backgroundColor: COLORS.warning,
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  historyItem: {
    padding: 12,
    backgroundColor: COLORS.light,
    borderRadius: 8,
    marginBottom: 10,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  historyAction: {
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.dark,
  },
  historyDate: {
    fontSize: 12,
    color: COLORS.gray,
  },
  historyUser: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 5,
  },
  historyStatus: {
    fontSize: 12,
    color: COLORS.primary,
    marginBottom: 5,
  },
  historyComment: {
    fontSize: 12,
    color: COLORS.dark,
    marginTop: 5,
  },
  historyRejection: {
    fontSize: 12,
    color: COLORS.danger,
    marginTop: 5,
    fontWeight: "600",
  },
  emptyText: {
    textAlign: "center",
    color: COLORS.gray,
    padding: 20,
  },
});

export default MaterialDetailScreen;

