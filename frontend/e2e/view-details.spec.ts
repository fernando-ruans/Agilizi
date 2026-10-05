import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

/**
 * Every list page must expose a "view details" action (Eye) that opens a
 * read-only modal — products, suppliers, services, cash, expenses, users,
 * clients, budgets, orders and sales.
 */
const viewCases: { path: string; heading: RegExp; modal: RegExp }[] = [
  { path: '/produtos', heading: /Produtos/, modal: /Detalhes do produto/ },
  { path: '/fornecedores', heading: /Fornecedores/, modal: /Detalhes do fornecedor/ },
  { path: '/servicos', heading: /Serviços/, modal: /Detalhes do serviço/ },
  { path: '/caixa', heading: /Caixa/, modal: /Detalhes da transação/ },
  { path: '/despesas', heading: /Despesas/, modal: /Detalhes da despesa/ },
  { path: '/clientes', heading: /Clientes/, modal: /Detalhes do cliente/ },
  { path: '/orcamentos', heading: /Orçamentos/, modal: /Detalhes do orçamento|Orçamento #/ },
  { path: '/ordens-servico', heading: /Ordens de Serviço/, modal: /OS #/ },
  { path: '/vendas', heading: /Vendas/, modal: /Venda #/ },
];

async function openFirstView(page: Page): Promise<boolean> {
  const btn = page.locator('button[title="Ver detalhes"]').first();
  if ((await btn.count()) === 0) return false;
  await btn.click();
  return true;
}

/**
 * Some lists start empty in the demo company — create one minimal record
 * through the API so the view action is actually exercised (not skipped).
 */
async function seedIfEmpty(page: Page, path: string): Promise<void> {
  const rows = await page.locator('tbody tr').count();
  if (rows > 0) return;

  const token = await page.evaluate(() => localStorage.getItem('agilzi_token'));
  const headers = { Authorization: `Bearer ${token}` };
  const stamp = Date.now();

  const post = (url: string, body: unknown) =>
    page.request.post(`http://localhost:5173/api/v1${url}`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      data: body,
    });

  if (path === '/despesas') {
    await post('/expenses', {
      description: `Despesa E2E ${stamp}`, value: 100, category: 'aluguel',
      date: new Date().toISOString(),
    });
  } else if (path === '/orcamentos' || path === '/ordens-servico') {
    const services = await (await page.request.get('http://localhost:5173/api/v1/services?limit=1', { headers })).json();
    const clients = await (await page.request.get('http://localhost:5173/api/v1/clients?limit=1', { headers })).json();
    const serviceId = services?.data?.[0]?.id;
    const clientId = clients?.data?.[0]?.id;
    if (serviceId && clientId) {
      const payload = {
        clientId,
        items: [{ serviceId, quantity: 1, unitValue: 50 }],
        ...(path === '/ordens-servico' ? {} : { validDays: 15 }),
      };
      await post(path === '/orcamentos' ? '/budgets' : '/orders', payload);
    }
  }

  await page.reload();
  await page.waitForLoadState('networkidle');
}

test.describe('Ação de visualização', () => {
  for (const c of viewCases) {
    test(`${c.path} tem botão "Ver detalhes" e abre o modal`, async ({ page }) => {
      await login(page, 'admin@demo.com', 'admin123');
      await page.goto(c.path);
      await expect(page.getByRole('heading', { name: c.heading })).toBeVisible({ timeout: 10_000 });

      // Some lists start empty in the demo company — seed one record
      await seedIfEmpty(page, c.path);

      const opened = await openFirstView(page);
      expect(opened, `botão Ver detalhes ausente em ${c.path}`).toBe(true);
      await expect(page.getByText(c.modal).first()).toBeVisible({ timeout: 8_000 });

      // Modal closes via Escape
      await page.keyboard.press('Escape');
      await expect(page.getByText(c.modal).first()).toBeHidden({ timeout: 5_000 });
    });
  }

  test('usuários têm botão Ver detalhes', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    await page.goto('/configuracoes');
    // Users tab inside settings
    await page.getByRole('button', { name: /Usuários/ }).click();
    await expect(page.locator('button[title="Ver detalhes"]').first()).toBeVisible({ timeout: 8_000 });
    await page.locator('button[title="Ver detalhes"]').first().click();
    await expect(page.getByText('Detalhes do usuário')).toBeVisible();
  });
});
