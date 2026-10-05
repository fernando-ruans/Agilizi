import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Filtro de período (data custom)', () => {
  test('relatórios: período personalizado recalcula a prévia', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    await page.goto('/relatorios');
    await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible();

    // Default preset is active
    const customBtn = page.getByRole('button', { name: /Personalizado/ });
    await expect(customBtn).toBeVisible();

    await customBtn.click();
    const start = page.getByLabel('Data inicial');
    const end = page.getByLabel('Data final');
    await expect(start).toBeVisible();

    // Far past → no data in the preview
    await start.fill('2020-01-01');
    await end.fill('2020-12-31');

    await expect(page.getByText('0', { exact: true }).first()).toBeVisible({ timeout: 8_000 });
    // The period label reflects the custom range
    await expect(page.getByText(/01\/01\/2020/)).toBeVisible();

    // Back to "Tudo" → preview shows counts again
    await page.getByRole('button', { name: 'Tudo' }).click();
    await expect(page.getByText(/Todo o período/)).toBeVisible();
  });

  test('dashboard: filtro do gráfico carrega a série do período', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');

    // Intercept the series endpoint to confirm the picker drives the request
    const seriesRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/dashboard/series')) seriesRequests.push(req.url());
    });

    await page.goto('/dashboard');
    await expect(page.getByText('Entradas × Saídas')).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => seriesRequests.length, { timeout: 8_000 }).toBeGreaterThan(0);

    // Change period → new request with the range params
    const before = seriesRequests.length;
    await page.getByRole('button', { name: '7 dias' }).first().click();
    await expect.poll(() => seriesRequests.length, { timeout: 8_000 }).toBeGreaterThan(before);
    expect(seriesRequests.at(-1)).toMatch(/startDate=/);

    // Custom inputs appear
    await page.getByRole('button', { name: /Personalizado/ }).first().click();
    await expect(page.getByLabel('Data inicial').first()).toBeVisible();
  });

  test('caixa: filtro de período é enviado à API', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');

    const cashRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/v1/cash?')) cashRequests.push(req.url());
    });

    await page.goto('/caixa');
    await expect(page.getByRole('heading', { name: 'Caixa' })).toBeVisible();
    await expect.poll(() => cashRequests.length, { timeout: 8_000 }).toBeGreaterThan(0);
    expect(cashRequests.at(-1)).toMatch(/startDate=/);

    await page.getByRole('button', { name: 'Tudo', exact: true }).first().click();
    await expect.poll(() => cashRequests.at(-1), { timeout: 8_000 }).not.toMatch(/startDate=/);
  });
});
