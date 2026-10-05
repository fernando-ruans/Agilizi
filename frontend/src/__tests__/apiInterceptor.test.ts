import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios, { AxiosError } from 'axios';
import toast from 'react-hot-toast';
import api from '../services/api';

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn(), custom: vi.fn() },
}));

const CONN_MSG = 'Erro de conexão. Verifique sua internet.';
const mockedToast = toast as unknown as { error: ReturnType<typeof vi.fn> };

const originalAdapter = api.defaults.adapter;

function networkErrorAdapter() {
  return Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK'));
}

describe('api response interceptor — connection feedback', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    api.defaults.adapter = originalAdapter;
  });

  it('a real network failure shows the connection toast', async () => {
    api.defaults.adapter = networkErrorAdapter as any;

    await expect(api.get('/dashboard')).rejects.toThrow();
    expect(mockedToast.error).toHaveBeenCalledWith(CONN_MSG);
  });

  it('a server error (500) does NOT show the connection toast (page handles it)', async () => {
    api.defaults.adapter = () =>
      Promise.reject(new AxiosError('boom', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        config: {} as any,
        data: { message: 'Erro interno' },
      } as any)) as any;

    await expect(api.get('/dashboard')).rejects.toThrow();
    expect(mockedToast.error).not.toHaveBeenCalledWith(CONN_MSG);
  });

  it('an ABORTED request (AbortController) never shows the connection toast', async () => {
    // Regression: StrictMode double-mount / fast period switches abort the
    // series request → axios rejects with CanceledError (no response), which
    // used to be misreported as "Erro de conexão".
    api.defaults.adapter = networkErrorAdapter as any;

    const controller = new AbortController();
    const pending = api.get('/dashboard/series', { signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toThrow();
    expect(mockedToast.error).not.toHaveBeenCalled();
  });

  it('axios.isCancel recognizes the canceled error shape', () => {
    const canceled = new axios.CanceledError('canceled', undefined, undefined as any);
    expect(axios.isCancel(canceled)).toBe(true);
    expect(axios.isCancel(new AxiosError('Network Error', 'ERR_NETWORK'))).toBe(false);
  });
});
