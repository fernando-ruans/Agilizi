import { test, expect } from '@playwright/test';
import { login } from './helpers';

// pdfmake throws for undefined fonts (regression: 'Helvetica' is not bundled
// in vfs_fonts — the app must use Roboto)
test.describe('Geração de PDF', () => {
  test('relatório financeiro baixa um PDF válido', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    await page.goto('/relatorios');
    await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible();

    const downloadPromise = page.waitForEvent('download', { timeout: 20_000 });
    await page.getByRole('button', { name: 'Gerar PDF' }).first().click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^relatorio-financeiro.*\.pdf$/);

    // Save and check it is a real PDF (magic bytes) with content
    const path = await download.path();
    const fs = await import('fs');
    const buffer = fs.readFileSync(path);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1000);

    await expect(page.getByText('PDF gerado!')).toBeVisible({ timeout: 10_000 });
  });

  test('relatório de clientes baixa um PDF válido', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    await page.goto('/relatorios');

    const downloadPromise = page.waitForEvent('download', { timeout: 20_000 });
    // Second card: Clientes
    await page.getByRole('button', { name: 'Gerar PDF' }).nth(1).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^relatorio-clientes.*\.pdf$/);
    await expect(page.getByText('PDF gerado!')).toBeVisible({ timeout: 10_000 });
  });
});
