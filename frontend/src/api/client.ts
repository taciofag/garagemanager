import axios from 'axios';

const base = import.meta.env.VITE_API_BASE_URL ?? '/api';
const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;

export const apiBaseURL = normalizedBase;

export const api = axios.create({
  baseURL: normalizedBase,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { data, status } = error.response;
      console.error('API error', { status, data });

      let message: string = 'Erro inesperado na API.';
      const detail = data?.detail;

      if (Array.isArray(detail)) {
        message = detail
          .map((item) => (typeof item === 'string' ? item : item?.msg ?? JSON.stringify(item)))
          .join(' | ');
      } else if (typeof detail === 'string') {
        message = detail;
      } else if (typeof detail === 'object' && detail !== null) {
        message = detail.message ?? JSON.stringify(detail);
      }

      return Promise.reject(new Error(message));
    }

    return Promise.reject(error);
  }
);
