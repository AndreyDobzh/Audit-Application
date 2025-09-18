import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, Button, ActivityIndicator } from 'react-native';
import { getWithSession } from '../api/apiClient';

export default function EmployeesScreen({ route, navigation, addLog }) {
  const { sessionID } = route.params;
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionID) {
      Alert.alert('Ошибка', 'Нет sessionID');
      navigation.navigate('Login');
      return;
    }

    const fetchEmployees = async () => {
      try {
        addLog('🧑‍💼 Запрос сотрудников...');
        // 🔁 ИСПОЛЬЗУЕМ ПРАВИЛЬНЫЙ ЭНДПОИНТ — ТОТ, КОТОРЫЙ ТЫ ВИДЕЛ В ЛОГАХ
        const res = await getWithSession(
          'https://api.directual.com/good/api/v5/data/employees/GetAllEmployees',
          sessionID,
          { pageSize: 50 }
        );
        addLog(`✅ Ответ сотрудников: статус ${res.status}, записей: ${res.payload?.length || 0}`);
        if (res.status === 'OK' && Array.isArray(res.payload)) {
          setEmployees(res.payload);
        } else {
          throw new Error('Некорректный ответ от сервера');
        }
      } catch (err) {
        addLog(`❌ Ошибка загрузки сотрудников: ${err.message}`);
        Alert.alert('Ошибка', 'Не удалось загрузить сотрудников');
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, [sessionID]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Загрузка сотрудников...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Сотрудники ({employees.length})</Text>
      {employees.length === 0 ? (
        <Text style={styles.noData}>Нет данных</Text>
      ) : (
        employees.map((emp) => (
          <View key={emp.id} style={styles.employeeItem}>
            <Text style={styles.employeeText}>
              {emp.second_name} {emp.name} {emp.third_name || ''}
            </Text>
            <Text style={styles.employeeSubText}>Позиция: {emp.position}</Text>
            <Text style={styles.employeeSubText}>Тип: {emp.type}</Text>
          </View>
        ))
      )}
      <View style={styles.buttonContainer}>
        <Button title="➕ Создать аудит" onPress={() => navigation.navigate('CreateAudit', { sessionID })} color="#0066cc" />
        <View style={{ height: 10 }} />
        <Button title="🚪 Выйти" onPress={() => navigation.navigate('Login')} color="#d9534f" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#555' },
  employeeItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 8,
  },
  employeeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  employeeSubText: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  noData: { textAlign: 'center', fontSize: 16, color: '#888', marginTop: 20 },
  buttonContainer: { marginTop: 30, marginHorizontal: 20 },
});