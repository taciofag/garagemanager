import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

import { api } from '../api/client';

interface AuthContextProps {
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);
const STORAGE_KEY = 'garage_manager_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      api.defaults.headers.common.Authorization = `Bearer ${saved}`;
    }
    return saved;
  });

  useEffect(() => {
    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      localStorage.setItem(STORAGE_KEY, token);
    } else {
      delete api.defaults.headers.common.Authorization;
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [token]);

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
      setToken(accessToken);
    } catch (error) {
      throw new Error('Falha no login. Verifique suas credenciais.');
    }
  };

  const logout = () => setToken(null);

  const value = useMemo(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      login,
      logout,
    }),
    [token]
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
