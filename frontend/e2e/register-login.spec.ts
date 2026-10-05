import { test, expect } from '@playwright/test';
import { registerCompany, login, uniqueEmail } from './helpers';

test.describe('Registro e login', () => {
  test('registrar cria empresa e redireciona para o dashboard', async ({ page }) => {
    const { companyName } = await registerCompany(page, { type: 'loja' });

    await expect(page).toHaveURL(/\/dashboard/);
    // Company name shown in sidebar
    await expect(page.getByText(companyName).first()).toBeVisible();
  });

  test('menu reflete o tipo de empresa escolhido no cadastro', async ({ page }) => {
    await registerCompany(page, { type: 'prestador' });

    // Prestador sees service items
    await expect(page.getByRole('link', { name: 'Serviços' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ordens de Serviço' })).toBeVisible();
    // ...but not store-only items
    await expect(page.getByRole('link', { name: 'Produtos' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Vendas' })).toHaveCount(0);
  });

  test('login com credenciais corretas entra no sistema', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('login com senha errada mostra erro e permanece na tela', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('seu@email.com').fill('admin@demo.com');
    await page.getByPlaceholder('••••••••').fill('senha-totalmente-errada');
    await page.getByRole('button', { name: /Entrar/ }).click();

    // Must NOT hang — error toast appears and we stay on /login
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('text=/inválidos|Erro/i').first()).toBeVisible({ timeout: 10_000 });
  });

  test('usuário não autenticado é redirecionado para /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('rota inexistente mostra a página 404', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    await page.goto('/rota-que-nao-existe');
    await expect(page.getByText('Página não encontrada')).toBeVisible();
    await expect(page.getByText('404')).toBeVisible();
  });

  test('logout limpa a sessão', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');

    await page.getByRole('button', { name: /Administrador/ }).click();
    await page.getByRole('button', { name: /Sair da conta/ }).click();

    await expect(page).toHaveURL(/\/login/);
    // Going back to a protected route bounces to login
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
