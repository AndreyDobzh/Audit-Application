import axios from 'axios';

const APP_ID = 'cd03db95-7c1c-42a2-960f-a052c29348df';
const NETWORK_ID = 34200;

export const getWithSession = async (url, sessionID, params = {}) => {
  if (!sessionID) throw new Error('sessionID не передан');

  try {
    const fullUrl = url.trim();
    const response = await axios.get(fullUrl, {
      params: {
        appID: APP_ID,
        sessionID,
        networkId: NETWORK_ID,
        ...params,
      },
    });
    return response.data;
  } catch (error) {
    console.error('GET-запрос не удался:', error.response?.data || error.message);
    throw error;
  }
};

export const postWithSession = async (url, data, sessionID, params = {}) => {
  if (!sessionID) throw new Error('sessionID не передан');

  try {
    const fullUrl = url.trim();
    const response = await axios.post(fullUrl, data, {
      params: {
        appID: APP_ID,
        sessionID,
        networkId: NETWORK_ID,
        ...params,
      },
    });
    return response.data;
  } catch (error) {
    console.error('POST-запрос не удался:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Создание записи — structure = имя структуры в Directual
 */
export const createRecord = async (structure, data, sessionID) => {
  try {
    // 🔁 URL должен соответствовать структуре — например: /audits/CreateAudits
    const response = await postWithSession(
      `https://api.directual.com/good/api/v5/data/${structure}/CreateAudits`,
      data,
      sessionID
    );
    return response;
  } catch (error) {
    console.error('Ошибка создания записи:', error.response?.data || error.message);
    throw error;
  }
};