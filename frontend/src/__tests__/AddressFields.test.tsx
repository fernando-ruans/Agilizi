import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AddressFields, type AddressValue } from '../components/AddressFields';

vi.mock('../services/api', () => ({
  default: { get: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

import api from '../services/api';
import toast from 'react-hot-toast';

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>;
const mockedToast = toast as unknown as { error: ReturnType<typeof vi.fn> };

const initial: AddressValue = { zipCode: '', address: '', city: '', state: '' };

/**
 * AddressFields is fully controlled — the harness owns the state so value
 * assertions reflect real usage.
 */
function Harness({ onChangeSpy }: { onChangeSpy?: ReturnType<typeof vi.fn> }) {
  const [value, setValue] = useState<AddressValue>(initial);
  return (
    <AddressFields
      idPrefix="client"
      value={value}
      onChange={(v) => {
        setValue(v);
        onChangeSpy?.(v);
      }}
    />
  );
}

describe('AddressFields', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.useRealTimers());

  it('renders CEP, address, city and state inputs', () => {
    render(<Harness />);
    expect(screen.getByLabelText('CEP')).toBeInTheDocument();
    expect(screen.getByLabelText('Endereço')).toBeInTheDocument();
    expect(screen.getByLabelText('Cidade')).toBeInTheDocument();
    expect(screen.getByLabelText('Estado')).toBeInTheDocument();
  });

  it('formats the CEP with mask 00000-000', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('CEP'), { target: { value: '01310100' } });
    expect(screen.getByLabelText('CEP')).toHaveValue('01310-100');
  });

  it('renders Estado as a UF select with all options', () => {
    render(<Harness />);
    const state = screen.getByLabelText('Estado') as HTMLSelectElement;
    expect(state.tagName).toBe('SELECT');
    expect(state.options.length).toBe(28); // placeholder + 27 UFs
    fireEvent.change(state, { target: { value: 'BA' } });
    expect(screen.getByLabelText('Estado')).toHaveValue('BA');
  });

  it('does not call the API for incomplete CEPs', () => {
    vi.useFakeTimers();
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('CEP'), { target: { value: '01310' } });
    act(() => {
      vi.runAllTimers();
    });
    expect(mockedGet).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Endereço')).toHaveValue('');
  });

  it('resolves a full CEP (debounced) and fills address fields', async () => {
    vi.useFakeTimers();
    mockedGet.mockResolvedValue({
      data: {
        data: { cep: '01310-100', street: 'Avenida Paulista', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP' },
      },
    });

    render(<Harness />);
    fireEvent.change(screen.getByLabelText('CEP'), { target: { value: '01310100' } });
    expect(mockedGet).not.toHaveBeenCalled(); // debounced

    await act(async () => {
      vi.runAllTimers();
    });

    expect(mockedGet).toHaveBeenCalledWith('/cep/01310100');
    expect(screen.getByLabelText('Endereço')).toHaveValue('Avenida Paulista');
    expect(screen.getByLabelText('Cidade')).toHaveValue('São Paulo');
    expect(screen.getByLabelText('Estado')).toHaveValue('SP');
    expect(screen.getByLabelText('CEP')).toHaveValue('01310-100');
    expect(screen.getByRole('status')).toHaveTextContent('Endereço preenchido');
  });

  it('keeps fields manual and toasts when the CEP is not found (404)', async () => {
    vi.useFakeTimers();
    mockedGet.mockRejectedValue({ response: { status: 404 } });

    render(<Harness />);
    fireEvent.change(screen.getByLabelText('CEP'), { target: { value: '99999999' } });
    await act(async () => {
      vi.runAllTimers();
    });

    expect(mockedToast.error).toHaveBeenCalledWith('CEP não encontrado');
    expect(screen.getByLabelText('Endereço')).toHaveValue('');
    expect(screen.getByRole('status')).toHaveTextContent('CEP não encontrado');
  });

  it('toasts and stays editable when the lookup fails (network/502)', async () => {
    vi.useFakeTimers();
    mockedGet.mockRejectedValue({ response: { status: 502 } });

    render(<Harness />);
    fireEvent.change(screen.getByLabelText('CEP'), { target: { value: '01310100' } });
    await act(async () => {
      vi.runAllTimers();
    });

    expect(mockedToast.error).toHaveBeenCalledWith(
      'Não foi possível consultar o CEP. Preencha manualmente.'
    );
    const address = screen.getByLabelText('Endereço') as HTMLInputElement;
    expect(address.disabled).toBe(false);
    fireEvent.change(address, { target: { value: 'Rua Manual, 10' } });
    expect(address.value).toBe('Rua Manual, 10');
  });
});
