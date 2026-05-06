import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, BorderRadius, Spacing } from '../../utils/theme';

interface Props {
  label: string;
  value: string; // DD-MM-YYYY
  onChange: (value: string) => void;
  error?: string;
  minimumDate?: Date;
  maximumDate?: Date;
}

function parseDMY(value: string): Date {
  const parts = value.split('-');
  if (parts.length === 3) {
    const d = new Date(+parts[2], +parts[1] - 1, +parts[0]);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

function formatToDMY(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${date.getFullYear()}`;
}

export const DatePickerInput: React.FC<Props> = ({
  label, value, onChange, error, minimumDate, maximumDate,
}) => {
  const [show, setShow] = useState(false);

  const handleChange = (_: any, date?: Date) => {
    setShow(false);
    if (date) onChange(formatToDMY(date));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.input, error ? styles.inputError : null]}
        onPress={() => setShow(true)}
        activeOpacity={0.75}
      >
        <Text style={[styles.valueText, !value && styles.placeholder]}>
          {value || 'DD-MM-YYYY'}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={Colors.textMuted} />
      </TouchableOpacity>
      {!!error && <Text style={styles.error}>{error}</Text>}
      {show && (
        <DateTimePicker
          value={parseDMY(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'default' : 'calendar'}
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.md },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  inputError: { borderColor: Colors.danger },
  valueText: { fontSize: FontSize.sm, color: Colors.textPrimary },
  placeholder: { color: Colors.textMuted },
  error: { fontSize: FontSize.xs, color: Colors.danger, marginTop: 4 },
});
