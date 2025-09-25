import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';

import { api, setUnauthorizedHandler } from '../api/client';

interface AuthContextProps {
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);
const STORAGE_KEY = 'garage_manager_token';
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      api.defaults.headers.common.Authorization = `Bearer ${saved}`;
    }
    return saved;
  });

  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const startInactivityTimer = useCallback(() => {
    clearInactivityTimer();
    if (token) {
      inactivityTimerRef.current = setTimeout(() => {
        setToken(null);
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }, INACTIVITY_TIMEOUT_MS);
    }
  }, [token, clearInactivityTimer]);

  useEffect(() => {
    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      localStorage.setItem(STORAGE_KEY, token);
      startInactivityTimer();
    } else {
      delete api.defaults.headers.common.Authorization;
      localStorage.removeItem(STORAGE_KEY);
      clearInactivityTimer();
    }
  }, [token, startInactivityTimer, clearInactivityTimer]);
  const handleUnauthorized = useCallback(() => {
    clearInactivityTimer();
    setToken(null);
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }, [clearInactivityTimer]);

  useEffect(() => {
    if (token) {
      setUnauthorizedHandler(handleUnauthorized);
      return () => setUnauthorizedHandler(null);
    }
    setUnauthorizedHandler(null);
    return () => undefined;
  }, [token, handleUnauthorized]);

  useEffect(() => {
    if (!token) {
      clearInactivityTimer();
      return;
    }

    const reset = () => startInactivityTimer();
    const events: Array<keyof WindowEventMap> = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, reset));

    return () => {
      events.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [token, startInactivityTimer, clearInactivityTimer]);

  const login = async (email: string, password: string) => {
    const params = new URLSearchParams();
    params.append('username', email);
    params.append('password', password);

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL ?? '/api'}/auth/login`,
        params,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );
      const accessToken = response.data.access_token as string;
      api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
      localStorage.setItem(STORAGE_KEY, accessToken);
      setToken(accessToken);
      clearInactivityTimer();
      inactivityTimerRef.current = setTimeout(() => {
        setToken(null);
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }, INACTIVITY_TIMEOUT_MS);
    } catch (error) {
      throw new Error('Falha no login. Verifique suas credenciais.');
    }
  };

  const logout = useCallback(() => {
    clearInactivityTimer();
    setToken(null);
  }, [clearInactivityTimer]);

  const value = useMemo(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      login,
      logout,
    }),
    [token, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
};
