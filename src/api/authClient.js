// src/api/authClient.js
import axios from 'axios';

export const login = async ({
  username,
  password,
  appID,
  networkId,
  apiKey
}) => {
  if (!username || !password) throw new Error("Введите логин и пароль");

  const AUTH_URL = 'https://api.directual.com/good/api/v5/auth';

  try {
    const response = await axios.post(AUTH_URL, {
      username,
      password,
      appID,
      networkId,
      apiKey,
    });

    console.log("✅ Directual login response:", response.data);

    if (response.data.status === 'ok' && response.data.result?.token) {
      return response.data.result.token; // sessionID
    } else {
      throw new Error(
        response.data.msg || `Не удалось авторизоваться: ${JSON.stringify(response.data)}`
      );
    }
  } catch (error) {
    if (error.response) {
      console.error("🔴 Directual API error:", error.response.status, error.response.data);
      throw new Error(`Ошибка ${error.response.status}: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error("🔴 Network / axios error:", error.message);
      throw new Error("Сетевая ошибка: " + error.message);
    }
  }
};
