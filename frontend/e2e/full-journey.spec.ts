import { test, expect } from '@playwright/test';
import { registerCompany, field } from './helpers';

/**
 * Jornada completa: passa por TODOS os módulos como um usuário real,
 * cada ato com empresa isolada recém-criada (sem depender de restos).
 */
const stamp = () => Date.now();

test.describe('Jornada A — comercial (clientes, fornecedores, produtos, serviços, vendas, caixa)', () => {
  test('cadastra base, vende e vê o dinheiro no caixa', async ({ page }) => {
    test.setTimeout(180_000);
    await registerCompany(page, { type: 'ambos' });
    const s = stamp();
    const clientName = `Jornada Cli ${s}`;
    const prodName = `Jornada Prod ${s}`;
    const servName = `Jornada Serv ${s}`;

    // Clientes
    await page.goto('/clientes');
    await page.getByRole('button', { name: /Novo Cliente/ }).click();
    await page.locator('#client-name').fill(clientName);
    await page.getByRole('button', { name: 'Criar', exact: true }).click();
    await expect(page.getByText('Cliente criado')).toBeVisible({ timeout: 8_000 });

    // Fornecedores
    await page.goto('/fornecedores');
    await page.getByRole('button', { name: /Novo Fornecedor/ }).click();
    await page.locator('#supplier-name').fill(`Jornada Forn ${s}`);
    await page.getByRole('button', { name: 'Criar', exact: true }).click();
    await expect(page.getByText('Fornecedor criado')).toBeVisible({ timeout: 8_000 });

    // Produtos (com custo → habilita margem)
    await page.goto('/produtos');
    await page.getByRole('button', { name: /Novo Produto/ }).click();
    await page.locator('#product-name').fill(prodName);
    await page.locator('#product-price').fill('50');
    await page.locator('#product-cost').fill('20');
    await page.locator('#product-stock').fill('10');
    await page.getByRole('button', { name: 'Criar', exact: true }).click();
    await expect(page.getByText('Produto criado')).toBeVisible({ timeout: 8_000 });

    // Serviços
    await page.goto('/servicos');
    await page.getByRole('button', { name: /Novo Serviço/ }).click();
    await page.locator('#service-name').fill(servName);
    await page.locator('#service-value').fill('200');
    await page.getByRole('button', { name: 'Criar', exact: true }).click();
    await expect(page.getByText('Serviço criado')).toBeVisible({ timeout: 8_000 });

    // Vendas: 3 unidades × R$ 50 = R$ 150 para o cliente
    await page.goto('/vendas');
    await page.getByRole('button', { name: /Nova Venda/ }).click();
    await page.locator('#sale-client').selectOption({ label: clientName });
    await page.getByRole('button', { name: 'Adicionar' }).click();
    await page.getByLabel(/produto do item 1/i).selectOption({ label: `${prodName} (10 disp.)` });
    await page.getByRole('spinbutton', { name: /quantidade do item/i }).fill('3');
    await page.getByRole('button', { name: /registrar venda/i }).click();
    await expect(page.getByText('Venda registrada')).toBeVisible({ timeout: 8_000 });
    const saleRow = page.locator('tbody tr', { hasText: clientName });
    await expect(saleRow.getByText('R$ 150,00')).toBeVisible({ timeout: 8_000 });

    // Caixa: a entrada automática aparece
    await page.goto('/caixa');
    await page.getByPlaceholder(/Buscar descrição/).fill('Venda #');
    await expect(page.locator('tbody tr', { hasText: 'R$ 150,00' })).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('Jornada B — serviços (orçamento → OS → conclusão → despesas)', () => {
  test('aprova, converte, conclui e paga despesa', async ({ page }) => {
    test.setTimeout(180_000);
    page.on('dialog', (d) => d.accept());
    await registerCompany(page, { type: 'ambos' });
    const s = stamp();
    const clientName = `JornadaB Cli ${s}`;
    const servName = `JornadaB Serv ${s}`;
    const desc = `JornadaB Net ${s}`;

    await page.goto('/clientes');
    await page.getByRole('button', { name: /Novo Cliente/ }).click();
    await page.locator('#client-name').fill(clientName);
    await page.getByRole('button', { name: 'Criar', exact: true }).click();
    await expect(page.getByText('Cliente criado')).toBeVisible({ timeout: 8_000 });

    await page.goto('/servicos');
    await page.getByRole('button', { name: /Novo Serviço/ }).click();
    await page.locator('#service-name').fill(servName);
    await page.locator('#service-value').fill('300');
    await page.getByRole('button', { name: 'Criar', exact: true }).click();
    await expect(page.getByText('Serviço criado')).toBeVisible({ timeout: 8_000 });

    // Orçamento → aprovar no detalhe → converter na linha
    await page.goto('/orcamentos');
    await page.getByRole('button', { name: /Novo Orçamento/ }).click();
    await page.locator('#budget-client').selectOption({ label: clientName });
    await page.getByRole('button', { name: '+ Adicionar item' }).click();
    await page.getByLabel(/serviço do item 1/i).selectOption({ label: servName });
    await page.getByRole('button', { name: /Criar Orçamento/ }).click();
    await expect(page.getByText('Orçamento criado')).toBeVisible({ timeout: 8_000 });
    const bRow = page.locator('tbody tr', { hasText: clientName });
    await bRow.getByTitle('Ver detalhes').click();
    await page.getByRole('button', { name: /Aprovar orçamento/ }).click();
    await expect(page.getByText('Orçamento aprovado')).toBeVisible({ timeout: 8_000 });
    await page.locator('tbody tr', { hasText: clientName }).getByTitle('Converter em OS').click();
    await expect(page.getByText('Convertido em OS')).toBeVisible({ timeout: 10_000 });

    // OS: iniciar → concluir (com confirm aceito)
    await page.goto('/ordens-servico');
    const osRow = page.locator('tbody tr', { hasText: clientName });
    await osRow.getByTitle('Iniciar').click();
    await expect(page.getByText('Status atualizado')).toBeVisible({ timeout: 8_000 });
    await page.locator('tbody tr', { hasText: clientName }).getByTitle('Concluir').click();
    await expect(page.getByText('Status atualizado')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('tbody tr', { hasText: clientName }).getByText('CONCLUÍDA')).toBeVisible({ timeout: 8_000 });

    // Caixa: entrada de serviço gerada
    await page.goto('/caixa');
    await page.getByPlaceholder(/Buscar descrição/).fill('OS #');
    await expect(page.locator('tbody tr', { hasText: 'R$ 300,00' })).toBeVisible({ timeout: 8_000 });

    // Despesas: criar e marcar como paga
    await page.goto('/despesas');
    await page.getByRole('button', { name: /Nova Despesa/ }).click();
    await page.locator('#expense-description').fill(desc);
    await page.locator('#expense-value').fill('80');
    await page.getByRole('button', { name: 'Criar', exact: true }).click();
    await expect(page.getByText(desc)).toBeVisible({ timeout: 8_000 });
    await page.locator('tbody tr', { hasText: desc }).getByTitle('Marcar como pago').click();
    await expect(page.locator('tbody tr', { hasText: desc }).getByText('PAGO')).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('Jornada C — gestão (relatórios, config, usuários, perfil, tema, logout)', () => {
  test('fecha o ciclo administrativo', async ({ page }) => {
    test.setTimeout(180_000);
    const { companyName } = await registerCompany(page, { type: 'ambos' });
    const s = stamp();

    // Relatórios: prévia + PDF com download real
    await page.goto('/relatorios');
    await expect(page.locator('.card', { hasText: 'Prévia do período' })).toBeVisible({ timeout: 10_000 });
    const card = page.locator('.card', { hasText: 'Financeiro' }).first();
    const dl = page.waitForEvent('download', { timeout: 20_000 });
    await card.getByRole('button', { name: /Gerar PDF/ }).click();
    await (await dl).path();
    await expect(page.getByText('PDF gerado')).toBeVisible({ timeout: 10_000 });

    // Configurações: empresa + usuários
    await page.goto('/configuracoes');
    await expect(page.getByText(companyName)).toBeVisible({ timeout: 8_000 });
    await page.locator('#company-trade').fill(`Fantasia ${s}`);
    await page.getByRole('button', { name: /Salvar alterações/ }).first().click();
    await expect(page.getByText('Empresa atualizada')).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: 'Usuários', exact: true }).click();
    await page.getByRole('button', { name: /Novo Usuário/ }).click();
    const gMail = `gerente-${s}@example.com`;
    await page.locator('#user-name').fill('Gerente Jornada');
    await page.locator('#user-email').fill(gMail);
    await page.locator('#user-password').fill('gerente123');
    await page.locator('#user-role').selectOption('gerente');
    await page.getByRole('button', { name: 'Criar', exact: true }).click();
    await expect(page.locator('tbody tr', { hasText: gMail })).toBeVisible({ timeout: 8_000 });

    // Perfil: renomear
    await page.goto('/perfil');
    await page.locator('#profile-name').fill('Usuário E2E Jr');
    await page.getByRole('button', { name: /Salvar alterações/ }).first().click();
    await expect(page.getByText('Perfil atualizado')).toBeVisible({ timeout: 8_000 });

    // Tema persiste após reload
    await page.goto('/dashboard');
    const before = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await page.getByRole('button', { name: /tema/i }).click();
    await page.reload();
    const after = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(after).toBe(!before);

    // Logout volta ao login
    await page.getByRole('button', { name: /Usuário E2E/ }).click();
    await page.getByRole('button', { name: /Sair/ }).click();
    await page.waitForURL('**/login', { timeout: 10_000 });
  });
});
