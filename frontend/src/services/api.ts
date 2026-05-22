import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to always include token from localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Shared promise so concurrent 401s coalesce into a single /auth/me check.
let sessionCheck: Promise<boolean> | null = null;
const verifySession = (): Promise<boolean> => {
  if (sessionCheck) return sessionCheck;
  sessionCheck = api
    .get('/auth/me')
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      sessionCheck = null;
    });
  return sessionCheck;
};

api.interceptors.response.use(
  (response) => {
    const refreshed = response.headers?.['x-new-token'];
    if (refreshed) {
      localStorage.setItem('token', refreshed);
    }
    return response;
  },
  async (error) => {
    const status = error.response?.status;
    const url: string = error.config?.url || '';

    // /auth/me failures are handled by AuthContext — don't loop.
    if (status === 401 && url.includes('/auth/me')) {
      return Promise.reject(error);
    }

    // A transient 401 from any other endpoint used to immediately log the user
    // out. Verify the session is actually dead before nuking it.
    if (status === 401) {
      const sessionValid = await verifySession();
      if (sessionValid) {
        return Promise.reject(error);
      }
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
