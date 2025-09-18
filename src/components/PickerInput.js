import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';

export default function PickerInput({ label, selectedValue, onValueChange, items }) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Picker
        selectedValue={selectedValue}
        onValueChange={onValueChange}
        style={Platform.OS === 'ios' ? styles.pickerIOS : styles.picker}
      >
        <Picker.Item label="Выберите..." value={null} />
        {items.map((item, index) => (
          <Picker.Item key={index} label={item.label} value={item.value} />
        ))}
      </Picker>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 300, marginBottom: 20 },
  label: { marginBottom: 5, fontSize: 16, color: '#555' },
  picker: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8 },
  pickerIOS: { height: 150 },
});