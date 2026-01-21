import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  hrAccess?: string;
  forcePasswordChange?: boolean;
  twoFactorEnabled?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<any>;
  login2FA: (userId: number, token: string) => Promise<void>;
  logout: () => void;
  register: (data: RegisterData) => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      api.get('/auth/me')
        .then((res) => {
          setUser({
            id: res.data.id,
            email: res.data.email,
            firstName: res.data.first_name,
            lastName: res.data.last_name,
            role: res.data.role,
            hrAccess: res.data.hr_access,
            forcePasswordChange: res.data.force_password_change,
            twoFactorEnabled: res.data.two_factor_enabled,
          });
        })
        .catch((error) => {
          console.error('Auth check failed:', error);
          localStorage.removeItem('token');
          delete api.defaults.headers.common['Authorization'];
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });

    // Check if 2FA is required
    if (res.data.requires2FA) {
      return {
        requires2FA: true,
        userId: res.data.userId,
        email: res.data.email,
      };
    }

    // Normal login (no 2FA)
    localStorage.setItem('token', res.data.token);
    api.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
    setUser(res.data.user);

    return { requires2FA: false };
  }, []);

  const login2FA = useCallback(async (userId: number, token: string) => {
    const res = await api.post('/auth/login/2fa', { userId, token });
    localStorage.setItem('token', res.data.token);
    api.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
    setUser(res.data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const res = await api.post('/auth/register', data);
    localStorage.setItem('token', res.data.token);
    api.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
    setUser({
      id: res.data.user.id,
      email: res.data.user.email,
      firstName: res.data.user.first_name,
      lastName: res.data.user.last_name,
      role: res.data.user.role,
      hrAccess: res.data.user.hr_access,
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, login2FA, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
