import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AuthShell from '../components/AuthShell';

describe('AuthShell', () => {
  it('renderiza o conteudo e a lateral institucional', () => {
    render(
      <AuthShell>
        <button>Enviar</button>
      </AuthShell>
    );
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeInTheDocument();
    expect(
      screen.getByText('Vendas, serviços e caixa em um só lugar.')
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Seus dados ficam na sua máquina/).length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText('Sobre o Agilizi')).toBeInTheDocument();
  });
});
