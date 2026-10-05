import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { useCep, formatCep } from '../hooks/useCep';
import { UF_LIST } from '../utils/formatters';

export interface AddressValue {
  zipCode: string;
  address: string;
  city: string;
  state: string;
}

interface AddressFieldsProps {
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  /** Unique prefix for input ids (client, supplier, company…) */
  idPrefix: string;
}

/**
 * CEP + Endereço + Cidade + Estado group. Typing a full CEP resolves it
 * through the backend proxy and fills the fields automatically; on failure
 * everything stays manually editable.
 */
export function AddressFields({ value, onChange, idPrefix }: AddressFieldsProps) {
  const { status, lookup } = useCep();

  // Toast only when a lookup settles (status transitions), not on renders
  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current === status) return;
    prevStatus.current = status;
    if (status === 'not-found') toast.error('CEP não encontrado');
    else if (status === 'error') toast.error('Não foi possível consultar o CEP. Preencha manualmente.');
  }, [status]);

  const handleCepChange = (raw: string) => {
    const formatted = formatCep(raw);
    onChange({ ...value, zipCode: formatted });

    if (formatted.replace(/\D/g, '').length === 8) {
      // Snapshot the fields as typed: the resolved address only fills
      // empty/other fields, it never overwrites what the user typed.
      const snapshot = { ...value, zipCode: formatted };
      lookup(formatted, (address) => {
        onChange({
          ...snapshot,
          address: address.street || snapshot.address,
          city: address.city || snapshot.city,
          state: address.state || snapshot.state,
        });
      });
    }
  };

  const statusIcon =
    status === 'loading' ? <Loader2 size={13} className="text-gray-400 animate-spin dark:text-slate-500" /> :
    status === 'success' ? <Check size={13} className="text-emerald-500" /> :
    (status === 'not-found' || status === 'error') ? <AlertCircle size={13} className="text-red-400" /> :
    null;

  const statusText =
    status === 'loading' ? 'Consultando CEP…' :
    status === 'success' ? 'Endereço preenchido' :
    status === 'not-found' ? 'CEP não encontrado' :
    status === 'error' ? 'Falha na consulta — preencha manualmente' :
    null;

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <label htmlFor={`${idPrefix}-zip`} className="label">CEP</label>
        <div className="relative">
          <input
            id={`${idPrefix}-zip`}
            type="text"
            inputMode="numeric"
            value={value.zipCode}
            onChange={(e) => handleCepChange(e.target.value)}
            className="input pr-8"
            placeholder="00000-000"
            maxLength={9}
            autoComplete="postal-code"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2" aria-hidden="true">
            {statusIcon}
          </span>
        </div>
        {statusText && (
          <p className="helper-text" role="status" aria-live="polite">{statusText}</p>
        )}
      </div>
      <div className="col-span-2">
        <label htmlFor={`${idPrefix}-address`} className="label">Endereço</label>
        <input
          id={`${idPrefix}-address`}
          type="text"
          value={value.address}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
          className="input"
          maxLength={200}
          autoComplete="street-address"
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-city`} className="label">Cidade</label>
        <input
          id={`${idPrefix}-city`}
          type="text"
          value={value.city}
          onChange={(e) => onChange({ ...value, city: e.target.value })}
          className="input"
          maxLength={100}
          autoComplete="address-level2"
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-state`} className="label">Estado</label>
        <select
          id={`${idPrefix}-state`}
          value={value.state.toUpperCase()}
          onChange={(e) => onChange({ ...value, state: e.target.value })}
          className="input"
          autoComplete="address-level1"
        >
          <option value="">UF</option>
          {UF_LIST.map((uf) => (
            <option key={uf} value={uf}>{uf}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
