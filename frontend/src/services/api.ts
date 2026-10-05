import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('agilzi_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // FormData needs the browser to set Content-Type with its own boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
//
// Ownership of error feedback:
//   - Session expiry (401) → handled here (logout + redirect)
//   - No response (network) → handled here
//   - Everything else → rejected silently; the calling page shows
//     its own toast, so we never show the same error twice.
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    const status = error.response?.status;

    if (status === 401) {
      const onLoginScreen = window.location.pathname === '/login';

      // A failed login is not a session expiry — let the page show
      // "email ou senha inválidos" without reloading (which would
      // destroy the toast).
      if (onLoginScreen) {
        return Promise.reject(error);
      }

      localStorage.removeItem('agilzi_token');
      localStorage.removeItem('agilzi_user');
      localStorage.removeItem('agilzi_company');
      window.location.href = '/login';
      toast.error('Sessão expirada. Faça login novamente.');
      return Promise.reject(error);
    }

    if (!error.response) {
      // A request aborted by us (AbortController, React StrictMode double-mount,
      // fast period switches) rejects without a response — that is NOT a network
      // failure, and must stay silent or it spams "Erro de conexão" toasts.
      const canceled = axios.isCancel(error) || error.code === 'ERR_CANCELED';
      if (!canceled) {
        toast.error('Erro de conexão. Verifique sua internet.');
      }
    }

    return Promise.reject(error);
  }
);

export default api;
