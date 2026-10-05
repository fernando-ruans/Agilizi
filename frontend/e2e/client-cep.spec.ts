import { test, expect, Page } from '@playwright/test';
import { login, field } from './helpers';

const CEP_FIXTURE = {
  cep: '01310-100',
  street: 'Avenida Paulista',
  neighborhood: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
};

/** Stubs our backend CEP proxy so the spec runs without internet. */
async function stubCep(page: Page) {
  await page.route('**/api/v1/cep/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'success', data: CEP_FIXTURE }),
    })
  );
}

async function fillAndCheckAddress(page: Page, name: string): Promise<string> {
  await stubCep(page);

  await page.getByRole('button', { name: new RegExp(`Novo ${name}`) }).click();
  const fullName = `${name} CEP ${Date.now()}`;
  await field(page, 'Nome').fill(fullName);

  await page.getByLabel('CEP').fill('01310100');

  // Debounce (400ms) + request → fields fill automatically
  await expect(page.getByLabel('Endereço')).toHaveValue('Avenida Paulista', { timeout: 8_000 });
  await expect(page.getByLabel('Cidade')).toHaveValue('São Paulo');
  await expect(page.getByLabel('Estado')).toHaveValue('SP');
  await expect(page.getByLabel('CEP')).toHaveValue('01310-100');
  await expect(page.getByText('Endereço preenchido')).toBeVisible();

  return fullName;
}

test.describe('Autocomplete de CEP', () => {
  test('preenche endereço do cliente a partir do CEP', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    await page.goto('/clientes');

    const clientName = await fillAndCheckAddress(page, 'Cliente');

    await page.getByRole('button', { name: 'Criar', exact: true }).click();
    await expect(page.getByText('Cliente criado')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(clientName)).toBeVisible();
  });

  test('preenche endereço do fornecedor a partir do CEP', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    await page.goto('/fornecedores');

    const supplierName = await fillAndCheckAddress(page, 'Fornecedor');

    await page.getByRole('button', { name: 'Criar', exact: true }).click();
    await expect(page.getByText('Fornecedor criado!')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(supplierName)).toBeVisible();
  });

  test('falha de consulta não bloqueia preenchimento manual', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    await page.goto('/clientes');

    await page.route('**/api/v1/cep/**', (route) =>
      route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'error', message: 'upstream down' }),
      })
    );

    await page.getByRole('button', { name: /Novo Cliente/ }).click();
    await page.getByLabel('CEP').fill('01310100');

    await expect(page.getByText('Não foi possível consultar o CEP. Preencha manualmente.')).toBeVisible({
      timeout: 8_000,
    });

    // Manual entry still works
    await page.getByLabel('Endereço').fill('Rua Manual, 42');
    await expect(page.getByLabel('Endereço')).toHaveValue('Rua Manual, 42');
  });
});
