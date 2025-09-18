import axios from 'axios';

const APP_ID = 'cd03db95-7c1c-42a2-960f-a052c29348df';
const NETWORK_ID = 34200; // ← ТВОЙ РЕАЛЬНЫЙ networkId

/**
 * Авторизация через системный API Directual
 * @param {string} username — email
 * @param {string} password
 * @returns {Promise<string>} sessionID (token)
 */
export const login = async (username, password) => {
  try {
    console.log('📤 Отправка запроса авторизации...');
    console.log('📧 Email:', username);
    console.log('🔑 networkId:', NETWORK_ID);

    const response = await axios.post(
      'https://api.directual.com/good/api/v5/auth',
      {
        appID: APP_ID,
        username: username.trim(),
        password: password.trim(),
        networkId: NETWORK_ID, // ← ОБЯЗАТЕЛЬНО!
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    console.log('✅ Ответ сервера:', response.data);

    if (response.data.status === 'ok' && response.data.result?.token) {
      return response.data.result.token; // ← Это твой sessionID
    } else {
      const errorMsg = response.data.msg || 'Неизвестная ошибка сервера';
      console.error('❌ Ошибка авторизации:', errorMsg);
      throw new Error(errorMsg);
    }
  } catch (err) {
    console.error('🚨 Сетевая ошибка:', err.response?.data || err.message);
    throw new Error(err.response?.data?.msg || 'Ошибка сети или неверные данные');
  }
};