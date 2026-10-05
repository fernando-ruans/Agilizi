import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

/**
 * OS and budgets are documents sent to the client — exported from their
 * own view modals (not from the Reports page).
 */

/** Seeds one budget with a service item; returns its number. */
async function seedBudget(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem('agilzi_token'));
  const services = await (await page.request.get('http://localhost:5173/api/v1/services?limit=1', {
    headers: { Authorization: `Bearer ${token}` },
  })).json();
  const clients = await (await page.request.get('http://localhost:5173/api/v1/clients?limit=1', {
    headers: { Authorization: `Bearer ${token}` },
  })).json();

  const budget = await page.request.post('http://localhost:5173/api/v1/budgets', {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {
      clientId: clients.data[0].id,
      items: [{ serviceId: services.data[0].id, quantity: 2, unitValue: 150 }],
      validUntil: new Date(Date.now() + 15 * 86400_000).toISOString(),
      notes: 'Condições: 50% na assinatura.',
    },
  });
  expect(budget.status()).toBe(201);
  const body = await budget.json();
  return String(body.data.number).padStart(4, '0');
}

test.describe('PDF do orçamento (documento para o cliente)', () => {
  test('modal de visualização baixa o PDF do orçamento', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    const number = await seedBudget(page);

    await page.goto('/orcamentos');
    const row = page.locator('tbody tr').first();
    await expect(row).toBeVisible({ timeout: 8_000 });
    await row.getByTitle('Ver detalhes').click();
    await expect(page.getByText(`Orçamento #${number}`)).toBeVisible();

    const downloadPromise = page.waitForEvent('download', { timeout: 20_000 });
    await page.getByRole('button', { name: /Baixar PDF do orçamento/ }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(new RegExp(`^orcamento-${number}-.*\\.pdf$`));

    // Real PDF magic bytes
    const path = await download.path();
    const fs = await import('fs');
    const buffer = fs.readFileSync(path);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1000);

    await expect(page.getByText('PDF gerado!')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('PDF da OS (documento para o cliente)', () => {
  test('modal de visualização baixa o PDF da OS', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    const token = await page.evaluate(() => localStorage.getItem('agilzi_token'));

    const services = await (await page.request.get('http://localhost:5173/api/v1/services?limit=1', {
      headers: { Authorization: `Bearer ${token}` },
    })).json();
    const clients = await (await page.request.get('http://localhost:5173/api/v1/clients?limit=1', {
      headers: { Authorization: `Bearer ${token}` },
    })).json();

    const order = await page.request.post('http://localhost:5173/api/v1/orders', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        clientId: clients.data[0].id,
        items: [{ serviceId: services.data[0].id, quantity: 1, unitValue: 480 }],
        description: 'Instalação de equipamento E2E',
      },
    });
    expect(order.status()).toBe(201);
    const orderBody = await order.json();
    const number = String(orderBody.data.number).padStart(4, '0');

    await page.goto('/ordens-servico');
    const row = page.locator('tbody tr').first();
    await expect(row).toBeVisible({ timeout: 8_000 });
    await row.getByTitle('Ver detalhes').click();
    await expect(page.getByText(`OS #${number}`)).toBeVisible();

    const downloadPromise = page.waitForEvent('download', { timeout: 20_000 });
    await page.getByRole('button', { name: /Baixar PDF da OS/ }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(new RegExp(`^os-${number}-.*\\.pdf$`));
    const path = await download.path();
    const fs = await import('fs');
    const buffer = fs.readFileSync(path);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1000);

    await expect(page.getByText('PDF gerado!')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Formulários cobrem os campos do PDF', () => {
  test('OS: técnico e desconto existem no formulário', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    await page.goto('/ordens-servico');
    await page.getByRole('button', { name: /Nova OS/ }).click();

    // Admin sees the technician list; discount affects the printed total
    await expect(page.locator('#order-technician')).toBeVisible();
    await expect(page.locator('#order-technician option')).not.toHaveCount(1); // > "Não atribuído"
    await expect(page.locator('#order-discount')).toBeVisible();
    await expect(page.locator('#order-description')).toBeVisible();
    await expect(page.locator('#order-notes')).toBeVisible();
  });

  test('Orçamento: validade existe no formulário', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    await page.goto('/orcamentos');
    await page.getByRole('button', { name: /Novo Orçamento/ }).click();

    await expect(page.locator('#budget-valid-until')).toBeVisible();
    await expect(page.locator('#budget-discount')).toBeVisible();
    await expect(page.locator('#budget-notes')).toBeVisible();
  });
});

test.describe('Relatórios não listam OS/orçamentos', () => {
  test('cards de OS e Orçamentos não existem mais em Relatórios', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    await page.goto('/relatorios');
    await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible();

    await expect(page.locator('.card', { hasText: 'Ordens de Serviço' })).toHaveCount(0);
    await expect(page.locator('.card', { hasText: 'Orçamentos' })).toHaveCount(0);
    // Remaining reports still work
    await expect(page.locator('.card', { hasText: 'Financeiro' })).toBeVisible();
    await expect(page.locator('.card', { hasText: 'Rentabilidade' })).toBeVisible();
  });
});
