import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Tema claro/escuro', () => {
  test('toggle alterna o tema e persiste após reload', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    await page.goto('/dashboard');

    const toggle = page.getByRole('button', { name: /Ativar tema (claro|escuro)/ });
    await expect(toggle).toBeVisible();

    // Normalize to dark first (whatever the system pref is)
    const initialDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (!initialDark) await toggle.click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')))
      .toBe(true);
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Reload → still dark (localStorage + inline anti-flash script)
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Toggle to light and back — class + storage stay in sync
    const lightToggle = page.getByRole('button', { name: 'Ativar tema claro' });
    await lightToggle.click();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('agilzi_theme')))
      .toBe('light');
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    await page.reload();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('header mostra o botão de tema em qualquer página', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    for (const path of ['/clientes', '/relatorios', '/configuracoes']) {
      await page.goto(path);
      await expect(
        page.getByRole('button', { name: /Ativar tema (claro|escuro)/ })
      ).toBeVisible();
    }
  });
});
