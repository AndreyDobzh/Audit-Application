// CreateAuditScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, Button, ActivityIndicator } from 'react-native';
import { getWithSession, postWithSession } from '../api/apiClient';
import PickerInput from '../components/PickerInput';

export default function CreateAuditScreen({ route, navigation, addLog }) {
  const { sessionID } = route.params;

  const [sections, setSections] = useState([]);
  const [auditeeList, setAuditeeList] = useState([]);
  const [auditee, setAuditee] = useState(null);
  const [section, setSection] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  useEffect(() => {
    if (!sessionID) {
      Alert.alert('Ошибка', 'Нет sessionID');
      navigation.navigate('Login');
      return;
    }

    let mounted = true;
    setLoading(true);

    (async () => {
      try {
        // 🔹 Загружаем секции
        addLog && addLog('📥 Загружаем секции...');
        const resSections = await getWithSession(
          'https://api.directual.com/good/api/v5/data/sections/GetSectionsName',
          sessionID
        );
        if (resSections?.status === 'OK' && Array.isArray(resSections.payload)) {
          if (!mounted) return;
          setSections(resSections.payload);
        } else {
          throw new Error(`Некорректный ответ секций: ${JSON.stringify(resSections)}`);
        }

        // 🔹 Получаем текущего пользователя (creator)
        addLog && addLog('📥 Получаем текущего пользователя...');
        const resCurrentUser = await getWithSession(
          'https://api.directual.com/good/api/v5/data/WebUser/FindCurrentUser',
          sessionID
        );
        if (resCurrentUser?.status === 'OK' && Array.isArray(resCurrentUser.payload) && resCurrentUser.payload.length > 0) {
          setCurrentUserId(resCurrentUser.payload[0].id);
          addLog && addLog(`Текущий пользователь: ${resCurrentUser.payload[0].id}`);
        } else {
          throw new Error(`Не удалось получить текущего пользователя: ${JSON.stringify(resCurrentUser)}`);
        }
      } catch (err) {
        Alert.alert('Ошибка', `Не удалось загрузить справочники: ${err.message}`);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [sessionID]);

  // 🔹 При выборе секции загружаем сотрудников этой секции
  const onSectionChange = async (selectedSectionId) => {
    setSection(selectedSectionId);
    setAuditee(null);
    setLoadingEmployees(true);
    try {
      const res = await getWithSession(
        'https://api.directual.com/good/api/v5/data/employees/FindSectionEmployee',
        sessionID,
        { SectionParam: selectedSectionId }
      );
      if (res?.status === 'OK' && Array.isArray(res.payload)) {
        setAuditeeList(res.payload);
        addLog && addLog(`Найдено сотрудников: ${res.payload.length}`);
      } else {
        setAuditeeList([]);
        addLog && addLog(`Некорректный ответ сотрудников: ${JSON.stringify(res)}`);
      }
    } catch (err) {
      Alert.alert('Ошибка', `Не удалось загрузить сотрудников: ${err.message}`);
      setAuditeeList([]);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleCreate = async () => {
    if (!auditee || !section || !currentUserId) {
      Alert.alert('Ошибка', 'Заполните все поля: секция, аудируемый и дождитесь загрузки текущего пользователя');
      return;
    }

    setCreating(true);
    try {
      const now = new Date();
      const isoWithMsZ = now.toISOString().split('.')[0] + '.000Z';

      const dataToSend = {
        auditee,       // ID сотрудника
        section,       // ID секции
        StartTime: isoWithMsZ,
        creator: currentUserId, // ID текущего пользователя (creator)
      };

      addLog && addLog(`📤 CreateAudits payload: ${JSON.stringify(dataToSend)}`);

      const res = await postWithSession(
        'https://api.directual.com/good/api/v5/data/audit5s/CreateAudits',
        dataToSend,
        sessionID
      );

      Alert.alert('Полный ответ API', JSON.stringify(res, null, 2));

      const auditId = res?.result?.[0]?.id || res?.auditId;
      if (!auditId) throw new Error('auditId не найден в ответе API');

      navigation.navigate('AuditChecklist', { sessionID, audit: res.result?.[0] });
    } catch (err) {
      Alert.alert('Ошибка', `Не удалось создать аудит: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Загрузка справочников...</Text>
      </View>
    );
  }

  const sectionItems = sections.map(s => ({
    label: s.name || s.title || JSON.stringify(s),
    value: s.id || s._id,
  }));

  const auditeeItems = auditeeList.map(emp => ({
    label: `${emp.second_name || ''} ${emp.name || ''}`.trim(),
    value: emp.id,
  }));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Создать аудит</Text>

      <PickerInput
        label="Секция"
        selectedValue={section}
        onValueChange={onSectionChange}
        items={sectionItems}
      />

      {loadingEmployees ? (
        <ActivityIndicator size="small" color="#0066cc" style={{ marginVertical: 10 }} />
      ) : (
        <PickerInput
          label="Аудируемый"
          selectedValue={auditee}
          onValueChange={setAuditee}
          items={auditeeItems}
          disabled={!section || auditeeItems.length === 0}
        />
      )}

      <View style={{ marginTop: 18 }}>
        <Button title={creating ? 'Создание...' : 'Создать аудит'} onPress={handleCreate} color="#0066cc" disabled={creating} />
      </View>

      <View style={{ height: 8 }} />
      <Button title="Назад" onPress={() => navigation.goBack()} color="#666" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#555' },
});
