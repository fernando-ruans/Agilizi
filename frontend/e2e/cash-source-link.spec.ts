import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Link para o lançamento original (Caixa)', () => {
  test('detalhe de despesa linka para a despesa com modal aberto', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');

    const token = await page.evaluate(() => localStorage.getItem('agilzi_token'));
    const desc = `Aluguel link E2E ${Date.now()}`;
    const created = await page.request.post('http://localhost:5173/api/v1/expenses', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        description: desc,
        value: 100,
        category: 'aluguel',
        date: new Date().toISOString(),
        status: 'pago',
        paymentMethod: 'dinheiro',
      },
    });
    expect(created.status()).toBe(201);

    await page.goto('/caixa');
    await page.getByPlaceholder(/Buscar descrição/).fill(desc);
    const row = page.locator('tbody tr', { hasText: desc });
    await expect(row).toBeVisible({ timeout: 8_000 });

    await row.getByTitle('Ver detalhes').click();
    await expect(page.getByText('Detalhes da transação')).toBeVisible();

    // Structured reference → deep link button
    const link = page.getByRole('button', { name: 'Ver a despesa original' });
    await expect(link).toBeVisible();
    await link.click();

    // Landed on expenses; the detail modal opens from the deep link
    // (?view= is transient — cleared right after the record loads)
    await expect(page).toHaveURL(/\/despesas/, { timeout: 8_000 });
    await expect(page.getByText('Detalhes da despesa')).toBeVisible({ timeout: 8_000 });
    // Description shows both in the table row and the detail modal
    await expect(page.getByText(desc).first()).toBeVisible();
    // Param is cleaned after opening so refresh doesn't refetch forever
    await expect(page).toHaveURL(/\/despesas$/, { timeout: 8_000 });
  });

  test('detalhe de venda linka para a venda original', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    // Create a fresh in-period sale (relying on leftover data breaks when
    // it ages out of the default month filter)
    const token = await page.evaluate(() => localStorage.getItem('agilzi_token'));
    const stamp = Date.now();
    const product = await page.request.post('http://localhost:5173/api/v1/products', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: `Link Venda E2E ${stamp}`, price: 50, costPrice: 20, stock: 10 },
    });
    expect(product.status()).toBe(201);
    const productId = (await product.json()).data.id;
    const sale = await page.request.post('http://localhost:5173/api/v1/sales', {
      headers: { Authorization: `Bearer ${token}` },
      data: { items: [{ productId, quantity: 1, unitValue: 50 }], paymentMethod: 'pix' },
    });
    expect(sale.status()).toBe(201);
    const saleNumber = (await sale.json()).data.number;
    const desc = `Venda #${String(saleNumber).padStart(4, '0')}`;

    await page.goto('/caixa');
    await page.getByPlaceholder(/Buscar descrição/).fill(desc);
    await page.getByLabel('Filtrar por categoria').selectOption('venda');
    const row = page.locator('tbody tr', { hasText: desc });
    await expect(row).toBeVisible({ timeout: 8_000 });
    await row.getByTitle('Ver detalhes').click();

    const link = page.getByRole('button', { name: 'Ver a venda original' });
    await expect(link).toBeVisible();
    await link.click();

    await expect(page).toHaveURL(/\/vendas/, { timeout: 8_000 });
    await expect(page.getByText(new RegExp(`^${desc}$`)).first()).toBeVisible({ timeout: 8_000 });
  });

  test('lançamento manual não mostra botão de origem', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');

    const token = await page.evaluate(() => localStorage.getItem('agilzi_token'));
    const desc = `Manual E2E ${Date.now()}`;
    await page.request.post('http://localhost:5173/api/v1/cash', {
      headers: { Authorization: `Bearer ${token}` },
      data: { type: 'entrada', category: 'outros', description: desc, value: 10, reference: 'anotação qualquer' },
    });

    await page.goto('/caixa');
    await page.getByPlaceholder(/Buscar descrição/).fill(desc);
    const row = page.locator('tbody tr', { hasText: desc });
    await expect(row).toBeVisible({ timeout: 8_000 });
    await row.getByTitle('Ver detalhes').click();

    await expect(page.getByText('Detalhes da transação')).toBeVisible();
    await expect(page.getByRole('button', { name: /original/ })).toHaveCount(0);
    await expect(page.getByText('anotação qualquer')).toBeVisible();
  });
});
