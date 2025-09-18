// CreateAuditScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  Button,
  ActivityIndicator,
} from 'react-native';
import { getWithSession, postWithSession } from '../api/apiClient';
import PickerInput from '../components/PickerInput';

export default function CreateAuditScreen({ route, navigation, addLog }) {
  const { sessionID } = route.params;
  const [employees, setEmployees] = useState([]);
  const [sections, setSections] = useState([]);
  const [auditor, setAuditor] = useState(null);
  const [auditee, setAuditee] = useState(null);
  const [section, setSection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

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
        addLog && addLog('📥 Загружаем сотрудников...');
        const resEmployees = await getWithSession(
          'https://api.directual.com/good/api/v5/data/employees/GetAllEmployees',
          sessionID,
          { pageSize: 200 }
        );

        if (resEmployees && resEmployees.status === 'OK' && Array.isArray(resEmployees.payload)) {
          if (!mounted) return;
          setEmployees(resEmployees.payload);
        } else {
          throw new Error(`Некорректный ответ сотрудников: ${JSON.stringify(resEmployees)}`);
        }

        addLog && addLog('📥 Загружаем секции...');
        const resSections = await getWithSession(
          'https://api.directual.com/good/api/v5/data/sections/GetSectionsName',
          sessionID
        );

        if (resSections && resSections.status === 'OK' && Array.isArray(resSections.payload)) {
          if (!mounted) return;
          setSections(resSections.payload);
        } else {
          throw new Error(`Некорректный ответ секций: ${JSON.stringify(resSections)}`);
        }
      } catch (err) {
        Alert.alert('Ошибка', `Не удалось загрузить справочники: ${err.message}`);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [sessionID]);

  const handleCreate = async () => {
    if (!auditor || !auditee || !section) {
      Alert.alert('Ошибка', 'Заполните все поля: аудитор, аудируемый, секция');
      return;
    }

    setCreating(true);
    try {
      const now = new Date();
      const isoWithMsZ = now.toISOString().split('.')[0] + '.000Z';

      const dataToSend = {
        auditor,
        auditee,
        section,
        StartTime: isoWithMsZ,
      };

      addLog && addLog(`📤 CreateAudits payload: ${JSON.stringify(dataToSend)}`);

      const res = await postWithSession(
        'https://api.directual.com/good/api/v5/data/audit5s/CreateAudits',
        dataToSend,
        sessionID
      );

      // Выводим весь ответ API
      Alert.alert('Полный ответ API', JSON.stringify(res, null, 2));

      // Берём auditId из ответа
      const auditId = res?.result?.[0]?.id || res?.auditId;
      if (!auditId) throw new Error('auditId не найден в ответе API');

      // Выводим auditId отдельным алертом
      Alert.alert('auditId', auditId);

      // Переходим на чек-лист
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

  const employeeItems = employees.map(emp => ({
    label: `${emp.second_name || emp.lastName || ''} ${emp.name || emp.firstName || ''}`.trim(),
    value: emp.id || emp._id || emp.objId || emp.uuid,
  }));

  const sectionItems = sections.map(s => ({
    label: s.name || s.title || s.sectionName || JSON.stringify(s),
    value: s.id || s._id || s.value || s.name,
  }));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Создать аудит</Text>

      <PickerInput label="Аудитор" selectedValue={auditor} onValueChange={setAuditor} items={employeeItems} />
      <PickerInput label="Аудируемый" selectedValue={auditee} onValueChange={setAuditee} items={employeeItems} />
      <PickerInput label="Секция" selectedValue={section} onValueChange={setSection} items={sectionItems} />

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
