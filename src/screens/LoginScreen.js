// LoginScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, Button, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { login } from '../utils/auth';

export default function LoginScreen({ addLog }) {
  // ✅ Предзаполненные значения
  const [email, setEmail] = useState('wvertx@gmail.com');
  const [password, setPassword] = useState('11');
  const [loading, setLoading] = useState(false);

  const navigation = useNavigation();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Ошибка', 'Введите email и пароль');
      return;
    }

    setLoading(true);
    addLog && addLog(`🔐 Попытка входа: ${email}`);
    try {
      const sessionID = await login(email, password);
      if (!sessionID) throw new Error('Сервер не вернул sessionID');

      addLog && addLog(`✅ Успешный вход. sessionID: ${sessionID.substring(0, 10)}...`);
      navigation.navigate('Employees', { sessionID });
    } catch (err) {
      console.error('Login error:', err);
      let msg = err.message || 'Не удалось войти';
      if (err.response && err.response.data) {
        msg = JSON.stringify(err.response.data);
      }
      addLog && addLog(`❌ Ошибка входа: ${msg}`);
      Alert.alert('Ошибка входа', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Вход в систему</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Пароль"
        value={password}
        secureTextEntry
        onChangeText={setPassword}
      />
      {loading ? (
        <ActivityIndicator size="large" color="#0066cc" />
      ) : (
        <Button title="Войти" onPress={handleLogin} color="#0066cc" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 15, borderRadius: 8 },
});
