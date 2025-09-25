import axios from 'axios';

const base = import.meta.env.VITE_API_BASE_URL ?? '/api';
const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;

export const apiBaseURL = normalizedBase;

export const api = axios.create({
  baseURL: normalizedBase,
});

let unauthorizedHandler: (() => void) | null = null;

export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  unauthorizedHandler = handler;
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { data, status } = error.response;
      if (status === 401 && unauthorizedHandler) {
        unauthorizedHandler();
      }
      console.error('API error', { status, data });

      let message: string = status === 401 ? 'Sessão expirada. Faça login novamente.' : 'Erro inesperado na API.';
      const detail = data?.detail;

      if (Array.isArray(detail)) {
        message = detail
          .map((item) => (typeof item === 'string' ? item : item?.msg ?? JSON.stringify(item)))
          .join(' | ');
      } else if (typeof detail === 'string') {
        message = detail;
      } else if (typeof detail === 'object' && detail !== null && status !== 401) {
        message = detail.message ?? JSON.stringify(detail);
      }

      return Promise.reject(new Error(message));
    }

    return Promise.reject(error);
  }
);
