// AuditChecklistScreen.js ++++++++
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
  Button, 
  Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getWithSession, postWithSession } from '../api/apiClient';

export default function AuditChecklistScreen({ route, navigation, addLog }) {
  const { sessionID, audit } = route.params;
  const [auditState, setAudit] = useState(audit);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [violations, setViolations] = useState({}); 

  useEffect(() => {
    if (!sessionID || !auditState) {
      Alert.alert('Ошибка', 'Нет sessionID или аудита');
      navigation.goBack();
      return;
    }

    const fetchAndCreateAQ = async () => {
      try {
        addLog && addLog(`📥 Загружаем вопросы секции ${auditState.section?.id || '—'}...`);
        // GET вопросов по секции
        const resQuestions = await getWithSession(
          'https://api.directual.com/good/api/v5/data/questions/GetAllQuestions',
          sessionID,
          { filter: JSON.stringify({ section_id: auditState.section?.id, is_active: true }) }
        );

        if (resQuestions.status === 'OK' && Array.isArray(resQuestions.payload)) {
          const sorted = resQuestions.payload.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
          setQuestions(sorted);

          // Создаем audit_questions для каждого вопроса
          for (let i = 0; i < sorted.length; i++) {
            const q = sorted[i];
            const dataAQ = {
              audit_id: auditState.id,
              question_id: q.id,
              score: null,
              sort_order: i + 1,
              question_text_snapshot: q.text
            };
            try {
              const res = await postWithSession(
                'https://api.directual.com/good/api/v5/data/audit_questions/CreateAQ',
                dataAQ,
                sessionID
              );
              addLog && addLog(`Создан AQ для вопроса ${i + 1}: ${res.result?.id}`);
            } catch (err) {
              addLog && addLog(`❌ Ошибка создания AQ: ${err.message}`);
            }
          }

          // ++++++++++++++++++++++++++++++++++++++++++++++
          // После создания получаем все AQ для этого аудита через фильтр
          const resAQ = await getWithSession(
            'https://api.directual.com/good/api/v5/data/audit_questions/GetAllAQ',
            sessionID,
            { filter: JSON.stringify({ audit_id: auditState.id }) }
          );

          if (resAQ.status === 'OK' && Array.isArray(resAQ.result)) {
            const sortedAQ = resAQ.result.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
            const aqIds = sortedAQ.map(q => q.id).filter(Boolean);

            // Алерт с количеством AQ
            Alert.alert('Количество AQ', `${aqIds.length} AQ найдено после фильтра`);
            // Алерт со списком ID
            Alert.alert('Audit Question IDs', aqIds.join(', '));

            // Записываем их в questions для дальнейшего использования
            setQuestions(sortedAQ);
          }
          // ++++++++++++++++++++++++++++++++++++++++++++++
        }
      } catch (err) {
        addLog && addLog(`❌ Ошибка: ${err.message}`);
        Alert.alert('Ошибка', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAndCreateAQ();
  }, [sessionID, auditState]);

  const updateScore = async (aqId, value) => {
    try {
      await postWithSession(
        'https://api.directual.com/good/api/v5/data/audit_questions/CreateAQ',
        { id: aqId, score: value },
        sessionID
      );
      addLog && addLog(`✅ Обновлён score для ${aqId}: ${value}`);
    } catch (err) {
      addLog && addLog(`❌ Ошибка обновления score: ${err.message}`);
    }
  };

  // ++++++++++++++++++++++++++++++++++++++++++++++
  const addViolation = async (aqId) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Ошибка', 'Нет доступа к камере');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (!result.canceled) {
      const newViolation = { foto: result.assets[0].uri, note: '', audit_question_id: aqId, sent: false };
      setViolations((prev) => ({
        ...prev,
        [aqId]: [...(prev[aqId] || []), newViolation]
      }));
    }
  };

  const updateViolationNote = (aqId, index, text) => {
    setViolations((prev) => {
      const updated = [...(prev[aqId] || [])];
      updated[index].note = text;
      return { ...prev, [aqId]: updated };
    });
  };

  const sendViolation = async (aqId, index) => {
    const v = violations[aqId][index];
    if (!v || v.sent) return;

    try {
      const res = await postWithSession(
        'https://api.directual.com/good/api/v5/data/violations/CreateViolation',
        {
          audit_question_id: aqId,
          foto: v.foto,
          note: v.note
        },
        sessionID
      );

      addLog && addLog(`📤 Нарушение отправлено для ${aqId}`);
      const updated = [...violations[aqId]];
      updated[index].sent = true;
      setViolations(prev => ({ ...prev, [aqId]: updated }));
    } catch (err) {
      Alert.alert('Ошибка', `Не удалось отправить нарушение: ${err.message}`);
    }
  };
  // ++++++++++++++++++++++++++++++++++++++++++++++

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Загрузка вопросов...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {auditState && (
        <>
          <Text style={styles.title}>Аудит: {auditState.id}</Text>
          <Text style={styles.subtitle}>Аудитор: {auditState.auditor?.name || '—'}</Text>
          <Text style={styles.subtitle}>Аудируемый: {auditState.auditee?.name || '—'}</Text>
          <Text style={styles.subtitle}>Секция: {auditState.section?.name || '—'}</Text>
        </>
      )}

      <Text style={[styles.title, { marginTop: 20 }]}>Вопросы</Text>
      {questions.map((q, index) => (
        <View key={q.id || index} style={styles.questionItem}>
          <Text style={styles.questionText}>{index + 1}. {q.text}</Text>

          <TextInput
            style={styles.input}
            placeholder="Введите оценку"
            keyboardType="numeric"
            onChangeText={(val) => updateScore(q.id, val)}
          />

          <View style={{ marginTop: 10 }}>
            <Button title="➕ Добавить нарушение" onPress={() => addViolation(q.id)} />
            {(violations[q.id] || []).map((v, idx) => (
              <View key={idx} style={styles.violationBlock}>
                <Image source={{ uri: v.foto }} style={styles.image} />
                <TextInput
                  style={styles.noteInput}
                  placeholder="Описание нарушения"
                  value={v.note}
                  onChangeText={(text) => updateViolationNote(q.id, idx, text)}
                />
                <Button
                  title={v.sent ? 'Отправлено' : 'Отправить нарушение'}
                  onPress={() => sendViolation(q.id, idx)}
                  disabled={v.sent}
                  color={v.sent ? '#6c757d' : '#28a745'}
                />
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 5, textAlign: 'center' },
  subtitle: { fontSize: 16, marginBottom: 3, textAlign: 'center', color: '#555' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#555' },
  questionItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  questionText: { fontSize: 16, color: '#333', marginBottom: 10 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 8, marginBottom: 10 },
  violationBlock: { marginTop: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 10 },
  image: { width: '100%', height: 150, marginBottom: 10, borderRadius: 6 },
  noteInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 8, marginBottom: 5 }
});
