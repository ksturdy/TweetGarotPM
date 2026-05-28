import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { disconnectSocket } from '../services/socket';

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  hrAccess?: string;
  forcePasswordChange?: boolean;
  twoFactorEnabled?: boolean;
  tenantId?: number;
  isPlatformAdmin?: boolean;
}

interface Tenant {
  id: number;
  name: string;
  slug: string;
  settings?: {
    branding?: {
      logo_url?: string;
      primary_color?: string;
      company_name?: string;
    };
    notifications?: {
      email_enabled?: boolean;
      daily_digest?: boolean;
    };
    defaults?: {
      timezone?: string;
      date_format?: string;
    };
  };
  planName?: string;
  planLimits?: {
    max_users?: number;
    max_projects?: number;
    max_customers?: number;
    max_opportunities?: number;
    storage_gb?: number;
  };
  planFeatures?: {
    projects?: boolean;
    rfis?: boolean;
    submittals?: boolean;
    change_orders?: boolean;
    daily_reports?: boolean;
    schedule?: boolean;
    customers?: boolean;
    companies?: boolean;
    sales_pipeline?: boolean;
    campaigns?: boolean;
    estimates?: boolean;
    hr_module?: boolean;
    api_access?: boolean;
    custom_branding?: boolean;
  };
}

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  loading: boolean;
  passwordExpiresInDays: number | null;
  login: (email: string, password: string) => Promise<any>;
  login2FA: (userId: number, token: string) => Promise<void>;
  logout: () => void;
  register: (data: RegisterData) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  hasFeature: (feature: string) => boolean;
  isWithinLimit: (limitName: string, currentCount: number) => boolean;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

interface SignupData {
  companyName: string;
  slug: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordExpiresInDays, setPasswordExpiresInDays] = useState<number | null>(null);

  useEffect(() => {
    const initialToken = localStorage.getItem('token');
    console.log('[auth-debug] AuthProvider mount', { hasToken: !!initialToken });
    if (!initialToken) {
      setLoading(false);
      return;
    }

    // Bail early if the JWT exp is already in the past — saves a doomed
    // /auth/me round-trip on a token the client already knows is dead.
    let expSec: number | null = null;
    try {
      expSec = JSON.parse(atob(initialToken.split('.')[1])).exp;
    } catch (_) { /* malformed token */ }
    if (expSec && expSec * 1000 < Date.now()) {
      localStorage.removeItem('token');
      setLoading(false);
      return;
    }

    api.defaults.headers.common['Authorization'] = `Bearer ${initialToken}`;
    api.get('/auth/me')
      .then((res) => {
        // If a fresh login replaced the token while /auth/me was in flight
        // on the old one, the login's user state is the source of truth.
        if (localStorage.getItem('token') !== initialToken) return;
        setUser({
          id: res.data.id,
          email: res.data.email,
          firstName: res.data.first_name,
          lastName: res.data.last_name,
          role: res.data.role,
          hrAccess: res.data.hr_access,
          forcePasswordChange: res.data.force_password_change,
          twoFactorEnabled: res.data.two_factor_enabled,
          tenantId: res.data.tenant_id,
          isPlatformAdmin: res.data.is_platform_admin || false,
        });
        if (res.data.tenant) {
          setTenant(res.data.tenant);
        }
      })
      .catch((error) => {
        // CRITICAL: don't stomp a fresh login. If localStorage changed since
        // the request started, the user successfully re-authenticated while
        // we were waiting on this doomed call against the old token. Wiping
        // here was the root cause of the "kicked out at login" loop.
        if (localStorage.getItem('token') !== initialToken) return;
        console.error('Auth check failed:', error);
        localStorage.removeItem('token');
        delete api.defaults.headers.common['Authorization'];
        setUser(null);
        setTenant(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });

    // Check if 2FA is required
    if (res.data.requires2FA) {
      console.log('[auth-debug] login: 2FA required');
      return {
        requires2FA: true,
        userId: res.data.userId,
        email: res.data.email,
      };
    }

    // Normal login (no 2FA)
    const tokenPreview = res.data.token ? `${res.data.token.slice(0, 24)}…(len=${res.data.token.length})` : '<missing>';
    let receivedIat: number | undefined;
    try {
      receivedIat = JSON.parse(atob(res.data.token.split('.')[1])).iat;
    } catch (_) { /* ignore */ }
    console.log('[auth-debug] login: POST /auth/login OK', {
      token: tokenPreview,
      receivedIat,
      receivedAgeS: receivedIat ? Math.floor(Date.now() / 1000) - receivedIat : null,
      userId: res.data.user?.id,
      tenantId: res.data.user?.tenantId ?? res.data.tenant?.id,
    });
    localStorage.setItem('token', res.data.token);
    // Read back what we just wrote to confirm nothing is overwriting it.
    const verifyWrite = localStorage.getItem('token');
    let storedIat: number | undefined;
    try {
      storedIat = verifyWrite ? JSON.parse(atob(verifyWrite.split('.')[1])).iat : undefined;
    } catch (_) { /* ignore */ }
    console.log('[auth-debug] login: localStorage read-back', {
      stored: verifyWrite ? `${verifyWrite.slice(0, 24)}…(len=${verifyWrite.length})` : '<missing>',
      storedIat,
      matchesReceived: verifyWrite === res.data.token,
    });
    api.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
    setUser(res.data.user);
    setTenant(res.data.tenant);
    setPasswordExpiresInDays(res.data.passwordExpiresInDays ?? null);

    return { requires2FA: false };
  }, []);

  const login2FA = useCallback(async (userId: number, token: string) => {
    const res = await api.post('/auth/login/2fa', { userId, token });
    localStorage.setItem('token', res.data.token);
    api.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
    setUser(res.data.user);
    setTenant(res.data.tenant);
    setPasswordExpiresInDays(res.data.passwordExpiresInDays ?? null);
  }, []);

  const logout = useCallback(() => {
    disconnectSocket();
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    setTenant(null);
    setPasswordExpiresInDays(null);
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

  /**
   * Sign up a new tenant and admin user
   */
  const signup = useCallback(async (data: SignupData) => {
    const res = await api.post('/public/signup', data);
    localStorage.setItem('token', res.data.token);
    api.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
    setUser(res.data.user);
    setTenant(res.data.tenant);
  }, []);

  /**
   * Check if a feature is enabled for the current tenant
   */
  const hasFeature = useCallback((feature: string): boolean => {
    if (!tenant || !tenant.planFeatures) return false;
    return tenant.planFeatures[feature as keyof typeof tenant.planFeatures] === true;
  }, [tenant]);

  /**
   * Check if current count is within the plan limit
   */
  const isWithinLimit = useCallback((limitName: string, currentCount: number): boolean => {
    if (!tenant || !tenant.planLimits) return true;
    const limit = tenant.planLimits[limitName as keyof typeof tenant.planLimits];
    if (limit === undefined || limit === null || limit === -1) return true;
    return currentCount < limit;
  }, [tenant]);

  return (
    <AuthContext.Provider value={{
      user,
      tenant,
      loading,
      passwordExpiresInDays,
      login,
      login2FA,
      logout,
      register,
      signup,
      hasFeature,
      isWithinLimit,
    }}>
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
