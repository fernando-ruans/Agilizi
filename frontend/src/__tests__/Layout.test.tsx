import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Layout from '../components/Layout';

// useAuth is consumed by Layout — stub it per-test via this mutable object
const authState: { user: any; company: any; companyType: string | null } = {
  user: { id: 'u1', name: 'Test User', email: 't@e.com', role: 'admin' },
  company: { id: 'c1', name: 'Minha Empresa', type: 'ambos' },
  companyType: 'ambos',
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ ...authState, logout: vi.fn() }),
}));

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Layout>
        <div>Página</div>
      </Layout>
    </MemoryRouter>
  );
}

function visibleMenuLabels(): string[] {
  return screen
    .queryAllByRole('link')
    .map((a) => a.textContent?.trim() || '')
    .filter((t) => t.length > 0);
}

beforeEach(() => {
  authState.user = { id: 'u1', name: 'Test User', email: 't@e.com', role: 'admin' };
  authState.company = { id: 'c1', name: 'Minha Empresa', type: 'ambos' };
  authState.companyType = 'ambos';
});

describe('Layout sidebar menu adapts to company type', () => {
  it('shows store-only items for a "loja" company', () => {
    authState.companyType = 'loja';
    authState.company = { id: 'c1', name: 'Minha Loja', type: 'loja' };
    renderLayout();

    const labels = visibleMenuLabels();
    expect(labels).toContain('Produtos');
    expect(labels).toContain('Vendas');
    expect(labels).not.toContain('Serviços');
    expect(labels).not.toContain('Ordens de Serviço');
    expect(labels).not.toContain('Orçamentos');
  });

  it('shows service-provider items for a "prestador" company', () => {
    authState.companyType = 'prestador';
    authState.company = { id: 'c1', name: 'Minha Oficina', type: 'prestador' };
    renderLayout();

    const labels = visibleMenuLabels();
    expect(labels).toContain('Serviços');
    expect(labels).toContain('Ordens de Serviço');
    expect(labels).toContain('Orçamentos');
    expect(labels).not.toContain('Produtos');
    expect(labels).not.toContain('Vendas');
  });

  it('shows everything for an "ambos" company', () => {
    renderLayout();

    const labels = visibleMenuLabels();
    for (const expected of ['Produtos', 'Vendas', 'Serviços', 'Orçamentos', 'Ordens de Serviço']) {
      expect(labels, `menu should contain ${expected}`).toContain(expected);
    }
  });

  it('always shows shared items regardless of type', () => {
    authState.companyType = 'prestador';
    renderLayout();

    const labels = visibleMenuLabels();
    for (const shared of ['Dashboard', 'Clientes', 'Fornecedores', 'Caixa', 'Relatórios', 'Configurações']) {
      expect(labels).toContain(shared);
    }
  });
});

describe('Layout menu respects user role', () => {
  it('hides Despesas for operacional role', () => {
    authState.user = { id: 'u2', name: 'Oper', email: 'o@e.com', role: 'operacional' };
    renderLayout();

    const labels = visibleMenuLabels();
    expect(labels).not.toContain('Despesas');
  });

  it('shows Despesas for admin role', () => {
    renderLayout();
    expect(visibleMenuLabels()).toContain('Despesas');
  });
});

describe('Layout user dropdown', () => {
  it('renders company name exactly once in the sidebar', () => {
    authState.company = { id: 'c1', name: 'Empresa XYZ', type: 'loja' };
    renderLayout();
    // Topbar must not repeat it — duplicated context is a UX smell
    expect(screen.getAllByText('Empresa XYZ')).toHaveLength(1);
  });

  it('never duplicates the page title in the topbar', () => {
    renderLayout();
    // Sidebar has one "Dashboard" link; topbar must not add an <h1> with it
    const topbar = document.querySelector('header');
    expect(topbar?.querySelector('h1')).toBeNull();
  });

  it('renders the Agilzi brand', () => {
    renderLayout();
    expect(screen.getByText('Agilzi')).toBeInTheDocument();
  });
});
