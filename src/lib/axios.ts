import axios from 'axios';

type ApiBaseUrlEnv = {
  DEV: boolean;
  VITE_API_URL?: string;
};

export function resolveApiBaseUrl(env: ApiBaseUrlEnv) {
  if (env.DEV) {
    return '/api';
  }

  return env.VITE_API_URL || '/api';
}

const api = axios.create({
  baseURL: resolveApiBaseUrl(import.meta.env),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
