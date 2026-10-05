import { test, expect } from '@playwright/test';
import { login, registerCompany, field } from './helpers';

test.describe('CRUD de clientes', () => {
  test('cria um cliente e ele aparece na listagem', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    await page.goto('/clientes');
    await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible();

    const clientName = `Cliente E2E ${Date.now()}`;
    await page.getByRole('button', { name: /Novo Cliente/ }).click();
    await field(page, 'Nome').fill(clientName);
    await page.getByRole('button', { name: 'Criar', exact: true }).click();

    // Toast + row visible
    await expect(page.getByText('Cliente criado')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(clientName)).toBeVisible({ timeout: 8_000 });
  });

  test('edita um cliente existente', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    await page.goto('/clientes');

    const name = `Editar E2E ${Date.now()}`;
    await page.getByRole('button', { name: /Novo Cliente/ }).click();
    await field(page, 'Nome').fill(name);
    await page.getByRole('button', { name: 'Criar', exact: true }).click();
    await expect(page.getByText('Cliente criado')).toBeVisible({ timeout: 8_000 });

    // Edit the row we just created (pencil button in its row)
    const row = page.locator('tr', { hasText: name });
    await row.getByTitle('Editar').click();

    const updated = `${name} - editado`;
    await field(page, 'Nome').fill(updated);
    await page.getByRole('button', { name: 'Salvar' }).click();

    await expect(page.getByText('Cliente atualizado')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(updated)).toBeVisible({ timeout: 8_000 });
  });

  test('exclusão pede confirmação antes de desativar', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    await page.goto('/clientes');

    const name = `Remover E2E ${Date.now()}`;
    await page.getByRole('button', { name: /Novo Cliente/ }).click();
    await field(page, 'Nome').fill(name);
    await page.getByRole('button', { name: 'Criar', exact: true }).click();
    await expect(page.getByText('Cliente criado')).toBeVisible({ timeout: 8_000 });

    const row = page.locator('tr', { hasText: name });
    await row.getByTitle('Desativar').click();

    // Confirm dialog appears and cancelling keeps the row
    await expect(page.getByText('Desativar cliente')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByText(name)).toBeVisible();

    // Now confirm — row action buttons are also named "Desativar",
    // so target the one inside the confirmation dialog (rendered last)
    await row.getByTitle('Desativar').click();
    await page.getByRole('button', { name: 'Desativar', exact: true }).last().click();
    await expect(page.getByText('Cliente desativado')).toBeVisible({ timeout: 8_000 });
  });

  test('busca filtra a listagem', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    await page.goto('/clientes');

    const unique = `Busca E2E ${Date.now()}`;
    await page.getByRole('button', { name: /Novo Cliente/ }).click();
    await field(page, 'Nome').fill(unique);
    await page.getByRole('button', { name: 'Criar', exact: true }).click();
    await expect(page.getByText('Cliente criado')).toBeVisible({ timeout: 8_000 });

    await page.getByPlaceholder(/Buscar por nome/).fill(unique);
    await expect(page.getByText(unique)).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('Nenhum cliente cadastrado')).toHaveCount(0);
  });
});

test.describe('Página de perfil', () => {
  test('menu de perfil leva à página e aba de senha', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');

    await page.getByRole('button', { name: /Administrador/ }).click();
    await page.getByRole('link', { name: /Meu perfil/ }).click();

    await expect(page).toHaveURL(/\/perfil/);
    await expect(page.getByRole('heading', { name: 'Meu perfil' })).toBeVisible();
    await expect(page.getByText('admin@demo.com')).toBeVisible();
  });

  test('altera a senha pelo formulário', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    await page.goto('/perfil?tab=senha');

    await field(page, 'Senha atual').fill('senha-errada');
    await field(page, 'Nova senha').fill('nova-senha-123');
    await field(page, 'Confirmar nova senha').fill('nova-senha-123');
    await page.getByRole('button', { name: /Alterar senha/ }).click();

    // Wrong current password → error (and the request must not hang)
    await expect(page.getByText(/Senha atual incorreta/)).toBeVisible({ timeout: 8_000 });
  });
});
