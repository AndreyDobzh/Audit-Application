// AuditChecklistScreen.js
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
  Image,
  Switch,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getWithSession, postWithSession } from '../api/apiClient';

const API_UPLOAD_URL = 'https://lamoda-audit5s.directual.app/api/upload';
const FILE_BASE_URL = 'https://api.directual.com/fileUploaded/';

const fetchAuditQuestions = async (sessionID, sectionId) => {
  return getWithSession(
    'https://api.directual.com/good/api/v5/data/questions/FindQuestionParam',
    sessionID,
    { sectionparam: sectionId }
  );
};

const fetchAQforAudit = async (sessionID, auditId) => {
  return getWithSession(
    'https://api.directual.com/good/api/v5/data/audit_questions/FindAQID',
    sessionID,
    { auditid: auditId }
  );
};

const updateAQ = async (aqId, sessionID, data) => {
  return postWithSession(
    'https://api.directual.com/good/api/v5/data/audit_questions/CreateAQ',
    { id: aqId, ...data },
    sessionID
  );
};

const updateAuditField = async (auditId, sessionID, data) => {
  return postWithSession(
    'https://api.directual.com/good/api/v5/data/audit5s/CreateAudits',
    { id: auditId, ...data },
    sessionID
  );
};

const uploadPhoto = async (localUri) => {
  try {
    let uri = localUri;
    const formData = new FormData();
    formData.append('file', {
      uri,
      name: 'photo.jpg',
      type: 'image/jpeg',
    });
    const response = await fetch(API_UPLOAD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data' },
      body: formData,
    });
    const data = await response.json();
    if (!data?.result?.finalFileName) throw new Error('Сервер не вернул finalFileName');
    return `${FILE_BASE_URL}${data.result.finalFileName}`;
  } catch (err) {
    Alert.alert('Ошибка загрузки фото', err.message);
    throw err;
  }
};

const sendViolationToServer = async (aqId, note, fotoUrl, fix, sessionID) => {
  try {
    return await postWithSession(
      'https://api.directual.com/good/api/v5/data/violations/CreateViolation',
      { audit_question_id: aqId, note, foto: fotoUrl, fix },
      sessionID
    );
  } catch (err) {
    Alert.alert('Ошибка отправки нарушения', err.message);
    throw err;
  }
};

export default function AuditChecklistScreen({ route, navigation, addLog }) {
  const { sessionID, audit } = route.params;
  const [auditState, setAudit] = useState(audit);
  const [auditQuestions, setAuditQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [violations, setViolations] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  useEffect(() => {
    if (!sessionID || !auditState) {
      Alert.alert('Ошибка', 'Нет sessionID или аудита');
      navigation.goBack();
      return;
    }

    let mounted = true;

    const fetchQuestionsAndAQ = async () => {
      try {
        addLog && addLog(`📥 Загружаем вопросы для секции ${auditState.section?.id || '—'}...`);

        const resQuestions = await fetchAuditQuestions(sessionID, auditState.section?.id);
        if (resQuestions.status !== 'OK') throw new Error('Не удалось получить вопросы');

        const questions = resQuestions.payload || [];
        for (let q of questions) {
          try {
            await updateAQ(null, sessionID, {
              audit_id: auditState.id,
              question_id: q.id,
              score: null,
              question_text_snapshot: q.text,
            });
          } catch (err) {
            Alert.alert('Ошибка создания AQ', err.message);
          }
        }

        const resAQ = await fetchAQforAudit(sessionID, auditState.id);
        if (resAQ.status !== 'OK') throw new Error('Не удалось получить AQ');

        const sortedAQ = (resAQ.payload || []).sort((a, b) => {
          const orderA = questions.find(q => q.id === a.question_id)?.sort_order || 0;
          const orderB = questions.find(q => q.id === b.question_id)?.sort_order || 0;
          return orderA - orderB;
        });

        if (mounted) setAuditQuestions(sortedAQ);
      } catch (err) {
        Alert.alert('Ошибка', err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchQuestionsAndAQ();
    return () => { mounted = false; };
  }, [sessionID, auditState]);

  const updateScore = async (aqId, value) => {
    try {
      await updateAQ(aqId, sessionID, { score: value });
      setAuditQuestions(prev => prev.map(aq => (aq.id === aqId ? { ...aq, score: value } : aq)));
    } catch (err) {
      Alert.alert('Ошибка обновления оценки', err.message);
    }
  };

  const takePhoto = async (aqId) => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return Alert.alert('Ошибка', 'Нет доступа к камере');

      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5 });
      if (!result.canceled) return;

      const localPhoto = result.assets[0];
      const newViolation = { foto: localPhoto.uri, note: '', fix: false, audit_question_id: aqId, sent: false, finalUrl: null };
      setViolations(prev => ({ ...prev, [aqId]: [...(prev[aqId] || []), newViolation] }));
    } catch (err) {
      Alert.alert('Ошибка съёмки фото', err.message);
    }
  };

  const updateViolationNote = (aqId, index, text) => {
    setViolations(prev => {
      const updated = [...(prev[aqId] || [])];
      updated[index].note = text;
      return { ...prev, [aqId]: updated };
    });
  };

  const toggleFix = (aqId, index) => {
    setViolations(prev => {
      const updated = [...(prev[aqId] || [])];
      updated[index].fix = !updated[index].fix;
      return { ...prev, [aqId]: updated };
    });
  };

  const deleteViolation = (aqId, index) => {
    setViolations(prev => {
      const updated = [...(prev[aqId] || [])];
      updated.splice(index, 1);
      return { ...prev, [aqId]: updated };
    });
  };

  const submitAudit = async () => {
    setSubmitting(true);
    setUploadingPhotos(true);
    try {
      // Сохраняем оценки
      await Promise.all(auditQuestions.map(aq => updateAQ(aq.id, sessionID, { score: aq.score })));

      // Загружаем нарушения и фото
      for (const aqId of Object.keys(violations)) {
        for (let i = 0; i < violations[aqId].length; i++) {
          const v = violations[aqId][i];
          if (!v.finalUrl) {
            const fotoUrl = await uploadPhoto(v.foto);
            await sendViolationToServer(aqId, v.note, fotoUrl, v.fix, sessionID);
            v.sent = true;
            v.finalUrl = fotoUrl;
          }
        }
      }

      // Обновляем поле EndTime аудита
      const isoWithMsZ = new Date().toISOString().split('.')[0] + '.000Z';
      await updateAuditField(auditState.id, sessionID, { EndTime: isoWithMsZ });

      Alert.alert('Успех', 'Аудит завершен, все фото и оценки сохранены');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Ошибка', err.message);
    } finally {
      setSubmitting(false);
      setUploadingPhotos(false);
    }
  };

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
      <Text style={styles.title}>Аудит: {auditState.id}</Text>
      <Text style={styles.subtitle}>Аудитор: {auditState.creator?.lastName || '—'}</Text>
      <Text style={styles.subtitle}>Аудируемый: {auditState.auditee?.second_name || '—'}</Text>
      <Text style={styles.subtitle}>Секция: {auditState.section?.name || '—'}</Text>

      {auditQuestions.map((aq, index) => (
        <View key={aq.id} style={styles.questionItem}>
          <Text style={styles.questionText}>{index + 1}. {aq.question_text_snapshot}</Text>
          <TextInput
            style={styles.input}
            placeholder="Введите оценку"
            keyboardType="numeric"
            value={aq.score ? aq.score.toString() : ''}
            onChangeText={val => updateScore(aq.id, val)}
          />
          <Button title="➕ Добавить несоответствие" onPress={() => takePhoto(aq.id)} />

          {(violations[aq.id] || []).map((v, idx) => (
            <View key={idx} style={styles.violationBlock}>
              <Image source={{ uri: v.foto }} style={styles.image} />
              <TextInput
                style={styles.noteInput}
                placeholder="Описание нарушения"
                value={v.note}
                onChangeText={text => updateViolationNote(aq.id, idx, text)}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <Text>Устранено</Text>
                <Switch value={v.fix} onValueChange={() => toggleFix(aq.id, idx)} />
              </View>
              <Button title="Удалить несоответствие" color="#dc3545" onPress={() => deleteViolation(aq.id, idx)} />
            </View>
          ))}
        </View>
      ))}

      {(submitting || uploadingPhotos) && (
        <View style={{ marginVertical: 20, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={{ marginTop: 10 }}>{uploadingPhotos ? 'Загрузка фото...' : 'Завершаем аудит...'}</Text>
        </View>
      )}

      <View style={styles.submitButtonContainer}>
        <Button
          title={submitting ? "Отправка..." : "🏁 Завершить аудит"}
          onPress={submitAudit}
          disabled={submitting || uploadingPhotos}
          color="#28a745"
        />
      </View>
      <View style={styles.bottomSpacer} />
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
  noteInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 8, marginBottom: 5 },
  submitButtonContainer: { marginTop: 30, marginBottom: 20 },
  bottomSpacer: { height: 300 },
});
