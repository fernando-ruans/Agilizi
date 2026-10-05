import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import type { User, Company } from '../types';

interface AuthContextType {
  user: User | null;
  company: Company | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  updateCompany: (updates: Partial<Company>) => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
  companyType: string | null;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  companyName: string;
  companyTradeName?: string;
  companyDocument?: string;
  companyType?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('agilzi_token');
    const storedUser = localStorage.getItem('agilzi_user');
    const storedCompany = localStorage.getItem('agilzi_company');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      if (storedCompany) setCompany(JSON.parse(storedCompany));
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { user: userData, company: companyData, token: authToken } = response.data.data;

    localStorage.setItem('agilzi_token', authToken);
    localStorage.setItem('agilzi_user', JSON.stringify(userData));
    if (companyData) localStorage.setItem('agilzi_company', JSON.stringify(companyData));

    setToken(authToken);
    setUser(userData);
    if (companyData) setCompany(companyData);
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const response = await api.post('/auth/register', data);
    const { user: userData, company: companyData, token: authToken } = response.data.data;

    localStorage.setItem('agilzi_token', authToken);
    localStorage.setItem('agilzi_user', JSON.stringify(userData));
    if (companyData) localStorage.setItem('agilzi_company', JSON.stringify(companyData));

    setToken(authToken);
    setUser(userData);
    if (companyData) setCompany(companyData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('agilzi_token');
    localStorage.removeItem('agilzi_user');
    localStorage.removeItem('agilzi_company');
    setToken(null);
    setUser(null);
    setCompany(null);
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      localStorage.setItem('agilzi_user', JSON.stringify(next));
      return next;
    });
  }, []);

  const updateCompany = useCallback((updates: Partial<Company>) => {
    setCompany((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      localStorage.setItem('agilzi_company', JSON.stringify(next));
      return next;
    });
  }, []);

  const value: AuthContextType = {
    user,
    company,
    token,
    login,
    register,
    logout,
    updateUser,
    updateCompany,
    isAuthenticated: !!token && !!user,
    isAdmin: user?.role === 'admin',
    loading,
    companyType: company?.type || null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
