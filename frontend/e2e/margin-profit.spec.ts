import { test, expect, Page } from '@playwright/test';
import { login, field } from './helpers';

test.describe('Margem e rentabilidade', () => {
  test('produtos exibem coluna Margem com badge', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    await page.goto('/produtos');
    await expect(page.getByRole('heading', { name: 'Produtos' })).toBeVisible();

    // Column header exists
    await expect(page.getByRole('columnheader', { name: 'Margem' })).toBeVisible();

    // A product with a cost price shows a % badge
    const name = `Margem E2E ${Date.now()}`;
    await page.getByRole('button', { name: /Novo Produto/ }).click();
    await field(page, 'Nome').fill(name);
    await page.locator('#product-price').fill('100');
    await page.locator('#product-cost').fill('40');
    await page.getByRole('button', { name: 'Criar', exact: true }).click();
    await expect(page.getByText('Produto criado')).toBeVisible({ timeout: 8_000 });

    const row = page.locator('tr', { hasText: name });
    await expect(row.getByText('60%', { exact: true })).toBeVisible();

    // Detail modal shows the unit profit (label renders in two nodes —
    // take the first to satisfy Playwright's strict mode)
    await row.getByTitle('Ver detalhes').click();
    await expect(page.getByText('Detalhes do produto')).toBeVisible();
    await expect(page.getByText('Lucro unitário / Margem').first()).toBeVisible();
    await expect(page.getByText('R$ 60,00 · 60%').first()).toBeVisible();
    await page.keyboard.press('Escape');
  });
});

test.describe('Dashboard com lucro', () => {
  test('KPI "Lucro no mês" aparece com valor formatado', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    await page.goto('/dashboard');

    await expect(page.getByText('Lucro no mês')).toBeVisible({ timeout: 10_000 });
    // Money format (BRL) or a dash when there are no sales
    await expect(page.getByText(/R\$|—/).first()).toBeVisible();
  });
});

test.describe('Despesas centralizadas no Caixa', () => {
  test('despesa paga gera saída no caixa e aparece no filtro', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');

    const stamp = Date.now();
    const desc = `Despesa Caixa E2E ${stamp}`;

    // Create a paid expense through the API (same path as the UI form)
    const token = await page.evaluate(() => localStorage.getItem('agilzi_token'));
    await page.request.post('http://localhost:5173/api/v1/expenses', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        description: desc,
        value: 77,
        category: 'aluguel',
        date: new Date().toISOString(),
        status: 'pago',
        paidDate: new Date().toISOString(),
      },
    });

    await page.goto('/caixa');
    await expect(page.getByRole('heading', { name: 'Caixa' })).toBeVisible();

    // Find it via the new search filter
    const search = page.getByPlaceholder(/Buscar descrição/);
    await search.fill(desc);
    await expect(page.locator('tbody tr', { hasText: desc })).toBeVisible({ timeout: 8_000 });

    const row = page.locator('tbody tr', { hasText: desc });
    await expect(row.getByText('↓ Saída')).toBeVisible();
    await expect(row.getByText('Despesa').first()).toBeVisible();

    // Detail modal confirms the category
    await row.getByTitle('Ver detalhes').click();
    await expect(page.getByText('Detalhes da transação')).toBeVisible();
    await page.keyboard.press('Escape');

    // "Limpar" restores the unfiltered list
    await page.getByRole('button', { name: /Limpar/ }).click();
    await expect(search).toHaveValue('');
  });
});

test.describe('Relatório de rentabilidade', () => {
  test('card Rentabilidade mostra lucro e gera PDF', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    await page.goto('/relatorios');

    const card = page.locator('.card', { hasText: 'Rentabilidade' }).first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(card.getByText(/Lucro R\$/)).toBeVisible();

    const downloadPromise = page.waitForEvent('download', { timeout: 20_000 });
    await card.getByRole('button', { name: 'Gerar PDF' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^relatorio-rentabilidade.*\.pdf$/);

    await expect(page.getByText('PDF gerado!')).toBeVisible({ timeout: 10_000 });
  });

  test('prévia mostra faturamento, custo, lucro e margem', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    // Guarantee an in-period concluded sale (the preview hides the margin
    // stats when the month has no sales)
    const token = await page.evaluate(() => localStorage.getItem('agilzi_token'));
    const stamp = Date.now();
    const product = await page.request.post('http://localhost:5173/api/v1/products', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: `Margem Prev E2E ${stamp}`, price: 100, costPrice: 40, stock: 10 },
    });
    expect(product.status()).toBe(201);
    const productId = (await product.json()).data.id;
    const sale = await page.request.post('http://localhost:5173/api/v1/sales', {
      headers: { Authorization: `Bearer ${token}` },
      data: { items: [{ productId, quantity: 1, unitValue: 100 }], paymentMethod: 'pix' },
    });
    expect(sale.status()).toBe(201);

    await page.goto('/relatorios');

    const preview = page.locator('.card', { hasText: 'Prévia do período' });
    await expect(preview).toBeVisible({ timeout: 10_000 });
    await expect(preview.getByText('Faturamento')).toBeVisible();
    await expect(preview.getByText('Lucro')).toBeVisible();
    await expect(preview.getByText('Margem')).toBeVisible();
  });
});
