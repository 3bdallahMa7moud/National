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

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

export function shouldHandleUnauthorized(url: string | undefined) {
  if (!url) return true;
  return !url.includes('/auth/login');
}

const api = axios.create({
  baseURL: resolveApiBaseUrl(import.meta.env),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      axios.isAxiosError(error)
      && error.response?.status === 401
      && shouldHandleUnauthorized(error.config?.url)
    ) {
      unauthorizedHandler?.();
    }

    return Promise.reject(error);
  },
);

export default api;
