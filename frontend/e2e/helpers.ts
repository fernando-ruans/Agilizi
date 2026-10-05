import { Page, expect } from '@playwright/test';

export const APP = 'http://localhost:5173';

export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
}

/**
 * The app renders `<label>Texto</label><input/>` as siblings (no for/id yet),
 * so getByLabel() can't resolve them. This finds the first control after
 * an exact label text — sibling or wrapped (e.g. password + eye toggle).
 * Required fields render as "Texto *", so the trailing asterisk is
 * optional here.
 */
export function field(page: Page, labelText: string) {
  return page
    .locator('label')
    .filter({ hasText: new RegExp(`^${labelText}\\s*\\*?$`) })
    .locator('xpath=following::input[1] | following::select[1] | following::textarea[1]');
}

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByPlaceholder('seu@email.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: /Entrar/ }).click();
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
}

export async function registerCompany(
  page: Page,
  opts: { type?: 'loja' | 'prestador' | 'ambos' } = {}
): Promise<{ email: string; password: string; companyName: string }> {
  const email = uniqueEmail();
  const password = 'senha123';
  const companyName = `Empresa ${Date.now()}`;

  await page.goto('/register');

  // Step 1: personal data
  await field(page, 'Seu nome').fill('Usuário E2E');
  await field(page, 'Email').fill(email);
  await field(page, 'Senha').fill(password);
  await page.getByRole('button', { name: /Próximo/ }).click();

  // Step 2: company data
  await field(page, 'Nome da empresa').fill(companyName);
  if (opts.type) {
    const typeLabel = opts.type === 'loja' ? 'Loja' : opts.type === 'prestador' ? 'Prestador' : 'Ambos';
    await page.getByRole('button', { name: new RegExp(`^${typeLabel}`) }).click();
  }
  await page.getByRole('button', { name: /Criar conta/ }).click();

  await page.waitForURL('**/dashboard', { timeout: 15_000 });
  return { email, password, companyName };
}
