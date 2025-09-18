import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, ScrollView, Text, Button, StyleSheet, Alert } from 'react-native';

// Экраны
import LoginScreen from './src/screens/LoginScreen';
import EmployeesScreen from './src/screens/EmployeesScreen';
import CreateAuditScreen from './src/screens/CreateAuditScreen';
import AuditChecklistScreen from './src/screens/AuditChecklistScreen';

const Stack = createStackNavigator();

export default function App() {
  const [sessionID, setSessionID] = useState(null);
  const [logs, setLogs] = useState([]);

  const addLog = (message) => {
    const logEntry = `[${new Date().toLocaleTimeString()}] ${message}`;
    setLogs((prev) => [...prev, logEntry]);
    console.log(logEntry);
  };

  // 🔁 После установки sessionID — автоматически переходим на Employees
  useEffect(() => {
    if (sessionID) {
      addLog('✅ Сессия установлена — перенаправляем на Employees');
    }
  }, [sessionID]);

  const handleLoginSuccess = (sid) => {
    addLog(`🔐 Авторизация успешна. sessionID: ${sid.substring(0, 10)}...`);
    setSessionID(sid);
    // ⏩ Автоматический переход на экран сотрудников
    navigationRef.current?.navigate('Employees');
  };

  const handleLogout = () => {
    addLog('🚪 Выход из системы');
    Alert.alert('Выход', 'Вы действительно хотите выйти?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: () => {
          setSessionID(null);
          navigationRef.current?.navigate('Login');
        },
      },
    ]);
  };

  // 🧭 Реф для навигации извне
  const navigationRef = React.createRef();

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{ headerShown: false }} // Скрываем заголовки для кастомного управления
      >
        <Stack.Screen name="Login">
          {(props) => <LoginScreen {...props} onLoginSuccess={handleLoginSuccess} addLog={addLog} />}
        </Stack.Screen>

        <Stack.Screen name="Employees">
          {(props) => (
            <View style={{ flex: 1 }}>
              <EmployeesScreen {...props} sessionID={sessionID} addLog={addLog} />
              <View style={styles.footerButton}>
                <Button title="➕ Создать аудит" onPress={() => props.navigation.navigate('CreateAudit')} color="#0066cc" />
                <View style={{ height: 10 }} />
                <Button title="🚪 Выйти" onPress={handleLogout} color="#d9534f" />
              </View>
            </View>
          )}
        </Stack.Screen>

        <Stack.Screen name="AuditChecklist">
        {(props) => (
            <AuditChecklistScreen {...props} addLog={addLog} />
                     )}
        </Stack.Screen>


        <Stack.Screen name="CreateAudit">
          {(props) => (
            <View style={{ flex: 1 }}>
              <CreateAuditScreen {...props} sessionID={sessionID} onBack={() => props.navigation.goBack()} addLog={addLog} />
              <View style={styles.footerButton}>
                <Button title="⬅️ Назад к сотрудникам" onPress={() => props.navigation.navigate('Employees')} color="#666" />
              </View>
            </View>
          )}
        </Stack.Screen>
      </Stack.Navigator>

      {/* Дебаг-панель */}
      <View style={styles.debugPanel}>
        <Text style={styles.debugTitle}>📡 Логи</Text>
        <ScrollView style={styles.logContainer} nestedScrollEnabled={true}>
          {logs.length === 0 ? (
            <Text style={styles.logText}>Логи появятся здесь...</Text>
          ) : (
            logs.slice(-15).map((log, index) => (
              <Text key={index} style={styles.logText}>
                {log}
              </Text>
            ))
          )}
        </ScrollView>
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  debugPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: 180,
    backgroundColor: '#1e1e1e',
    borderTopWidth: 1,
    borderColor: '#444',
    padding: 8,
  },
  debugTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
  },
  logContainer: {
    maxHeight: 140,
  },
  logText: {
    color: '#ccc',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  footerButton: {
    marginHorizontal: 20,
    marginVertical: 8,
  },
});