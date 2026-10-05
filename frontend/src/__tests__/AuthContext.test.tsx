import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

// Mock the api module so AuthContext talks to a fake server
vi.mock('../services/api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
  },
}));

import api from '../services/api';

const mockedApi = api as unknown as { post: ReturnType<typeof vi.fn> };

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('AuthContext', () => {
  it('starts unauthenticated after the storage check settles', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.company).toBeNull();
  });

  it('restores a session from localStorage', async () => {
    localStorage.setItem('agilzi_token', 'tok');
    localStorage.setItem('agilzi_user', JSON.stringify({
      id: 'u1', name: 'Ana', email: 'a@x.com', role: 'admin', companyId: 'c1',
    }));
    localStorage.setItem('agilzi_company', JSON.stringify({
      id: 'c1', name: 'Empresa', type: 'loja', active: true, createdAt: '',
    }));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.name).toBe('Ana');
    expect(result.current.companyType).toBe('loja');
    expect(result.current.isAdmin).toBe(true);
  });

  it('login stores token/user/company', async () => {
    mockedApi.post.mockResolvedValue({
      data: {
        data: {
          user: { id: 'u1', name: 'Bruno', email: 'b@x.com', role: 'gerente', companyId: 'c2' },
          company: { id: 'c2', name: 'Loja B', type: 'ambos' },
          token: 'jwt-token',
        },
      },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.login('b@x.com', 'senha123');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.name).toBe('Bruno');
    expect(result.current.company?.type).toBe('ambos');
    expect(result.current.isAdmin).toBe(false);
    expect(localStorage.getItem('agilzi_token')).toBe('jwt-token');
    expect(mockedApi.post).toHaveBeenCalledWith('/auth/login', { email: 'b@x.com', password: 'senha123' });
  });

  it('logout clears everything', async () => {
    localStorage.setItem('agilzi_token', 'tok');
    localStorage.setItem('agilzi_user', JSON.stringify({ id: 'u1', name: 'X', role: 'admin' }));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAuthenticated).toBe(true);

    act(() => result.current.logout());

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('agilzi_token')).toBeNull();
    expect(localStorage.getItem('agilzi_user')).toBeNull();
  });

  it('updateUser patches user state and persists it', async () => {
    localStorage.setItem('agilzi_token', 'tok');
    localStorage.setItem('agilzi_user', JSON.stringify({
      id: 'u1', name: 'Nome Antigo', email: 'old@x.com', role: 'admin', companyId: 'c1',
    }));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.updateUser({ name: 'Nome Novo' }));

    expect(result.current.user?.name).toBe('Nome Novo');
    expect(result.current.user?.email).toBe('old@x.com');
    expect(JSON.parse(localStorage.getItem('agilzi_user')!).name).toBe('Nome Novo');
  });

  it('throws when used outside a provider', () => {
    // Suppress React error boundary noise for this assertion
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(/useAuth must be used within an AuthProvider/);
    spy.mockRestore();
  });
});
