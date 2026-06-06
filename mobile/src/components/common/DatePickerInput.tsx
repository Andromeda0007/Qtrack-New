import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal,
  ScrollView, Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from "../../utils/theme";
import type { DateFormat } from "../../utils/formatters";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function pad2(n: number) { return n.toString().padStart(2, "0"); }

function isoToDate(iso: string | null | undefined): Date {
  if (!iso) return new Date();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  return new Date();
}

type Props = {
  label: string;
  isoValue: string;
  format: DateFormat;
  onChange: (isoValue: string) => void;
  placeholder?: string;
};

export const DatePickerInput: React.FC<Props> = ({ label, isoValue, format, onChange, placeholder }) => {
  const [showNative, setShowNative] = useState(false);
  const [showMonthYear, setShowMonthYear] = useState(false);

  const currentDate = isoToDate(isoValue);
  const [pickerMonth, setPickerMonth] = useState(currentDate.getMonth());
  const [pickerYear, setPickerYear]   = useState(currentDate.getFullYear());

  const monthRef = useRef<ScrollView>(null);
  const yearRef  = useRef<ScrollView>(null);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 21 }, (_, i) => currentYear - 5 + i);

  const displayValue = (() => {
    if (!isoValue) return "";
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoValue);
    if (!m) return isoValue;
    const [, yyyy, mm, dd] = m;
    if (format === "YYYY-MM-DD") return `${yyyy}-${mm}-${dd}`;
    if (format === "MM-YYYY")    return `${mm}-${yyyy}`;
    return `${dd}-${mm}-${yyyy}`;
  })();

  const handleNativeChange = (_: any, selected?: Date) => {
    setShowNative(false);
    if (!selected) return;
    const iso = `${selected.getFullYear()}-${pad2(selected.getMonth() + 1)}-${pad2(selected.getDate())}`;
    onChange(iso);
  };

  const confirmMonthYear = () => {
    const iso = `${pickerYear}-${pad2(pickerMonth + 1)}-01`;
    onChange(iso);
    setShowMonthYear(false);
  };

  const openPicker = () => {
    if (format === "MM-YYYY") {
      const d = isoToDate(isoValue);
      setPickerMonth(d.getMonth());
      setPickerYear(d.getFullYear());
      setShowMonthYear(true);
      setTimeout(() => {
        monthRef.current?.scrollTo({ y: d.getMonth() * 52, animated: false });
        const yi = years.indexOf(d.getFullYear());
        if (yi >= 0) yearRef.current?.scrollTo({ y: yi * 52, animated: false });
      }, 100);
    } else {
      setShowNative(true);
    }
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.inputRow} onPress={openPicker} activeOpacity={0.75}>
        <Text style={[styles.inputText, !displayValue && styles.placeholder]}>
          {displayValue || placeholder || (format === "MM-YYYY" ? "MM-YYYY" : format === "YYYY-MM-DD" ? "YYYY-MM-DD" : "DD-MM-YYYY")}
        </Text>
        <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
      </TouchableOpacity>

      {/* Native date picker (DD-MM-YYYY / YYYY-MM-DD) */}
      {showNative && (
        <DateTimePicker
          value={isoToDate(isoValue)}
          mode="date"
          display={Platform.OS === "android" ? "default" : "inline"}
          onChange={handleNativeChange}
        />
      )}

      {/* Custom MM-YYYY picker modal */}
      <Modal visible={showMonthYear} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Select Month & Year</Text>
            <View style={styles.columns}>
              {/* Month column */}
              <View style={styles.col}>
                <Text style={styles.colHeader}>Month</Text>
                <ScrollView
                  ref={monthRef}
                  style={styles.scroll}
                  showsVerticalScrollIndicator={false}
                >
                  {MONTHS.map((name, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.item, pickerMonth === idx && styles.selectedItem]}
                      onPress={() => setPickerMonth(idx)}
                    >
                      <Text style={[styles.itemText, pickerMonth === idx && styles.selectedText]}>
                        {name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              {/* Year column */}
              <View style={styles.col}>
                <Text style={styles.colHeader}>Year</Text>
                <ScrollView
                  ref={yearRef}
                  style={styles.scroll}
                  showsVerticalScrollIndicator={false}
                >
                  {years.map((y) => (
                    <TouchableOpacity
                      key={y}
                      style={[styles.item, pickerYear === y && styles.selectedItem]}
                      onPress={() => setPickerYear(y)}
                    >
                      <Text style={[styles.itemText, pickerYear === y && styles.selectedText]}>
                        {y}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
            <View style={styles.pickerButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowMonthYear(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={confirmMonthYear}>
                <Text style={styles.confirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { marginBottom: Spacing.md },
  label: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary, marginBottom: 6 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.inputBg ?? "#F8F9FA",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
  },
  inputText: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary },
  placeholder: { color: Colors.textTertiary ?? "#aaa" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  pickerCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadow.lg,
  },
  pickerTitle: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    color: Colors.textPrimary,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  columns: { flexDirection: "row", gap: Spacing.sm },
  col: { flex: 1 },
  colHeader: {
    fontSize: FontSize.sm,
    fontWeight: "700",
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: 6,
  },
  scroll: { height: 208 },
  item: {
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: BorderRadius.sm,
  },
  selectedItem: { backgroundColor: Colors.primary + "18" },
  itemText: { fontSize: FontSize.md, color: Colors.textPrimary },
  selectedText: { color: Colors.primary, fontWeight: "700" },
  pickerButtons: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: Colors.border, alignItems: "center",
  },
  cancelText: { fontSize: FontSize.md, fontWeight: "600", color: Colors.textSecondary },
  confirmBtn: {
    flex: 1, paddingVertical: 13, borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary, alignItems: "center",
  },
  confirmText: { fontSize: FontSize.md, fontWeight: "700", color: "#fff" },
});
