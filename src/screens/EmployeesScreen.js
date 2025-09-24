// HomeScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, Button, ActivityIndicator, TouchableOpacity } from 'react-native';
import { getWithSession } from '../api/apiClient';

export default function HomeScreen({ route, navigation, addLog }) {
  const { sessionID } = route.params;
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionID) {
      Alert.alert('Ошибка', 'Нет sessionID');
      navigation.navigate('Login');
      return;
    }

    const fetchAudits = async () => {
      try {
        addLog && addLog('📥 Запрос незавершённых аудитов...');
        const res = await getWithSession(
          'https://api.directual.com/good/api/v5/data/audit5s/NoEndAudits',
          sessionID
        );

        addLog && addLog(`✅ Ответ: статус ${res.status}, записей: ${res.payload?.length || 0}`);

        if (res.status === 'OK' && Array.isArray(res.payload)) {
          setAudits(res.payload);
        } else {
          throw new Error('Некорректный ответ от сервера');
        }
      } catch (err) {
        addLog && addLog(`❌ Ошибка загрузки аудитов: ${err.message}`);
        Alert.alert('Ошибка', 'Не удалось загрузить аудиты');
      } finally {
        setLoading(false);
      }
    };

    fetchAudits();
  }, [sessionID]);

  // 📅 Форматируем дату красиво
  const formatDate = (isoString) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    return date.toLocaleDateString('ru-RU', options);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Загрузка аудитов...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Незавершённые аудиты</Text>

      {audits.length === 0 ? (
        <Text style={styles.noData}>Нет данных</Text>
      ) : (
        audits.map((audit) => (
          <TouchableOpacity
            key={audit.id}
            style={styles.auditBlock}
            onPress={() => navigation.navigate('AuditChecklist', { sessionID, audit })}
          >
            <View style={styles.auditItem}>
              <Text style={styles.auditText}><Text style={styles.label}>Дата начала:</Text> {formatDate(audit.StartTime)}</Text>
              <Text style={styles.auditText}><Text style={styles.label}>Секция:</Text> {audit.section?.name || '—'}</Text>
              <Text style={styles.auditText}><Text style={styles.label}>Аудируемый:</Text> {audit.auditee?.second_name || '—'}</Text>
              <Text style={styles.auditText}><Text style={styles.label}>Создатель:</Text> {audit.creator?.lastName || '—'}</Text>  
            </View>
          </TouchableOpacity>
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
  container: { flexGrow: 1, padding: 20, backgroundColor: '#e6f0ff' }, // светло-синий фон
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }, // ниже, чуть меньше
  loadingText: { marginTop: 10, fontSize: 14, color: '#555' },
  auditBlock: { marginBottom: 12, padding: 6, backgroundColor: '#cce0ff', borderRadius: 10 }, // блок со светло-синим фоном
  auditItem: {
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  auditText: { fontSize: 12, color: '#333', marginBottom: 2, lineHeight: 16 }, // меньше шрифт и расстояние между строчками
  label: { fontWeight: '600' },
  noData: { textAlign: 'center', fontSize: 14, color: '#888', marginTop: 20 },
  buttonContainer: { marginTop: 20, marginHorizontal: 20 },
});
