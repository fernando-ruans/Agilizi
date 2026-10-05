import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../services/api';

export interface CepAddress {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

export type CepStatus = 'idle' | 'loading' | 'success' | 'not-found' | 'error';

const CEP_DIGITS = 8;
const DEBOUNCE_MS = 400;

export function formatCep(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, CEP_DIGITS);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

/**
 * Resolves a CEP through our backend proxy (`GET /api/v1/cep/:cep`)
 * with debounce, exposing the current lookup status.
 */
export function useCep() {
  const [status, setStatus] = useState<CepStatus>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const lookup = useCallback(
    (rawCep: string, onFound: (address: CepAddress) => void): Promise<void> => {
      const digits = rawCep.replace(/\D/g, '');
      clearTimeout(timer.current);

      if (digits.length !== CEP_DIGITS) {
        setStatus('idle');
        return Promise.resolve();
      }

      setStatus('loading');
      return new Promise((resolve) => {
        timer.current = setTimeout(async () => {
          try {
            const { data } = await api.get(`/cep/${digits}`);
            setStatus('success');
            onFound(data.data);
          } catch (err: any) {
            const status = err.response?.status;
            setStatus(status === 404 ? 'not-found' : 'error');
          } finally {
            resolve();
          }
        }, DEBOUNCE_MS);
      });
    },
    []
  );

  return { status, lookup };
}
