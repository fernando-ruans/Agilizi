import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Formulário da empresa: dados válidos', () => {
  test('campos têm limite de caracteres e estado é forçado a 2 letras', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    await page.goto('/configuracoes');

    // Native maxlength: typing beyond the limit is cut by the browser
    const name = page.locator('#company-name');
    await expect(name).toHaveAttribute('maxLength', '120');
    await expect(page.locator('#company-doc')).toHaveAttribute('maxLength', '18');
    await expect(page.locator('#company-phone')).toHaveAttribute('maxLength', '20');
    await expect(page.locator('#company-email')).toHaveAttribute('maxLength', '150');
    await expect(page.locator('#company-state')).toHaveAttribute('maxLength', '2');
    await expect(page.locator('#company-zip')).toHaveAttribute('maxLength', '9');
  });

  test('salvar com CNPJ inválido mostra erro de validação (não 500)', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    await page.goto('/configuracoes');

    await page.locator('#company-doc').fill('123');
    await page.getByRole('button', { name: /Salvar alterações/ }).click();

    await expect(page.getByText(/CNPJ deve ter 14 dígitos/)).toBeVisible({ timeout: 8_000 });
  });
});
