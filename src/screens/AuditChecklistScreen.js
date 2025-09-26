// AuditChecklistScreen.js
import React, { useState, useEffect } from "react";
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
  Modal,
  Switch,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { getWithSession, postWithSession } from "../api/apiClient";
import PickerInput from "../components/PickerInput";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_UPLOAD_URL = "https://lamoda-audit5s.directual.app/api/upload";
const FILE_BASE_URL = "https://api.directual.com/fileUploaded/";

// API helpers
const fetchAuditQuestions = async (sessionID, sectionId) => {
  return getWithSession(
    "https://api.directual.com/good/api/v5/data/questions/FindQuestionParam",
    sessionID,
    { sectionparam: sectionId }
  );
};

const fetchAQforAudit = async (sessionID, auditId) => {
  return getWithSession(
    "https://api.directual.com/good/api/v5/data/audit_questions/FindAQID",
    sessionID,
    { auditid: auditId }
  );
};

const updateAQ = async (aqId, sessionID, data) => {
  return postWithSession(
    "https://api.directual.com/good/api/v5/data/audit_questions/CreateAQ",
    { id: aqId, ...data },
    sessionID
  );
};

const updateAuditField = async (auditId, sessionID, data) => {
  return postWithSession(
    "https://api.directual.com/good/api/v5/data/audit5s/CreateAudits",
    { id: auditId, ...data },
    sessionID
  );
};

const uploadPhoto = async (localUri) => {
  const formData = new FormData();
  formData.append("file", { uri: localUri, type: "image/jpeg", name: "photo.jpg" });

  const response = await fetch(API_UPLOAD_URL, {
    method: "POST",
    headers: { "Content-Type": "multipart/form-data" },
    body: formData,
  });

  const text = await response.text();
  const data = JSON.parse(text);
  if (!data?.result?.finalFileName)
    throw new Error("Сервер не вернул finalFileName");
  return `${FILE_BASE_URL}${data.result.finalFileName}`;
};

const fetchSubAnswers = async (sessionID, questionId) => {
  const res = await getWithSession(
    "https://api.directual.com/good/api/v5/data/sub_answer/GetFindSubAnswers",
    sessionID,
    { ParamQuestion: questionId }
  );
  if (res.status !== "OK") throw new Error("Не удалось получить sub_answers");
  return res.payload || [];
};

const sendViolationToServer = async (violation, sessionID) => {
  return postWithSession(
    "https://api.directual.com/good/api/v5/data/violations/CreateViolation",
    {
      audit_question_id: violation.audit_question_id,
      note: violation.note || "",
      foto: violation.uploadedUrl,
      fix: !!violation.fix,
      sub_answer_id: violation.sub_answer_id || null,
      time: violation.time,
    },
    sessionID
  );
};

// Local storage helpers
const LOCAL_VIOLATIONS_KEY = (auditId) => `violations_${auditId}`;

const saveViolationsLocally = async (auditId, violations) => {
  try {
    await AsyncStorage.setItem(LOCAL_VIOLATIONS_KEY(auditId), JSON.stringify(violations));
  } catch (err) {
    console.error("Ошибка сохранения локальных violations:", err.message);
  }
};

const loadViolationsLocally = async (auditId) => {
  try {
    const data = await AsyncStorage.getItem(LOCAL_VIOLATIONS_KEY(auditId));
    return data ? JSON.parse(data) : {};
  } catch (err) {
    console.error("Ошибка загрузки локальных violations:", err.message);
    return {};
  }
};

// Component
export default function AuditChecklistScreen({ route, navigation }) {
  const { sessionID, audit } = route.params;
  const [auditState, setAudit] = useState(audit);
  const [auditQuestions, setAuditQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [violations, setViolations] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [subAnswerCache, setSubAnswerCache] = useState({});

  useEffect(() => {
    if (!sessionID || !auditState) {
      Alert.alert("Ошибка", "Нет sessionID или аудита");
      navigation.goBack();
      return;
    }

    let mounted = true;

    const fetchQuestionsAndAQ = async () => {
      try {
        const resQuestions = await fetchAuditQuestions(sessionID, auditState.section?.id);
        if (resQuestions.status !== "OK") throw new Error("Не удалось получить вопросы");
        const questions = resQuestions.payload || [];

        const resAQ = await fetchAQforAudit(sessionID, auditState.id);
        if (resAQ.status !== "OK") throw new Error("Не удалось получить AQ");
        const existingAQs = resAQ.payload || [];
        const existingAQIds = existingAQs.map(aq => aq.question_id);

        // Создаем только недостающие
        for (let q of questions) {
          if (!existingAQIds.includes(q.id)) {
            await updateAQ(null, sessionID, {
              audit_id: auditState.id,
              question_id: q.id,
              score: null,
              question_text_snapshot: q.text,
            });
          }
        }

        const refreshedAQ = await fetchAQforAudit(sessionID, auditState.id);
        if (refreshedAQ.status !== "OK") throw new Error("Не удалось получить обновленные AQ");
        const sortedAQ = (refreshedAQ.payload || []).sort((a, b) => {
          const orderA = questions.find(q => q.id === a.question_id)?.sort_order || 0;
          const orderB = questions.find(q => q.id === b.question_id)?.sort_order || 0;
          return orderA - orderB;
        });
        if (mounted) setAuditQuestions(sortedAQ);

        const localViolations = await loadViolationsLocally(auditState.id);
        if (mounted && localViolations) setViolations(localViolations);

      } catch (err) {
        Alert.alert("Ошибка", err.message);
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
      setAuditQuestions(prev => prev.map(aq => aq.id === aqId ? { ...aq, score: value } : aq));
    } catch {}
  };

  const addViolation = async (aq) => {
    const camPerm = await ImagePicker.requestCameraPermissionsAsync();
    const libPerm = await MediaLibrary.requestPermissionsAsync();
    if (!camPerm.granted || !libPerm.granted) {
      Alert.alert("Ошибка", "Нет доступа к камере или библиотеке");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (result.canceled) return;

    const localUri = result.assets[0].uri;
    const asset = await MediaLibrary.createAssetAsync(localUri);
    const uriToShow = Platform.OS === "ios" ? localUri : asset.uri;

    let subAnswers = subAnswerCache[aq.question_id];
    if (!subAnswers) {
      try {
        subAnswers = await fetchSubAnswers(sessionID, aq.question_id);
        setSubAnswerCache(prev => ({ ...prev, [aq.question_id]: subAnswers }));
      } catch {
        subAnswers = [];
      }
    }

    const newViolation = {
      foto_device: uriToShow,
      foto: null,
      note: "",
      fix: false,
      audit_question_id: aq.id,
      question_id: aq.question_id,
      sub_answer_id: null,
      subAnswers,
      uploadedUrl: null,
      sent: false,
      time: new Date().toISOString(), // фиксируем момент фото
    };

    setViolations(prev => {
      const updated = { ...prev, [aq.id]: [...(prev[aq.id] || []), newViolation] };
      saveViolationsLocally(auditState.id, updated);
      return updated;
    });
  };

  const updateViolationField = (aqId, idx, field, value) => {
    setViolations(prev => {
      const updatedArr = [...(prev[aqId] || [])];
      updatedArr[idx][field] = value;
      const updated = { ...prev, [aqId]: updatedArr };
      saveViolationsLocally(auditState.id, updated);
      return updated;
    });
  };

  const deleteViolation = (aqId, idx) => {
    setViolations(prev => {
      const updatedArr = [...(prev[aqId] || [])];
      updatedArr.splice(idx, 1);
      const updated = { ...prev, [aqId]: updatedArr };
      saveViolationsLocally(auditState.id, updated);
      return updated;
    });
  };

  const submitAudit = async () => {
    setSubmitting(true);
    setUploading(true);
    try {
      for (const aq of auditQuestions) {
        await updateAQ(aq.id, sessionID, { score: aq.score });
      }

      for (const aqId of Object.keys(violations)) {
        for (const v of violations[aqId]) {
          try {
            if (!v.uploadedUrl && v.foto_device) {
              v.uploadedUrl = await uploadPhoto(v.foto_device);
              await sendViolationToServer(v, sessionID);
              v.sent = true;
            }
          } catch (err) {
            console.error("Ошибка загрузки или отправки violation:", err.message);
          }
        }
      }

      const now = new Date();
      const isoWithMsZ = now.toISOString().split(".")[0] + ".000Z";
      await updateAuditField(auditState.id, sessionID, { EndTime: isoWithMsZ });

      Alert.alert("Успех", "Аудит завершен и все данные сохранены");
      navigation.goBack();
    } catch (err) {
      Alert.alert("Ошибка", `Не удалось завершить аудит: ${err.message}`);
    } finally {
      setSubmitting(false);
      setUploading(false);
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
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Аудит: {auditState.id}</Text>
        <Text style={styles.subtitle}>Аудитор: {auditState.auditor?.name || "—"}</Text>
        <Text style={styles.subtitle}>Аудируемый: {auditState.auditee?.name || "—"}</Text>
        <Text style={styles.subtitle}>Секция: {auditState.section?.name || "—"}</Text>

        <Text style={[styles.title, { marginTop: 20 }]}>Вопросы</Text>

        {auditQuestions.map((aq, index) => (
          <View key={aq.id} style={styles.questionItem}>
            <Text style={styles.questionText}>{index + 1}. {aq.question_text_snapshot}</Text>
            <TextInput
              style={styles.input}
              placeholder="Введите оценку"
              keyboardType="numeric"
              value={aq.score ? aq.score.toString() : ""}
              onChangeText={val => updateScore(aq.id, val)}
            />
            <View style={{ marginTop: 10 }}>
              <Button title="➕ Добавить нарушение" onPress={() => addViolation(aq)} />
              {(violations[aq.id] || []).map((v, idx) => (
                <View key={idx} style={styles.violationBlock}>
                  <Image source={{ uri: v.foto_device }} style={styles.image} />
                  <TextInput
                    style={styles.noteInput}
                    placeholder="Описание нарушения"
                    value={v.note}
                    onChangeText={text => updateViolationField(aq.id, idx, "note", text)}
                  />
                  <View style={styles.switchRow}>
                    <Text>Исправлено:</Text>
                    <Switch
                      value={v.fix}
                      onValueChange={val => updateViolationField(aq.id, idx, "fix", val)}
                    />
                  </View>
                  {v.subAnswers?.length > 0 && (
                    <PickerInput
                      label="Предварительный ответ"
                      selectedValue={v.sub_answer_id}
                      onValueChange={val => updateViolationField(aq.id, idx, "sub_answer_id", val)}
                      items={v.subAnswers.map(sa => ({ label: sa.text, value: sa.id }))}
                    />
                  )}
                  <Button
                    title="Удалить"
                    color="#dc3545"
                    onPress={() => deleteViolation(aq.id, idx)}
                  />
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.submitButtonContainer}>
          <Button
            title={submitting ? "Отправка..." : "🏁 Завершить аудит"}
            onPress={submitAudit}
            disabled={submitting}
            color="#28a745"
          />
        </View>
        <View style={styles.bottomSpacer} />
      </ScrollView>

      <Modal visible={uploading} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <ActivityIndicator size="large" color="#007bff" />
            <Text style={{ marginTop: 10 }}>Загрузка фото...</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 5, textAlign: "center" },
  subtitle: { fontSize: 16, marginBottom: 3, textAlign: "center", color: "#555" },
  loadingText: { marginTop: 10, fontSize: 16, color: "#555" },
  questionItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "#eee" },
  questionText: { fontSize: 16, color: "#333", marginBottom: 10 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 8, marginBottom: 10 },
  violationBlock: { marginTop: 10, borderWidth: 1, borderColor: "#ddd", borderRadius: 6, padding: 10 },
  image: { width: "100%", height: 150, marginBottom: 10, borderRadius: 6 },
  noteInput: { borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 8, marginBottom: 10 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  submitButtonContainer: { marginTop: 30, marginBottom: 20 },
  bottomSpacer: { height: 300 },
  modalContainer: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  modalContent: { backgroundColor: "white", padding: 20, borderRadius: 8, alignItems: "center" },
});
