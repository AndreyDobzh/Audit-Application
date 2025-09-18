// src/components/DebugPanel.js
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

export default function DebugPanel({ logs }) {
  if (!logs || logs.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Отладка</Text>
      <ScrollView style={styles.scroll}>
        {logs.map((log, index) => (
          <Text key={index} style={styles.logText}>{log}</Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 150, borderTopWidth: 1, borderTopColor: '#ccc', backgroundColor: '#f5f5f5', padding: 5 },
  title: { fontWeight: 'bold', color: '#333', marginBottom: 5 },
  scroll: { flex: 1 },
  logText: { fontSize: 12, color: '#000' },
});
